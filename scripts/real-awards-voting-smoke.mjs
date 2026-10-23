/**
 * DESTRUCTIVE ON TEST DATA ONLY: staging acceptance of private Premium Awards ballots.
 * Never accepts the production project, service-role key, or public identities.
 * Requires two consenting test accounts, a staging-only verified-entitlement fixture
 * and an open test Awards nomination. Never runs from GitHub CI.
 */
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {decodeJwtPayload} from './real-permissions-smoke.mjs';

const PRODUCTION_REF='dahzewvbybujqhogumte';
const ACK='YES_WRITE_AWARD_TEST_BALLOTS_ON_ISOLATED_STAGING';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateVotingTestTarget(env){
 if(env.BOISSY_AWARD_TEST_ACK!==ACK)
  throw new Error('Explicit isolated staging vote-test acknowledgement is required.');
 const ref=String(env.BOISSY_AWARD_TEST_PROJECT_REF||'');
 if(!/^[a-z0-9]{20}$/.test(ref)||ref===PRODUCTION_REF)
  throw new Error('A separate, non-production Supabase project reference is mandatory.');
 let url;
 try{url=new URL(env.BOISSY_AWARD_TEST_URL||'');}
 catch{throw new Error('Invalid staging Supabase URL.');}
 if(url.protocol!=='https:'||url.hostname!==ref+'.supabase.co'||
   url.pathname!=='/'||url.username||url.password||url.search||url.hash)
  throw new Error('Staging URL must exactly match the isolated project reference.');
 const key=String(env.BOISSY_AWARD_TEST_KEY||'');
 if(key.startsWith('sb_secret_')||!key)
  throw new Error('Private keys cannot be used for acceptance tests.');
 if(key.startsWith('eyJ')){
  let claims;try{claims=decodeJwtPayload(key);}catch{
   throw new Error('Invalid legacy anon key.');
  }
  if(claims.role!=='anon'||claims.ref&&claims.ref!==ref)
   throw new Error('Only the staging anon key is allowed.');
 }else if(!key.startsWith('sb_publishable_'))
  throw new Error('Only a staging publishable or anon key is allowed.');
 let personas,fixtures;
 try{personas=JSON.parse(env.BOISSY_AWARD_TEST_PERSONAS_JSON||'');}
 catch{throw new Error('Missing test persona configuration.');}
 try{fixtures=JSON.parse(env.BOISSY_AWARD_TEST_FIXTURES_JSON||'');}
 catch{throw new Error('Missing award fixtures.');}
 for(const name of ['premium','supporter']){
  const p=personas?.[name];
  if(!p||typeof p.email!=='string'||!p.email.includes('@')||
    typeof p.password!=='string'||p.password.length<8)
   throw new Error('Missing verified '+name+' test account.');
 }
 if(personas.premium.email.trim().toLowerCase()===personas.supporter.email.trim().toLowerCase())
  throw new Error('Test accounts must be different people.');
 for(const keyName of ['awardId','nomineeId','foreignNomineeId']){
  if(!UUID.test(fixtures?.[keyName]))
   throw new Error('Staging award fixtures must be real UUIDs: '+keyName+'.');
 }
 if(fixtures.nomineeId===fixtures.foreignNomineeId)
  throw new Error('The mismatched nomination fixture must be distinct.');
 return {url:url.origin,key,personas,fixtures};
}
export function voteIsDenied(reply,expectedCode){
 return reply.ok===false&&
  (reply.payload?.code===expectedCode||
    (expectedCode==='42501'&&[401,403].includes(reply.status)));
}
function success(reply,label){
 if(!reply?.ok)throw new Error(label+' failed (HTTP '+reply?.status+').');
 return reply.payload;
}
function check(reply,expected,label){
 if(!voteIsDenied(reply,expected))
  throw new Error(label+' did not refuse the operation as required.');
}
export async function runVotingRecipe(api,config,record=()=>{}){
 const users={};
 let submitted=false,fixturesVerified=false;
 const rpc=(token,name,body)=>api.request('rest/v1/rpc/'+name,{
  method:'POST',token,body
 });
 const status=(token)=>rpc(token,'member_my_award_vote',{p_award_id:config.fixtures.awardId});
 try{
  for(const name of ['premium','supporter']){
   const p=config.personas[name];
   const session=success(await api.request('auth/v1/token?grant_type=password',{
    method:'POST',body:{email:p.email,password:p.password}
   }),name+' sign-in');
   if(!session?.access_token||!session.user?.id)
    throw new Error('Staging test sign-in did not establish an Auth identity.');
   const claims=decodeJwtPayload(session.access_token);
   if(claims.aal!=='aal1'||claims.sub!==session.user.id)
    throw new Error('Staging test account identity cannot be verified.');
   const verified=success(await api.request('auth/v1/user',{
    token:session.access_token
   }),name+' own identity');
   if(verified.id!==session.user.id||!(verified.email_confirmed_at||verified.confirmed_at))
    throw new Error('Staging test account has no verified email.');
   users[name]={token:session.access_token,id:verified.id};
  }
  if(users.premium.id===users.supporter.id)
   throw new Error('Both staging identities resolve to the same account.');
  record('two separate confirmed test users');
  const a=users.premium.token,b=users.supporter.token,f=config.fixtures;
  if(success(await status(a),'premium initial vote')!==null||
     success(await status(b),'supporter initial vote')!==null)
   throw new Error('Test fixtures must begin without active ballots.');
  fixturesVerified=true;
  record('empty ballots for both test accounts');
  check(await rpc(null,'member_cast_award_vote',{
   p_award_id:f.awardId,p_nominee_id:f.nomineeId
  }),'42501','anonymous ballot');
  record('anonymous ballot denied');
  check(await rpc(b,'member_cast_award_vote',{
   p_award_id:f.awardId,p_nominee_id:f.nomineeId
  }),'42501','non-premium ballot');
  record('supporter without billing entitlement denied');
  check(await rpc(a,'member_cast_award_vote',{
   p_award_id:f.awardId,p_nominee_id:f.foreignNomineeId
  }),'42501','foreign-category nominee');
  record('wrong nomination cannot be chosen');
  const cast=success(await rpc(a,'member_cast_award_vote',{
   p_award_id:f.awardId,p_nominee_id:f.nomineeId
  }),'eligible Premium ballot');
  if(cast!==true)throw new Error('Ballot insert not confirmed.');
  submitted=true;record('eligible Premium ballot recorded');
  check(await rpc(a,'member_cast_award_vote',{
   p_award_id:f.awardId,p_nominee_id:f.nomineeId
  }),'23505','duplicate ballot');
  record('duplicate ballot rejected');
  if(success(await status(a),'own ballot')!==f.nomineeId||
    success(await status(b),'unrelated ballot')!==null)
   throw new Error('Private ballot ownership is not isolated.');
  record('only the ballot owner may read their selection');
  if(success(await rpc(b,'member_withdraw_award_vote',{
   p_award_id:f.awardId
  }),'other user withdrawal')!==false)
   throw new Error('Another account withdrew a foreign ballot.');
  record('unrelated account cannot remove vote');
  if(success(await rpc(a,'member_withdraw_award_vote',{
   p_award_id:f.awardId
  }),'own withdrawal')!==true)
   throw new Error('Own ballot cannot be withdrawn.');
  submitted=false;
  if(success(await status(a),'withdrawal verification')!==null)
   throw new Error('Ballot still exists after withdrawal.');
  record('own ballot withdrawn and private data removed');
 }finally{
  // Cleanup test data even when a broken backend accepted a forbidden cast.
  // Only safe after we verified that both test accounts began with no ballot.
  if(fixturesVerified)for(const name of ['premium','supporter']){
   if(!users[name]?.token)continue;
   try{await rpc(users[name].token,'member_withdraw_award_vote',{
    p_award_id:config.fixtures.awardId
   });}catch{}
  }
  for(const name of ['premium','supporter'])if(users[name]?.token){
   try{await api.request('auth/v1/logout',{method:'POST',token:users[name].token});}catch{}
  }
 }
}
export async function stagingVotingApi(config){
 return {request:async(path,{method='GET',token,body}={})=>{
  const headers={apikey:config.key,Accept:'application/json'};
  if(token)headers.Authorization='Bearer '+token;
  if(body!==undefined)headers['Content-Type']='application/json';
  let response;
  try{response=await fetch(new URL(path,config.url+'/'),{
   method,headers,body:body===undefined?undefined:JSON.stringify(body),
   signal:AbortSignal.timeout(15000)
  });}catch{throw new Error('Staging is unreachable.');}
  const data=await response.text();
  let payload=null;
  try{if(data)payload=JSON.parse(data);}catch{}
  return {ok:response.ok,status:response.status,payload};
 }};
}
async function main(){
 const config=validateVotingTestTarget(process.env);
 let count=0;
 await runVotingRecipe(await stagingVotingApi(config),config,label=>{
  count++;console.log('PASS '+label);
 });
 console.log('PASS '+count+' authorized staging voting assertions.');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 main().catch(()=>{
  // Avoid leaking credentials, JWTs, fixture identifiers, or server messages.
  console.error('BLOCKED: isolated staging Awards vote recipe failed.');
  process.exitCode=1;
 });
}
