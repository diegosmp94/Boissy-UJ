import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ADMIN_MODULES} from '../admin-center.mjs';
import {normalizeOfficialTitle,officeTitleDraft,validateOfficialTitle,
 canAssignOfficialTitle} from '../admin-office-titles-rules.mjs';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610280001_admin_custom_official_titles.sql');
const ui=read('admin-office-titles.mjs'),auth=read('auth.mjs');
test('club office labels are freely customizable with validation',()=>{
 assert.equal(normalizeOfficialTitle('  Directeur   sportif  '),'Directeur sportif');
 const p=officeTitleDraft({label:'  Président  ',singleHolder:true,active:true,sortOrder:'2'});
 assert.deepEqual(p,{label:'Président',singleHolder:true,active:true,sortOrder:2});
 assert.ok(Object.isFrozen(p));
 assert.equal(validateOfficialTitle(p),null);
 for(const label of ['','P','X'.repeat(81),'A\nB'])
  assert.ok(validateOfficialTitle({label,sortOrder:1}));
 for(const order of [-1,10000,1.5,NaN])
  assert.ok(validateOfficialTitle({label:'Directeur sportif',sortOrder:order}));
});
test('single holder and duplicate prevention are checked in UI before server call',()=>{
 const t={id:'t',active:true,single_holder:true},person={user_id:'a'};
 assert.equal(canAssignOfficialTitle(t,person,[]),true);
 assert.equal(canAssignOfficialTitle(t,person,[{title_id:'t',user_id:'b'}]),false);
 assert.equal(canAssignOfficialTitle({...t,single_holder:false},person,[{title_id:'t',user_id:'b'}]),true);
 assert.equal(canAssignOfficialTitle({...t,active:false},person,[]),false);
 assert.equal(canAssignOfficialTitle(t,person,[{title_id:'t',user_id:'a'}]),false);
 assert.equal(canAssignOfficialTitle(t,null,[]),false);
});
test('office titles are private data and are never roles or authorizations',()=>{
 for(const name of ['club_office_titles','club_office_assignments','club_office_audit']){
  assert.ok(sql.includes('app_private.'+name));
  assert.match(sql,new RegExp('alter table app_private\\.'+name+' enable row level security;'));
  assert.match(sql,new RegExp('revoke all on app_private\\.'+name+' from public,\\s*anon,\\s*authenticated;'));
 }
 assert.match(sql,/function public\.admin_office_save_title/);
 assert.match(sql,/function public\.admin_office_set_assignment/);
 assert.match(sql,/function public\.member_my_official_titles/);
 assert.match(sql,/app_private\.is_admin\(\)/);
 assert.match(sql,/v_title\.single_holder/);
 assert.match(sql,/for update/);
 assert.match(sql,/join public\.user_roles r on r\.user_id=a\.user_id and r\.role='admin'/);
 assert.match(sql,/where r\.user_id=p_user_id and r\.role='admin'/);
 assert.match(sql,/grant execute on function public\.admin_office_set_assignment\(uuid,uuid,boolean\) to authenticated/);
 assert.doesNotMatch(sql,/insert into public\.user_roles|update public\.user_roles|delete from public\.user_roles/);
 assert.doesNotMatch(sql,/insert into auth\.users|sk_live_|service_role_key/i);
});
test('admin-only views and mutations recheck MFA on both client and RPC',()=>{
 assert.ok(ADMIN_MODULES.some(x=>x.id==='office-titles'));
 assert.match(read('admin-center.mjs'),/case 'office-titles':void mountAdminOfficeTitles\(view,api,verified\.userId\)/);
 assert.match(ui,/adminSessionStatus\(api,userId\)/);
 for(const action of [
  'admin_office_list_titles','admin_office_list_administrators',
  'admin_office_list_assignments','admin_office_save_title',
  'admin_office_set_assignment']) assert.ok(ui.includes(action),action);
 assert.match(ui,/if\(!await verified\(\)\)/);
 assert.match(ui,/void|status/);
 assert.doesNotMatch(ui,/innerHTML|auth\.admin\.|user_metadata|service_role|localStorage/);
 for(const fn of ['admin_office_list_titles','admin_office_list_administrators',
  'admin_office_list_assignments','admin_office_save_title',
  'admin_office_set_assignment']){
  const start=sql.indexOf('create or replace function public.'+fn);
  assert.ok(start>=0,fn);
  const end=sql.indexOf('$fn$;',start);
  const section=sql.slice(start,end);
  assert.match(section,/auth\.uid\(\)/);
  assert.match(section,/app_private\.is_admin\(\)/);
 }
});
test('an admin sees only their own nominated titles, not directory access',()=>{
 assert.match(auth,/member_my_official_titles/);
 assert.match(auth,/if\(roles\.includes\("admin"\)\)/);
 assert.match(auth,/Mes fonctions au club/);
 assert.match(sql,/where a\.user_id=v_user and t\.active/);
 assert.match(sql,/if not exists\(select 1 from public\.user_roles where user_id=v_user and role='admin'\)/);
});
