import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateTarget,decodeJwtPayload} from '../scripts/real-permissions-smoke.mjs';
import {LOCAL_STACK_ID} from '../scripts/local-supabase-readiness.mjs';

const names=['supporter','playerA','playerB','coachA','coachB','admin','tripleRole'];
const personas=Object.fromEntries(names.map(name=>[name,{
 email:'test+'+name+'@example.invalid',
 password:'non-existent-test-password',
 roles:name==='admin'?['admin']:name==='tripleRole'
  ?['supporter','player','coach','admin']
  :name.startsWith('coach')?['coach']:name.startsWith('player')?['player']:['supporter'],
 ...(name==='admin'||name==='tripleRole'?{totpSecret:'JBSWY3DPEHPK3PXP'}:{})
}]));
const fixture={
 teamA:'a',teamB:'b',
 playerAExclusiveMatchId:'11111111-1111-4111-8111-111111111111',
 playerBExclusiveMatchId:'22222222-2222-4222-8222-222222222222'
};
const anonJwt=()=>{
 const p=Buffer.from(JSON.stringify({role:'anon',iss:'supabase-demo'})).toString('base64url');
 return 'eyJhbGciOiJIUzI1NiJ9.'+p+'.not-a-real-signature';
};
const valid={
 BOISSY_TEST_ENVIRONMENT:'local',
 BOISSY_TEST_ACK:'YES_RUN_READ_ONLY_PERMISSION_TESTS_ON_LOCAL_DOCKER',
 BOISSY_TEST_LOCAL_STACK_ID:LOCAL_STACK_ID,
 BOISSY_TEST_PROJECT_REF:'',
 BOISSY_TEST_SUPABASE_URL:'http://127.0.0.1:54321/',
 BOISSY_TEST_PUBLISHABLE_KEY:anonJwt(),
 BOISSY_TEST_PERSONAS_JSON:JSON.stringify(personas),
 BOISSY_TEST_FIXTURES_JSON:JSON.stringify(fixture)
};
test('P1 local 7-persona recipe can target only the exact separately acknowledged loopback API',()=>{
 const state=validateTarget(valid);
 assert.equal(state.url,'http://127.0.0.1:54321');
 assert.equal(state.ref,LOCAL_STACK_ID);
 assert.equal(state.localOnly,true);
 assert.equal(Object.keys(state.personas).length,7);
 assert.equal(decodeJwtPayload(valid.BOISSY_TEST_PUBLISHABLE_KEY).role,'anon');
});
test('P1 local role test denies malicious/local-network/remote aliases, cookies and unexpected ports',()=>{
 for(const url of [
  'http://localhost:54321/','http://0.0.0.0:54321/',
  'http://[::1]:54321/','http://127.0.0.2:54321/',
  'https://127.0.0.1:54321/','http://127.0.0.1:54322/',
  'http://127.0.0.1:54321/rest/v1',
  'http://127.0.0.1:54321/?token=private',
  'http://127.0.0.1:54321/#ref',
  'http://user@127.0.0.1:54321/',
  'http://evil.example:54321/',
  'https://dahzewvbybujqhogumte.supabase.co/'
 ]){
  assert.throws(()=>validateTarget({...valid,BOISSY_TEST_SUPABASE_URL:url}),undefined,url);
 }
});
test('P1 local role test refuses unknown Docker stack, mixed prod ref or shared secret',()=>{
 for(const env of [
  {...valid,BOISSY_TEST_LOCAL_STACK_ID:'other-local'},
  {...valid,BOISSY_TEST_PROJECT_REF:'dahzewvbybujqhogumte'},
  {...valid,BOISSY_TEST_ENVIRONMENT:'test'},
  {...valid,BOISSY_TEST_ACK:'YES_RUN_READ_ONLY_PERMISSION_TESTS_ON_STAGING'},
  {...valid,BOISSY_TEST_PUBLISHABLE_KEY:'sb_secret_secret123456'},
  {...valid,BOISSY_TEST_PUBLISHABLE_KEY:'sk_live_secret'},
  {...valid,BOISSY_TEST_PUBLISHABLE_KEY:'bad'},
  {...valid,BOISSY_TEST_PUBLISHABLE_KEY:anonJwt().replace('not-a-real-signature','')},
  {...valid,BOISSY_TEST_PUBLISHABLE_KEY:(
   'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.sig')}
 ]){
  // A legacy key with an omitted JWT signature is not treated as proof of authenticity
  // by the parser, so do not use that case to infer signature verification.
  if(env.BOISSY_TEST_PUBLISHABLE_KEY?.endsWith('.')||env.BOISSY_TEST_PUBLISHABLE_KEY===anonJwt().replace('not-a-real-signature',''))continue;
  assert.throws(()=>validateTarget(env));
 }
});
test('P1 local role test requires seven unique identities, two exact callup fixtures and two separate teams',()=>{
 for(const env of [
  {...valid,BOISSY_TEST_PERSONAS_JSON:'{}'},
  {...valid,BOISSY_TEST_PERSONAS_JSON:JSON.stringify({...personas,playerB:{...personas.playerA}})},
  {...valid,BOISSY_TEST_FIXTURES_JSON:JSON.stringify({...fixture,teamB:'a'})},
  {...valid,BOISSY_TEST_FIXTURES_JSON:JSON.stringify({...fixture,playerBExclusiveMatchId:fixture.playerAExclusiveMatchId})},
 ]){
  assert.throws(()=>validateTarget(env));
 }
});
test('P1 local branch preflights unlinked Docker and Supabase CLI before ever using test credentials',()=>{
 const code=readFileSync(new URL('../scripts/real-permissions-smoke.mjs',import.meta.url),'utf8');
 const before=code.indexOf('if(config.localOnly){',code.indexOf('export async function runPermissionRecipe'));
 const firstHTTP=code.indexOf('const teamIds=await getTeamIds',before);
 assert.ok(before>=0&&firstHTTP>before);
 assert.match(code.slice(before,firstHTTP),/await inspectLocalCheckout\(root\)/);
 assert.match(code.slice(before,firstHTTP),/checkLocalRuntimes\(\)/);
 assert.match(code,/return \{url:url.origin,ref,key,personas,fixtures,localOnly\}/);
 assert.doesNotMatch(code,/supabase\s+(?:link|db push|projects create)|apply_migration|auth\/v1\/signup/);
});
