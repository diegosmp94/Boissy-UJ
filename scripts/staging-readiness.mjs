/**
 * Boissy-UJ stage 58: READ-ONLY staging environment check.
 *
 * No account creation, data modification, secrets printed, privilege escalation
 * or connection to the production Supabase project. This is a preflight, NOT
 * a full RLS, database restore, or authenticated multi-user acceptance test.
 */
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {decodeJwtPayload} from './real-permissions-smoke.mjs';

export const PRODUCTION_PROJECT_REF='dahzewvbybujqhogumte';
export const STAGING_ACK='YES_CHECK_SEPARATE_BOISSY_SUPABASE_STAGING';
const ID_PATTERN=/^[a-z0-9]{20}$/;
export function validateStagingPreflight(env){
 if(env.BOISSY_STAGE_ENVIRONMENT!=='staging'||env.BOISSY_STAGE_ACK!==STAGING_ACK)
  throw new Error('Explicit staging-only environment and acknowledgement required.');
 const ref=String(env.BOISSY_STAGE_PROJECT_REF||'');
 if(!ID_PATTERN.test(ref)||ref===PRODUCTION_PROJECT_REF)
  throw new Error('A real distinct, non-production Supabase project is mandatory.');
 let url;
 try{url=new URL(env.BOISSY_STAGE_URL||'');}
 catch{throw new Error('Staging URL is invalid.');}
 if(url.protocol!=='https:'||url.hostname!==ref+'.supabase.co'||
    !['','/'].includes(url.pathname)||url.search||url.hash||
    url.username||url.password||url.port)
  throw new Error('Staging URL must be exactly the specified HTTPS Supabase project root.');
 const key=String(env.BOISSY_STAGE_PUBLISHABLE_KEY||'');
 if(!key||key.startsWith('sb_secret_')||key.startsWith('sk_')||
    key.startsWith('rk_'))
  throw new Error('Privileged keys and missing keys are forbidden.');
 if(key.startsWith('eyJ')){
  let claims;
  try{claims=decodeJwtPayload(key);}
  catch{throw new Error('Invalid staging legacy anon key.');}
  if(claims.role!=='anon'||(claims.ref&&claims.ref!==ref))
   throw new Error('Legacy JWT key is not a staging anon key.');
 }else if(!/^sb_publishable_[a-zA-Z0-9_-]{8,}$/.test(key))
  throw new Error('Only an isolated publishable or legacy anon key is allowed.');
 return Object.freeze({ref,url:url.origin,key});
}

function validateHttpResult(r,label){
 if(!r||!Number.isSafeInteger(r.status)||typeof r.ok!=='boolean')
  throw new Error(label+' did not return a valid HTTP result.');
}
const parseBody=(value)=>{
 if(value===null||value===undefined||value==='')return null;
 if(typeof value!=='string')return value;
 try{return JSON.parse(value);}catch{return null;}
};
/** Anon role MUST be denied on a protected RPC. A missing RPC (404)
 * is a distinct failure, not a successful RLS isolation test.
 */
export function requireAuthenticatedOnlyRpc(result){
 validateHttpResult(result,'Protected admin RPC');
 if(result.ok||result.status===404||result.payload?.code==='PGRST202')
  throw new Error('Administrator RPC is missing or unexpectedly accessible.');
 if(result.payload?.code==='42501'||[401,403].includes(result.status))
  return true;
 throw new Error('Admin RPC denial cannot be verified (do not infer permission safety).');
}
export async function runStagingReadiness(config,request,record=()=>{}){
 if(!config||config.ref===PRODUCTION_PROJECT_REF||
   config.url!=='https://'+config.ref+'.supabase.co')
  throw new Error('Supabase staging target is not independently validated.');
 // Public Data API check, deliberately not selecting names, identities or rows.
 const teams=await request('rest/v1/club_teams?select=id&limit=0');
 validateHttpResult(teams,'Public schema request');
 if(!teams.ok||!Array.isArray(parseBody(teams.payload))||
    parseBody(teams.payload).length!==0)
  throw new Error('Staging public club_teams schema is not ready.');
 record('Public table available with zero personal records requested');

 // Auth configuration check; only parse the HTTP status, never its contents.
 const auth=await request('auth/v1/settings');
 validateHttpResult(auth,'Auth service');
 if(!auth.ok)throw new Error('Staging Auth service is not available.');
 record('Staging Auth service reachable');

 const admin=await request('rest/v1/rpc/admin_list_management_news',{
  method:'POST',body:{}
 });
 requireAuthenticatedOnlyRpc(admin);
 record('Anonymous role denied protected news administration RPC');

 // A positive result is ONLY the anonymous/public baseline. AAL1/AAL2,
 // independent recovery, Storage, and payment signoff remain pending.
 return Object.freeze({preflight:true,checks:3,environment:'staging',
  permissionRecette:false,restoreRecette:false});
}
export function makeStageReadOnlyClient(config,customFetch=fetch){
 return async function request(path,{method='GET',body}={}){
  if(!['GET','POST'].includes(method)||![
   'rest/v1/club_teams?select=id&limit=0',
   'auth/v1/settings',
   'rest/v1/rpc/admin_list_management_news'
  ].includes(path)||method==='POST'&&
      path!=='rest/v1/rpc/admin_list_management_news')
   throw new Error('Only three explicit read-only preflight probes are allowed.');
  const headers={apikey:config.key,Accept:'application/json'};
  if(body!==undefined)headers['Content-Type']='application/json';
  let response;
  try{
   response=await customFetch(new URL(path,config.url+'/'),{
    method,headers,body:body===undefined?undefined:JSON.stringify(body),
    signal:AbortSignal.timeout(12000)
   });
  }catch{throw new Error('Staging is unreachable or TLS verification failed.');}
  let payload=null;
  try{
   const str=await response.text();
   if(str&&str.length>20000)throw new Error('Oversized response');
   if(str)payload=JSON.parse(str);
  }catch{throw new Error('Staging responded with unexpected content.');}
  return {ok:response.ok,status:response.status,payload};
 };
}
async function main(){
 const config=validateStagingPreflight(process.env);
 let count=0;
 await runStagingReadiness(config,makeStageReadOnlyClient(config),label=>{
  count++;
  console.log('PASS '+label);
 });
 console.log('PASS '+count+' baseline staging checks. This is not a recovery or permission certification.');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 main().catch(()=>{
  // No URLs, account details, secrets, SQL responses, tokens or identifiers.
  console.error('BLOCKED: isolated Supabase staging readiness could not be verified.');
  process.exitCode=1;
 });
}
