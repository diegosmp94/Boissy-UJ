import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {
 decodeJwtPayload,totpCode,validateTarget,assertDistinctSessions,
 CROSS_ACCOUNT_SCOPES,verifyCrossAccountPrivacy
} from '../scripts/real-permissions-smoke.mjs';

const script=new URL('../scripts/real-permissions-smoke.mjs',import.meta.url).pathname;
const ref='abcdefghij1234567890';
const base={
 BOISSY_TEST_ENVIRONMENT:'test',
 BOISSY_TEST_ACK:'YES_RUN_READ_ONLY_PERMISSION_TESTS_ON_STAGING',
 BOISSY_TEST_PROJECT_REF:ref,
 BOISSY_TEST_SUPABASE_URL:'https://'+ref+'.supabase.co',
 BOISSY_TEST_PUBLISHABLE_KEY:'sb_publishable_test_key',
 BOISSY_TEST_PERSONAS_JSON:JSON.stringify(Object.fromEntries([
  'supporter','playerA','playerB','coachA','coachB','admin','tripleRole'
 ].map(name=>[name,{email:'test+'+name+'@example.invalid',password:'not-a-real-password',roles:['supporter'],totpSecret:'JBSWY3DPEHPK3PXP'}]))),
 BOISSY_TEST_FIXTURES_JSON:JSON.stringify({
  teamA:'a',teamB:'b',
  playerAExclusiveMatchId:'11111111-1111-4111-8111-111111111111',
  playerBExclusiveMatchId:'22222222-2222-4222-8222-222222222222'
 })
};

test('TOTP generator matches the RFC 6238 SHA-1 six-digit vector',()=>{
 assert.equal(totpCode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',59000),'287082');
});

test('JWT payload decoding supports base64url claims without verifying or logging a token',()=>{
 const payload=Buffer.from(JSON.stringify({sub:'test-user',aal:'aal2'})).toString('base64url');
 assert.deepEqual(decodeJwtPayload('header.'+payload+'.signature'),{sub:'test-user',aal:'aal2'});
 assert.throws(()=>decodeJwtPayload('not-a-token'),/invalid access token/i);
});

test('live permission recipe accepts only an explicitly acknowledged non-production project',()=>{
 assert.equal(validateTarget(base).ref,ref);
 for(const env of [
  {...base,BOISSY_TEST_ENVIRONMENT:'production'},
  {...base,BOISSY_TEST_ACK:''},
  {...base,BOISSY_TEST_PROJECT_REF:'dahzewvbybujqhogumte',BOISSY_TEST_SUPABASE_URL:'https://dahzewvbybujqhogumte.supabase.co'},
  {...base,BOISSY_TEST_SUPABASE_URL:'https://other.supabase.co'},
  {...base,BOISSY_TEST_PUBLISHABLE_KEY:'sb_secret_do_not_use'},
  {...base,BOISSY_TEST_FIXTURES_JSON:JSON.stringify({teamA:'a',teamB:'a'})},
  {...base,BOISSY_TEST_PERSONAS_JSON:JSON.stringify({})}
 ])assert.throws(()=>validateTarget(env));
});

test('CLI refuses to run without all explicit test-project guards',()=>{
 const env={...process.env};
 for(const key of Object.keys(env))if(key.startsWith('BOISSY_TEST_'))delete env[key];
 const result=spawnSync(process.execPath,[script],{env,encoding:'utf8'});
 assert.equal(result.status,1);
 assert.match(result.stderr,/BOISSY_TEST_ENVIRONMENT must be local or test/);
 assert.doesNotMatch(result.stdout+result.stderr,/dahzewvbybujqhogumte|service_role|sb_secret_/);
});


test('staging accounts must be distinct and full fixture separation is mandatory',()=>{
 const p=JSON.parse(base.BOISSY_TEST_PERSONAS_JSON);
 p.playerB.email=p.playerA.email.toUpperCase();
 assert.throws(()=>validateTarget({...base,BOISSY_TEST_PERSONAS_JSON:JSON.stringify(p)}),/different verified test account/);
 const f=JSON.parse(base.BOISSY_TEST_FIXTURES_JSON);
 delete f.playerAExclusiveMatchId;
 assert.throws(()=>validateTarget({...base,BOISSY_TEST_FIXTURES_JSON:JSON.stringify(f)}),/exclusive player callup/);
 f.playerAExclusiveMatchId=f.playerBExclusiveMatchId;
 assert.throws(()=>validateTarget({...base,BOISSY_TEST_FIXTURES_JSON:JSON.stringify(f)}),/exclusive player callup/);
});
test('identity duplication is rejected even if credentials differ',()=>{
 const names=['supporter','playerA','playerB','coachA','coachB','admin','tripleRole'];
 const sessions=Object.fromEntries(names.map((name,i)=>[name,{userId:'id-'+i}]));
 assert.doesNotThrow(()=>assertDistinctSessions(sessions));
 sessions.coachB.userId=sessions.playerB.userId;
 assert.throws(()=>assertDistinctSessions(sessions),/same Auth user/);
});
test('cross-account RLS probes use only minimal fields and fail closed on leaked rows',async()=>{
 const state={passed:0};
 const calls=[];
 const session={token:'staging-token',userId:'own',claims:{aal:'aal1'}};
 const fake={
  async request(path,opts){
   calls.push({path,opts});
   return {ok:true,status:200,payload:[]};
  }
 };
 await verifyCrossAccountPrivacy(fake,state,session,'other','Supporter');
 assert.equal(state.passed,4);
 assert.deepEqual(CROSS_ACCOUNT_SCOPES.map(x=>x.table),
  ['profiles','user_roles','role_requests','staff_team_assignments']);
 assert.equal(calls.length,4);
 for(const {path,opts} of calls){
  const url=new URL(path,'https://example.invalid/');
  assert.deepEqual([...url.searchParams.keys()].sort(),
   [CROSS_ACCOUNT_SCOPES.find(x=>x.table===url.pathname.split('/').at(-1)).column,'limit','select'].sort());
  assert.equal(opts.token,'staging-token');
  assert.equal(url.searchParams.get('limit'),'1');
 }
 const leaking={request:async()=>({ok:true,status:200,payload:[{id:'other'}]})};
 await assert.rejects(()=>verifyCrossAccountPrivacy(leaking,{passed:0},session,'other','Player'),/could read another member/);
 const broken={request:async()=>({ok:false,status:403,payload:{code:'42501'}})};
 await assert.rejects(()=>verifyCrossAccountPrivacy(broken,{passed:0},session,'other','Player'),/failed/);
 await assert.rejects(()=>verifyCrossAccountPrivacy(fake,{passed:0},session,'own','Player'),/distinct/);
 await assert.rejects(()=>verifyCrossAccountPrivacy(fake,{passed:0},{...session,claims:{aal:'aal2'}},'other','Admin'),/AAL1/);
});

test('recipe documents only read operations, no signup or writes to business RPCs',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(script,'utf8');
 assert.match(source,/auth\/v1\/token\?grant_type=password/);
 assert.match(source,/auth\/v1\/factors/);
 assert.match(source,/staff_list_squad_fixtures/);
 assert.match(source,/player_my_callups/);
 assert.match(source,/admin_list_management_matches/);
 assert.doesNotMatch(source,/auth\/v1\/signup|staff_set_callup|player_respond_callup|admin_decide_role_request|admin_revoke_member_role/);
});
