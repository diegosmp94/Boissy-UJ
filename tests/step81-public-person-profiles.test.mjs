import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 isPublicEducatorId,educatorPublicRoute,isPublishedEducatorRole,
 publicIndividualProfileAllowed,loadPublishedEducatorProfile,renderPublicEducatorProfile
} from '../educator-profile-page.mjs';
import {renderPublicEducatorCard} from '../team-profile-data.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610260018_public_person_profile_consent.sql');
const id='51e41d5a-2c16-4955-9c12-b1ad8fe60a92';
const tid='32c74e33-f765-40ad-85c1-b1ba6f983272';
const coach={id,team_id:tid,display_name:'Coach autorisé',
 person_kind:'coach',role_label:'Entraîneur principal',
 biography:'Parcours approuvé.',published:true,consent_confirmed:true,
 profile_visible:true,profile_consent_confirmed:true};
const team={id:tid,code:'a',discipline:'football'};
function fetcherFor(people=[coach],teams=[team]){
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  return {ok:true,json:async()=>url.includes('/team_public_people?')?people:teams};
 };
 return {fetcher,calls};
}
test('separate individual consent never follows roster publication implicitly',()=>{
 assert.equal(publicIndividualProfileAllowed(coach),true);
 for(const patch of [{profile_visible:false},{profile_consent_confirmed:false},
  {published:false},{consent_confirmed:false},{}]){
  const value=Object.keys(patch).length?{...coach,...patch}:
   {id,person_kind:'coach',published:true,consent_confirmed:true};
  assert.equal(publicIndividualProfileAllowed(value),false);
 }
 assert.ok(isPublishedEducatorRole(coach));
 assert.ok(isPublishedEducatorRole({...coach,person_kind:'staff',role_label:'Préparateur physique'}));
 assert.ok(!isPublishedEducatorRole({...coach,person_kind:'staff',role_label:'Responsable matériel'}));
});
test('educator hash route requires strict UUID',()=>{
 assert.equal(isPublicEducatorId(id),true);
 assert.equal(educatorPublicRoute(id),'#/educateurs/'+id);
 for(const bad of ['coach','../joueurs','javascript:alert(1)','not-an-id']){
  assert.equal(isPublicEducatorId(bad),false);
  assert.throws(()=>educatorPublicRoute(bad),/invalide/);
 }
});
test('public educator loader strictly filters profile approvals and known club team',async()=>{
 const {fetcher,calls}=fetcherFor();
 const result=await loadPublishedEducatorProfile(id,{fetcher});
 assert.deepEqual(result.person,coach);
 assert.equal(result.team.name,'Seniors A');
 assert.equal(calls.length,2);
 assert.ok(calls.every(c=>c.options.method==='GET'&&c.options.cache==='no-store'));
 for(const term of ['published=eq.true','consent_confirmed=eq.true',
   'profile_visible=eq.true','profile_consent_confirmed=eq.true','person_kind=in.']){
  assert.ok(calls[0].url.includes(term),term);
 }
 assert.doesNotMatch(calls.map(c=>c.url).join(' '),/auth.users|profiles|app_private|user_roles/);
 for(const patch of [{profile_visible:false},{consent_confirmed:false},
   {person_kind:'staff',role_label:'Responsable matériel'}]){
  const src=fetcherFor([{...coach,...patch}]);
  assert.equal(await loadPublishedEducatorProfile(id,{fetcher:src.fetcher}),null);
 }
 const wrong=fetcherFor([coach],[{...team,discipline:'futsal'}]);
 assert.equal(await loadPublishedEducatorProfile(id,{fetcher:wrong.fetcher}),null);
});
function dom(){
 return {createElement(tag){
  return {tagName:tag.toUpperCase(),children:[],attributes:{},className:'',textContent:'',
   setAttribute(k,v){this.attributes[k]=String(v);},
   append(...rows){this.children.push(...rows);},
   replaceChildren(...rows){this.children=[...rows];}};
 }};
}
test('published educator gets a link; unpublished individual fiche remains static',()=>{
 const old=globalThis.document;globalThis.document=dom();
 try{
  const linked=renderPublicEducatorCard(coach);
  assert.equal(linked.tagName,'A');
  assert.equal(linked.href,educatorPublicRoute(id));
  const hidden=renderPublicEducatorCard({...coach,profile_visible:false});
  assert.equal(hidden.tagName,'ARTICLE');
  const root=globalThis.document.createElement('div');
  renderPublicEducatorProfile(root,{person:coach,team:{name:'Seniors A',slug:'seniors-a',discipline:'football',code:'a'}});
  const walk=(n)=>[n,...n.children.flatMap(walk)];
  const text=walk(root).map(n=>n.textContent).join(' ');
  assert.match(text,/Coach autorisé/);
  assert.match(text,/Entraîneur principal/);
  assert.doesNotMatch(text,/email|téléphone|date de naissance|mot de passe|auth\.users/i);
  assert.equal(walk(root).filter(n=>n.tagName==='IMG').length,0);
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});
test('migration locks individual publication to AAL2 and resets rights on roster edits',()=>{
 for(const fragment of [
  'profile_visible boolean not null default false',
  'profile_consent_confirmed boolean not null default false',
  'team_person_profile_separate_consent',
  'new.profile_visible:=false',
  'new.profile_consent_confirmed:=false',
  'team_person_revoke_profile_on_edit',
  'app_private.is_admin()',
  'p_expected_updated_at',
  "raise exception 'Profile changed: reload before saving'",
  'admin_set_public_person_profile',
  'team_public_people_audit',
  "'withdraw_individual_profile'",
  "grant execute on function public.admin_set_public_person_profile"
 ])assert.ok(sql.includes(fragment),fragment);
 assert.doesNotMatch(sql,/auth\.users\s+(?:insert|update)|select\s+\*\s+from\s+auth\.users|grant\s+(?:insert|update|delete)\s+on\s+public\.team_public_people/i);
});
test('admin panel and router expose no individual fiche without separate authorization',()=>{
 const editor=read('team-person-editor.mjs'),app=read('app.js'),teamCode=read('team-profile-data.mjs');
 assert.match(editor,/admin_set_public_person_profile/);
 assert.match(editor,/profileCheck\.checked/);
 assert.match(editor,/profileConfirmation!==fingerprint/);
 assert.match(editor,/verifyAdmin\(api,userId\)/);
 assert.match(teamCode,/publicIndividualProfileAllowed\(person\)/);
 assert.match(teamCode,/educatorPublicRoute\(person\.id\)/);
 assert.match(app,/isPublicEducatorId\(path\.slice\('\/educateurs\/'\.length\)\)/);
 assert.match(app,/mountPublicEducatorProfile\(publicEducatorId\)/);
 assert.doesNotMatch(read('educator-profile-page.mjs'),/service_role|sb_secret_|innerHTML|method:'POST'|\.insert\(|\.delete\(/i);
});
