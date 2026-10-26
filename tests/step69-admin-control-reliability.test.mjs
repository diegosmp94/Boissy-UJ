import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 boundedAdminStatus,adminCapability,adminCapabilities,adminFailureLabel
} from '../admin-control-reliability.mjs';
import {adminSessionStatus} from '../admin-security.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const center=read('admin-center.mjs');
const security=read('admin-security.mjs');

test('optional admin RPCs independently fail closed on error, throw and deadline',async()=>{
 assert.equal(await adminCapability(async()=>({data:[],error:null})),true);
 assert.equal(await adminCapability(async()=>({data:null,error:null})),false);
 assert.equal(await adminCapability(async()=>({data:[],error:{code:'42501'}})),false);
 assert.equal(await adminCapability(async()=>{throw Error('private token');}),false);
 assert.equal(await adminCapability(()=>new Promise(()=>{}),Array.isArray,5),false);
});

test('slow or unavailable optional module does not block healthy navigation entries',async()=>{
 const calls=[];
 const api={
  from:table=>{
   assert.equal(table,'club_teams');
   return {select:()=>({limit:async()=>({data:[{id:'team-1'}],error:null})})};
  },
  rpc:name=>{
   calls.push(name);
   if(name==='admin_list_free_events')return new Promise(()=>{});
   if(name==='admin_list_team_coaches')return Promise.resolve({data:[],error:null});
   if(name==='admin_list_news_media')throw Error('private path');
   if(name==='admin_news_revisions_ready')return Promise.resolve({data:true,error:null});
   throw Error('Unexpected probe '+name);
  }
 };
 const out=await adminCapabilities(api,6);
 assert.deepEqual(out,{
  eventsReady:false,coachTeamsReady:true,mediaReady:false,newsRevisionsReady:true
 });
 assert.deepEqual(new Set(calls),new Set([
  'admin_list_free_events','admin_list_team_coaches','admin_list_news_media','admin_news_revisions_ready'
 ]));
});

test('all failed backend checks disable all conditional modules',async()=>{
 const api={
  from:()=>({select:()=>({limit:()=>Promise.reject(new Error('offline'))})}),
  rpc:()=>Promise.reject(new Error('offline'))
 };
 assert.deepEqual(await adminCapabilities(api,5),{
  eventsReady:false,coachTeamsReady:false,mediaReady:false,newsRevisionsReady:false
 });
});

test('admin auth gate accepts only complete verified AAL2 status',async()=>{
 const good={status:'admin',roles:['supporter','admin'],level:'aal2',userId:'a'};
 assert.deepEqual(await boundedAdminStatus(async()=>good),good);
 const failures=[
  {status:'mfa-required',roles:['admin'],level:'aal1'},
  {status:'admin',roles:[],level:'aal2'},
  null
 ];
 for(const result of failures)
  assert.notEqual((await boundedAdminStatus(async()=>result)).status,'admin');
 assert.equal((await boundedAdminStatus(()=>new Promise(()=>{}),5)).status,'unverified');
 assert.equal((await boundedAdminStatus(async()=>{throw new Error('secret')},5)).status,'unverified');
});

test('real admin status deadline prevents hung identity/MFA and role checks',async()=>{
 const api={
  auth:{
   getUser:async()=>({data:{user:{id:'a'}},error:null}),
   mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'},error:null})}
  },
  from:()=>({select:()=>({eq:async()=>({data:[{role:'admin'}],error:null})})})
 };
 assert.equal((await adminSessionStatus(api,'a')).status,'admin');
 api.from=()=>({select:()=>({eq:async()=>{throw Error('connection');}})});
 assert.equal((await adminSessionStatus(api,'a')).status,'unverified');
 assert.match(security,/withAuthDeadline\(Promise\.all/);
 assert.match(security,/withAuthDeadline\(api\.from\('user_roles'\)/);
});

test('controller exposes bounded retries without retaining private data or unhandled module rejection',()=>{
 assert.match(center,/withAuthDeadline\(Promise\.resolve\(\)\.then\(getClient\)\)/);
 assert.match(center,/await adminCapabilities\(api\)/);
 assert.match(center,/const postProbeStatus=await adminSessionStatus\(api,verified\.userId\)/);
 assert.match(center,/const refreshCurrent=el\('button','admin-secondary-btn','Actualiser le module'\)/);
 assert.match(center,/refreshCurrent\.addEventListener\('click',\(\)=>void selectSection\(active\)\)/);
 assert.match(center,/function showModuleRetry\(view,id\)/);
 assert.match(center,/view\.replaceChildren\(\)/);
 assert.match(center,/retry\.addEventListener\('click',\(\)=>void selectSection\(id\)\)/);
 assert.match(center,/\.catch\(\(\)=>showModuleRetry\(view,id\)\)/);
 assert.match(center,/const check=await adminSessionStatus\(api,verified\.userId\)/);
 assert.match(center,/if\(!canOpenAdmin\(check,supabaseConfig\.adminEnabled\)\)/);
 assert.match(center,/await withAuthDeadline\(Promise\.all/);
 assert.match(center,/void mountAdminCenter\(getClient\)/);
 assert.doesNotMatch(center,/console\.log\(|alert\(|innerHTML\s*=/);
 assert.doesNotMatch(read('admin-control-reliability.mjs'),/localStorage|user_metadata|service_role|sk_live_/);
});

test('error copy never discloses backend details and differentiates denied from network failure',()=>{
 assert.match(adminFailureLabel('authorization'),/Accès suspendu/);
 assert.match(adminFailureLabel('module'),/module est momentanément indisponible/);
 assert.match(adminFailureLabel('service'),/Service administratif temporairement indisponible/);
});
