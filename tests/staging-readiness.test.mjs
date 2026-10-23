import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {
 validateStagingPreflight,runStagingReadiness,requireAuthenticatedOnlyRpc,
 makeStageReadOnlyClient,STAGING_ACK,PRODUCTION_PROJECT_REF
} from '../scripts/staging-readiness.mjs';
const ref='abcde12345abcde12345';
const env={
 BOISSY_STAGE_ENVIRONMENT:'staging',
 BOISSY_STAGE_ACK:STAGING_ACK,
 BOISSY_STAGE_PROJECT_REF:ref,
 BOISSY_STAGE_URL:'https://'+ref+'.supabase.co/',
 BOISSY_STAGE_PUBLISHABLE_KEY:'sb_publishable_testkey123456'
};
const valid=(other={})=>validateStagingPreflight({...env,...other});

test('stage 58 preflight refuses production, forged host, missing acknowledgement and elevated keys',()=>{
 assert.equal(valid().ref,ref);
 for(const patch of [
  {BOISSY_STAGE_ENVIRONMENT:'production'},
  {BOISSY_STAGE_ACK:''},
  {BOISSY_STAGE_PROJECT_REF:PRODUCTION_PROJECT_REF,
   BOISSY_STAGE_URL:'https://'+PRODUCTION_PROJECT_REF+'.supabase.co/'},
  {BOISSY_STAGE_URL:'https://'+ref+'.supabase.co/other'},
  {BOISSY_STAGE_URL:'https://'+ref+'.supabase.co/?debug=1'},
  {BOISSY_STAGE_URL:'http://'+ref+'.supabase.co/'},
  {BOISSY_STAGE_URL:'https://user@'+ref+'.supabase.co/'},
  {BOISSY_STAGE_URL:'https://'+ref+'.supabase.co:443/'},
  {BOISSY_STAGE_PUBLISHABLE_KEY:'sb_secret_fake'},
  {BOISSY_STAGE_PUBLISHABLE_KEY:'rk_test_fake'},
  {BOISSY_STAGE_PUBLISHABLE_KEY:'hello'}
 ])assert.throws(()=>valid(patch),undefined,JSON.stringify(patch));
});
test('stage only allows anon legacy JWT if verified claim cannot assert superuser or another project',()=>{
 const jwt=(claims)=>'eyJ0eXAiOiJKV1QifQ.'+
  Buffer.from(JSON.stringify(claims)).toString('base64url')+'.fake';
 assert.equal(valid({BOISSY_STAGE_PUBLISHABLE_KEY:jwt({role:'anon',ref})}).ref,ref);
 for(const payload of [{role:'service_role',ref},{role:'anon',ref:PRODUCTION_PROJECT_REF}]){
  assert.throws(()=>valid({BOISSY_STAGE_PUBLISHABLE_KEY:jwt(payload)}),/staging anon/);
 }
});
test('missing protected RPC is NOT a passing authorization result',()=>{
 assert.equal(requireAuthenticatedOnlyRpc({ok:false,status:403,payload:{code:'42501'}}),true);
 assert.equal(requireAuthenticatedOnlyRpc({ok:false,status:401,payload:{code:'PGRST301'}}),true);
 for(const result of [
  {ok:true,status:200,payload:[]},
  {ok:false,status:404,payload:{code:'PGRST202'}},
  {ok:false,status:500,payload:{code:'P0001'}},
  {ok:false,status:400,payload:{code:'XX000'}}
 ])assert.throws(()=>requireAuthenticatedOnlyRpc(result));
});
const ok=(payload)=>({ok:true,status:200,payload});
test('preflight requires three explicit read-only remote checks, returns no certification',async()=>{
 const paths=[],labels=[];
 const request=async(path,params={})=>{
  paths.push([path,params.method||'GET']);
  if(path.startsWith('rest/v1/club_teams?'))return ok([]);
  if(path==='auth/v1/settings')return ok({features:[]});
  if(path.endsWith('admin_list_management_news'))
   return {ok:false,status:403,payload:{code:'42501'}};
  throw Error('Unexpected endpoint');
 };
 const result=await runStagingReadiness(valid(),request,label=>labels.push(label));
 assert.equal(result.preflight,true);
 assert.equal(result.environment,'staging');
 assert.equal(result.checks,3);
 assert.equal(result.permissionRecette,false);
 assert.equal(result.restoreRecette,false);
 assert.equal(labels.length,3);
 assert.deepEqual(paths,[
  ['rest/v1/club_teams?select=id&limit=0','GET'],
  ['auth/v1/settings','GET'],
  ['rest/v1/rpc/admin_list_management_news','POST']
 ]);
});
test('preflight fails closed on missing table, broken Auth and unexpectedly readable admin data',async()=>{
 const config=valid();
 const healthy=async(path)=>{
  if(path.includes('club_teams'))return ok([]);
  if(path.includes('settings'))return ok({});
  return {ok:false,status:403,payload:{code:'42501'}};
 };
 await assert.rejects(()=>runStagingReadiness(config,async(path)=>{
  if(path.includes('club_teams'))return {ok:false,status:404,payload:{code:'PGRST205'}};
  return healthy(path);
 }),/not ready/);
 await assert.rejects(()=>runStagingReadiness(config,async(path)=>{
  if(path.includes('settings'))return {ok:false,status:500,payload:{}};
  return healthy(path);
 }),/not available/);
 await assert.rejects(()=>runStagingReadiness(config,async(path)=>{
  if(path.includes('admin_list_management_news'))return ok([]);
  return healthy(path);
 }),/unexpectedly accessible/);
});
test('network wrapper cannot be used for arbitrary writes, paths or secret-bearing endpoints',async()=>{
 const config=valid(),requests=[];
 const fakeFetch=async(url,options)=>{
  requests.push({url:String(url),options});
  return {ok:true,status:200,text:async()=>JSON.stringify([])};
 };
 const client=makeStageReadOnlyClient(config,fakeFetch);
 for(const path of [
  'rest/v1/user_roles','rest/v1/rpc/admin_save_news_article',
  'auth/v1/admin/users','storage/v1/object/somewhere',
  'rest/v1/club_teams?select=*','https://example.com/'
 ])await assert.rejects(()=>client(path),/explicit read-only/);
 await assert.rejects(()=>client('rest/v1/club_teams?select=id&limit=0',{method:'DELETE'}));
 await assert.rejects(()=>client('rest/v1/club_teams?select=id&limit=0',{method:'POST'}));
 await client('rest/v1/club_teams?select=id&limit=0');
 assert.equal(requests.length,1);
 assert.equal(requests[0].url,'https://'+ref+'.supabase.co/rest/v1/club_teams?select=id&limit=0');
 assert.equal(requests[0].options.method,'GET');
 assert.equal(requests[0].options.headers.Authorization,undefined);
});
test('CLI without staging environment exits before making a network request and leaks no secrets',()=>{
 const script=new URL('../scripts/staging-readiness.mjs',import.meta.url).pathname;
 const vars={...process.env};
 for(const key of Object.keys(vars))if(key.startsWith('BOISSY_STAGE_'))delete vars[key];
 const result=spawnSync(process.execPath,[script],{env:vars,encoding:'utf8'});
 assert.equal(result.status,1);
 assert.match(result.stderr,/BLOCKED/);
 assert.doesNotMatch(result.stderr+result.stdout,/service_role|sb_secret_|password|dahzewvbybujqhogumte/i);
});
