import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {decodeJwtPayload,totpCode,validateTarget} from '../scripts/real-permissions-smoke.mjs';

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
 ].map(name=>[name,{email:'test@example.invalid',password:'not-a-real-password',roles:['supporter'],totpSecret:'JBSWY3DPEHPK3PXP'}]))),
 BOISSY_TEST_FIXTURES_JSON:JSON.stringify({teamA:'a',teamB:'b'})
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
 assert.match(result.stderr,/BOISSY_TEST_ENVIRONMENT=test/);
 assert.doesNotMatch(result.stdout+result.stderr,/dahzewvbybujqhogumte|service_role|sb_secret_/);
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
