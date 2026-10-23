import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 validateNewsStagingTarget,isForbiddenResponse,validateNewsHistory,
 runNewsRevisionAccessRecipe,NEWS_STAGE_ACK
} from '../scripts/real-news-revisions-smoke.mjs';

const source=readFileSync(new URL('../scripts/real-news-revisions-smoke.mjs',import.meta.url),'utf8');
const ARTICLE='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const config={
 BOISSY_NEWS_TEST_ACK:NEWS_STAGE_ACK,
 BOISSY_NEWS_TEST_PROJECT_REF:'abababababababababab',
 BOISSY_NEWS_TEST_URL:'https://abababababababababab.supabase.co/',
 BOISSY_NEWS_TEST_PUBLIC_KEY:'sb_publishable_staging-example',
 BOISSY_NEWS_TEST_PERSONAS_JSON:JSON.stringify({
  admin:{email:'admin@example.invalid',password:'fixture-password-only',
   totpSecret:'JBSWY3DPEHPK3PXP'},
  supporter:{email:'supporter@example.invalid',password:'fixture-password-only'}
 }),
 BOISSY_NEWS_TEST_FIXTURES_JSON:JSON.stringify({articleId:ARTICLE})
};
const target=(overrides={})=>validateNewsStagingTarget({...config,...overrides});
test('strict staging gate rejects production, partial URLs, secret keys and no acknowledgement',()=>{
 assert.equal(target().ref,config.BOISSY_NEWS_TEST_PROJECT_REF);
 for(const value of [
  {BOISSY_NEWS_TEST_ACK:''},
  {BOISSY_NEWS_TEST_PROJECT_REF:'dahzewvbybujqhogumte'},
  {BOISSY_NEWS_TEST_URL:'https://dahzewvbybujqhogumte.supabase.co/'},
  {BOISSY_NEWS_TEST_URL:'http://abababababababababab.supabase.co/'},
  {BOISSY_NEWS_TEST_URL:'https://abababababababababab.supabase.co/other'},
  {BOISSY_NEWS_TEST_URL:'https://abababababababababab.supabase.co/?debug=true'},
  {BOISSY_NEWS_TEST_PUBLIC_KEY:'sb_secret_fake'},
  {BOISSY_NEWS_TEST_PUBLIC_KEY:'rk_test_fake'},
  {BOISSY_NEWS_TEST_PUBLIC_KEY:'bad'}
 ])assert.throws(()=>target(value),undefined,JSON.stringify(value));
});
test('staging cannot reuse identities or omit MFA or dedicated article fixture',()=>{
 const p=JSON.parse(config.BOISSY_NEWS_TEST_PERSONAS_JSON);
 p.supporter.email=p.admin.email.toUpperCase();
 assert.throws(()=>target({BOISSY_NEWS_TEST_PERSONAS_JSON:JSON.stringify(p)}),/separate/);
 delete p.admin.totpSecret;
 p.supporter.email='supporter@example.invalid';
 assert.throws(()=>target({BOISSY_NEWS_TEST_PERSONAS_JSON:JSON.stringify(p)}),/TOTP/);
 assert.throws(()=>target({BOISSY_NEWS_TEST_FIXTURES_JSON:JSON.stringify({articleId:'invalid'})}),/UUID/);
});
test('history RPC output is bounded to explicit public text fields with no other user metadata',()=>{
 const entry={revision_id:12,recorded_at:'2026-10-23T16:00:00.000Z',
  action:'edit_publish',title:'Publication autorisée',excerpt:'Extrait',body:'Contenu',
  was_published:true};
 assert.equal(validateNewsHistory([entry,{...entry,revision_id:3}]),true);
 for(const broken of [
  [],Array.from({length:41},(_,i)=>({...entry,revision_id:100-i})),
  [{...entry,author_user_id:'private'}],
  [{...entry,actor_user_id:'private'}],
  [{...entry,previous_state:{private:true}}],
  [{...entry,revision_id:'12'}],
  [{...entry,recorded_at:'NaN'}],
  [entry,{...entry,revision_id:15}]
 ])assert.throws(()=>validateNewsHistory(broken));
});
test('permission helper never treats successful response, not-found or generic server failure as denied',()=>{
 assert.equal(isForbiddenResponse({ok:false,status:403,payload:{code:'42501'}}),true);
 assert.equal(isForbiddenResponse({ok:false,status:401,payload:{code:'PGRST301'}}),true);
 assert.equal(isForbiddenResponse({ok:false,status:404,payload:{code:'PGRST202'}}),false);
 assert.equal(isForbiddenResponse({ok:true,status:200,payload:false}),false);
 assert.equal(isForbiddenResponse({ok:false,status:500,payload:{code:'P0001'}}),false);
});
const token=(id,aal)=>'fixture.'+
 Buffer.from(JSON.stringify({sub:id,aal,role:'authenticated'})).toString('base64url')+
 '.signature';
function fakeApi({exposeSupporter=false,exposeAal1=false,includeSensitiveFields=false,
  allowInvalidRestore=false,missingFixture=false}={}){
 const adminId='admin-user',supporterId='supporter-user';
 const sessions={
  [token(adminId,'aal1')]:{id:adminId,aal:'aal1'},
  [token(adminId,'aal2')]:{id:adminId,aal:'aal2'},
  [token(supporterId,'aal1')]:{id:supporterId,aal:'aal1'}
 };
 const calls=[];
 const success=payload=>({ok:true,status:200,payload});
 const denied=()=>({ok:false,status:403,payload:{code:'42501'}});
 const invalid=()=>({ok:false,status:400,payload:{code:'22023'}});
 return {calls,request:async(path,{method='GET',token:jwt,body={}}={})=>{
  const s=sessions[jwt],admin=s?.id===adminId;
  calls.push({path,method,aal:s?.aal||'none',admin,articleId:body?.p_post_id??null});
  if(path==='auth/v1/token?grant_type=password'){
   const id=body.email.startsWith('admin@')?adminId:supporterId;
   return success({access_token:token(id,'aal1'),user:{id}});
  }
  if(path==='auth/v1/user'){
   return success({id:s?.id,email_confirmed_at:'2026-10-23T16:00:00.000Z'});
  }
  if(path==='auth/v1/factors')return success({totp:[{id:'totp-staging',status:'verified'}]});
  if(path.endsWith('/challenge'))return success({id:'challenge-staging'});
  if(path.endsWith('/verify')){
   assert.match(body.code,/^\d{6}$/);
   return success({access_token:token(adminId,'aal2')});
  }
  if(path==='auth/v1/logout')return success(null);
  if(path.endsWith('/admin_news_revisions_ready'))return success(admin&&s.aal==='aal2');
  if(path.endsWith('/admin_list_management_news'))return success(missingFixture?[]:[
   {id:ARTICLE,content_kind:'article',visibility:'public'}
  ]);
  if(path.endsWith('/admin_list_news_revisions')){
   if(!admin&&!exposeSupporter)return denied();
   if(admin&&s.aal==='aal1'&&!exposeAal1)return denied();
   const row={revision_id:3,recorded_at:'2026-10-23T16:00:00.000Z',
    action:'create_draft',title:'Article de test',excerpt:'Extrait',
    body:'Texte de test',was_published:false};
   if(includeSensitiveFields)row.actor_user_id='private';
   return success([row]);
  }
  if(path.endsWith('/admin_restore_news_revision')){
   if(!admin)return denied();
   return allowInvalidRestore?success(true):invalid();
  }
  throw new Error('Unexpected endpoint: '+path);
 }};
}
test('offline simulation exercises real login, distinct accounts, denial, TOTP and protected read',async()=>{
 const cfg=target(),api=fakeApi(),messages=[];
 await runNewsRevisionAccessRecipe(api,cfg,s=>messages.push(s));
 assert.equal(messages.length,6);
 assert.ok(messages.some(x=>x.includes('MFA')));
 assert.ok(messages.some(x=>x.includes('sanitized')));
 const restoreCalls=api.calls.filter(x=>x.path.includes('admin_restore_news_revision'));
 assert.equal(restoreCalls.length,2);
 assert.ok(restoreCalls.every(x=>x.articleId===null));
 assert.equal(api.calls.filter(x=>x.path==='auth/v1/logout').length,2);
});
test('offline simulation detects privacy leakage and administrative AAL1 bypass',async()=>{
 await assert.rejects(
  ()=>runNewsRevisionAccessRecipe(fakeApi({exposeSupporter:true}),target()),
  /permission isolation failed/
 );
 await assert.rejects(
  ()=>runNewsRevisionAccessRecipe(fakeApi({exposeAal1:true}),target()),
  /permission isolation failed/
 );
 await assert.rejects(
  ()=>runNewsRevisionAccessRecipe(fakeApi({includeSensitiveFields:true}),target()),
  /unexpected private fields/
 );
});
test('offline simulation rejects unknown fixture and unexpected restoration success',async()=>{
 await assert.rejects(
  ()=>runNewsRevisionAccessRecipe(fakeApi({missingFixture:true}),target()),
  /fixture is missing/
 );
 await assert.rejects(
  ()=>runNewsRevisionAccessRecipe(fakeApi({allowInvalidRestore:true}),target()),
  /did not fail safely/
 );
});
test('recipe never calls a real article restore, changes roles or uses elevated API secrets',()=>{
 assert.doesNotMatch(source,/service_role|grant execute|\.update\(|\.insert\(|\.delete\(/i);
 assert.match(source,/p_post_id:null,p_revision_id:1,p_expected_updated_at:null/);
 assert.match(source,/BOISSY_NEWS_TEST_PROJECT_REF/);
 assert.match(source,/NEWS_STAGE_PRODUCTION_REF/);
 assert.match(source,/auth\/v1\/logout/);
 assert.match(source,/new URL\(path,config.url\+'\/'\)/);
});
