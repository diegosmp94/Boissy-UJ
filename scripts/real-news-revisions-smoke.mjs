/**
 * Real READ-ONLY preproduction smoke test of News revision permissions.
 * Uses two dedicated test accounts, and an admin TOTP challenge.
 * Does not create, edit, restore or delete a news article.
 * Never run against Boissy-UJ production.
 */
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {decodeJwtPayload,totpCode} from './real-permissions-smoke.mjs';

export const NEWS_STAGE_PRODUCTION_REF='dahzewvbybujqhogumte';
export const NEWS_STAGE_ACK='YES_READ_ONLY_NEWS_REVISIONS_ON_ISOLATED_STAGING';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCEPTED_REVISIONS=new Set([
 'revision_id','recorded_at','action','title','excerpt','body','was_published'
]);
function parseJson(value,label){
 try{return JSON.parse(value||'');}catch{throw new Error('Invalid '+label+' configuration.');}
}
export function validateNewsStagingTarget(env){
 if(env.BOISSY_NEWS_TEST_ACK!==NEWS_STAGE_ACK)
  throw new Error('Read-only staging consent must be explicitly acknowledged.');
 const ref=String(env.BOISSY_NEWS_TEST_PROJECT_REF||'');
 if(!/^[a-z0-9]{20}$/.test(ref)||ref===NEWS_STAGE_PRODUCTION_REF)
  throw new Error('A distinct non-production Supabase project is mandatory.');
 let url;
 try{url=new URL(env.BOISSY_NEWS_TEST_URL||'');}
 catch{throw new Error('Invalid staging Supabase project URL.');}
 if(url.protocol!=='https:'||url.hostname!==ref+'.supabase.co'||
   url.pathname!=='/'||url.search||url.hash||url.username||url.password)
  throw new Error('The HTTPS staging URL must match the designated project exactly.');
 const key=String(env.BOISSY_NEWS_TEST_PUBLIC_KEY||'');
 if(!key||key.startsWith('sb_secret_')||key.startsWith('sk_')||
   key.startsWith('rk_'))throw new Error('Privileged or missing API key not permitted.');
 if(key.startsWith('eyJ')){
  let claims;
  try{claims=decodeJwtPayload(key);}catch{throw new Error('Invalid anon key.');}
  if(claims.role!=='anon'||claims.ref&&claims.ref!==ref)
   throw new Error('Only the staging anon key is permitted.');
 }else if(!key.startsWith('sb_publishable_')){
  throw new Error('Use a staging publishable key or legacy anon key.');
 }
 const personas=parseJson(env.BOISSY_NEWS_TEST_PERSONAS_JSON,'test accounts');
 for(const name of ['admin','supporter']){
  const p=personas?.[name];
  if(typeof p?.email!=='string'||!p.email.includes('@')||
     typeof p?.password!=='string'||p.password.length<8)
   throw new Error('Two dedicated authenticated test identities are mandatory.');
 }
 if(personas.admin.email.trim().toLowerCase()===
    personas.supporter.email.trim().toLowerCase())
  throw new Error('Admin and Supporter must have separate Auth identities.');
 if(!personas.admin.totpSecret)
  throw new Error('A verified test administrator TOTP factor is required.');
 const fixtures=parseJson(env.BOISSY_NEWS_TEST_FIXTURES_JSON,'article fixtures');
 if(!UUID.test(fixtures?.articleId))
  throw new Error('An existing dedicated test article UUID is required.');
 return {ref,url:url.origin,key,personas,fixtures};
}
export function isForbiddenResponse(response){
 return response?.ok===false &&
   (response.payload?.code==='42501'||[401,403].includes(response.status));
}
const ok=(response,label)=>{
 if(response?.ok!==true)throw new Error(label+' failed. Staging is not ready.');
 return response.payload;
};
const forbidden=(response,label)=>{
 if(!isForbiddenResponse(response))
  throw new Error(label+' was not refused; staging permission isolation failed.');
};
const expectedKeys=[...ACCEPTED_REVISIONS];
export function validateNewsHistory(rows){
 if(!Array.isArray(rows)||rows.length===0||rows.length>40)
  throw new Error('Fixture must have between 1 and 40 audit revisions.');
 let last=Infinity;
 for(const revision of rows){
  if(!revision||!Number.isSafeInteger(revision.revision_id)||
    revision.revision_id>=last||revision.revision_id<1)
   throw new Error('History is not sorted by descending, distinct revision ID.');
  const keys=Object.keys(revision);
  if(keys.length!==expectedKeys.length||
    keys.some(key=>!ACCEPTED_REVISIONS.has(key)))
   throw new Error('The revision RPC exposed unexpected private fields.');
  if(typeof revision.title!=='string'||
    typeof revision.body!=='string'||
    typeof revision.excerpt!=='string'||
    typeof revision.was_published!=='boolean'||
    typeof revision.recorded_at!=='string'||
    Number.isNaN(Date.parse(revision.recorded_at)))
   throw new Error('Audit revision data is incomplete.');
  last=revision.revision_id;
 }
 return true;
}
export async function stagingNewsApi(config){
 return {request:async(path,{method='GET',token,body}={})=>{
  const headers={apikey:config.key,Accept:'application/json'};
  if(token)headers.Authorization='Bearer '+token;
  if(body!==undefined)headers['Content-Type']='application/json';
  let response;
  try{
   response=await fetch(new URL(path,config.url+'/'),{
    method,headers,body:body===undefined?undefined:JSON.stringify(body),
    signal:AbortSignal.timeout(12000)
   });
  }catch{throw new Error('Staging API is unreachable.');}
  let payload=null;
  try{const result=await response.text();
   if(result)payload=JSON.parse(result);
  }catch{throw new Error('Staging API returned an invalid JSON response.');}
  return {ok:response.ok,status:response.status,payload};
 }};
}
export async function runNewsRevisionAccessRecipe(api,config,report=()=>{}){
 const sessions={};
 const call=(token,name,args={})=>api.request('rest/v1/rpc/'+name,{
  method:'POST',token,body:args
 });
 try{
  for(const name of ['admin','supporter']){
   const p=config.personas[name];
   const result=ok(await api.request('auth/v1/token?grant_type=password',{
    method:'POST',body:{email:p.email,password:p.password}
   }),name+' test login');
   if(!result?.access_token||!result?.user?.id)
    throw new Error('A test identity was not established.');
   const claims=decodeJwtPayload(result.access_token);
   if(claims.aal!=='aal1'||claims.sub!==result.user.id)
    throw new Error('Test account must begin with verified AAL1 identity.');
   const user=ok(await api.request('auth/v1/user',{token:result.access_token}),
    name+' test identity');
   if(user.id!==claims.sub||!(user.email_confirmed_at||user.confirmed_at))
    throw new Error('A confirmed Auth test account is required.');
   sessions[name]={token:result.access_token,userId:claims.sub};
  }
  if(sessions.admin.userId===sessions.supporter.userId)
   throw new Error('Test identities resolve to the same user.');
  report('Two separate verified staging accounts');
  const fixture={p_post_id:config.fixtures.articleId};
  const admin=sessions.admin,supporter=sessions.supporter;
  forbidden(await call(null,'admin_list_news_revisions',fixture),
   'Anonymous revision history');
  forbidden(await call(supporter.token,'admin_list_news_revisions',fixture),
   'Supporter revision history');
  forbidden(await call(admin.token,'admin_list_news_revisions',fixture),
   'Administrator without MFA revision history');
  report('Anonymous, Supporter and AAL1 administrator are denied audit history');
  const readinessAal1=ok(await call(admin.token,'admin_news_revisions_ready'),
   'AAL1 capability probe');
  if(readinessAal1!==false)
   throw new Error('AAL1 incorrectly unlocked the protected admin module.');
  report('AAL1 capability is false');

  const factors=ok(await api.request('auth/v1/factors',{
   token:admin.token
  }),'test administrator TOTP factors');
  const verified=(factors?.totp||[]).filter(f=>f.status==='verified');
  const preferred=config.personas.admin.factorId;
  const selected=preferred
   ?verified.find(f=>f.id===preferred)
   :verified.length===1?verified[0]:null;
  if(!selected)throw new Error('A single verified staging TOTP factor is required.');
  const challenge=ok(await api.request(
   'auth/v1/factors/'+encodeURIComponent(selected.id)+'/challenge',{
    method:'POST',token:admin.token,body:{}
   }),'TOTP challenge');
  if(!challenge?.id)throw new Error('Test challenge is missing.');
  const verifiedMfa=ok(await api.request(
   'auth/v1/factors/'+encodeURIComponent(selected.id)+'/verify',{
    method:'POST',token:admin.token,
    body:{challenge_id:challenge.id,code:totpCode(config.personas.admin.totpSecret)}
   }),'TOTP verification');
  if(!verifiedMfa?.access_token||
    decodeJwtPayload(verifiedMfa.access_token).aal!=='aal2'||
    decodeJwtPayload(verifiedMfa.access_token).sub!==admin.userId)
   throw new Error('Test administrator did not reach AAL2.');
  admin.token=verifiedMfa.access_token;
  report('A real MFA challenge confirms administrator AAL2');

  if(ok(await call(admin.token,'admin_news_revisions_ready'),
   'Protected capability probe')!==true)
   throw new Error('Authorized AAL2 administrator has no revision capability.');
  const all=ok(await call(admin.token,'admin_list_management_news'),
   'Admin article list');
  if(!Array.isArray(all)||!all.some(x=>x.id===config.fixtures.articleId&&
    x.content_kind==='article'&&x.visibility==='public'))
   throw new Error('The dedicated revision article fixture is missing.');
  const rows=ok(await call(admin.token,'admin_list_news_revisions',fixture),
   'Protected revision history');
  validateNewsHistory(rows);
  report('AAL2 administrator reads bounded, sanitized existing audit history');

  // Negative write probe ONLY. A null article ID fails before any UPDATE,
  // even with a forged revision ID. No real article is modified.
  forbidden(await call(supporter.token,'admin_restore_news_revision',{
   p_post_id:null,p_revision_id:1,p_expected_updated_at:null
  }),'Supporter restore permission');
  const invalidAdmin=await call(admin.token,'admin_restore_news_revision',{
   p_post_id:null,p_revision_id:1,p_expected_updated_at:null
  });
  if(invalidAdmin.ok||invalidAdmin.payload?.code!=='22023')
   throw new Error('An invalid admin restoration request did not fail safely.');
  report('Invalid restore parameters are refused before any article can be updated');
 }finally{
  for(const name of ['admin','supporter'])if(sessions[name]?.token){
   try{await api.request('auth/v1/logout',{
    method:'POST',token:sessions[name].token
   });}catch{}
  }
 }
}
async function main(){
 const config=validateNewsStagingTarget(process.env);
 let count=0;
 await runNewsRevisionAccessRecipe(await stagingNewsApi(config),config,label=>{
  count++;console.log('PASS '+label);
 });
 console.log('PASS '+count+' read-only staging assertions.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(()=>{
  // Never print URLs, credentials, tokens, identities or article text.
  console.error('BLOCKED: revision staging recipe failed.');
  process.exitCode=1;
 });
}
