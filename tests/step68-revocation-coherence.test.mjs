import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610260008_cancel_stale_role_requests.sql');
const member=read('auth.mjs'),admin=read('admin-center.mjs');
const before=(start,end)=>sql.slice(sql.indexOf(start),sql.indexOf(end));

test('revocation cancels only pending requests for the affected role / optional team',()=>{
 const fn=before('CREATE OR REPLACE FUNCTION public.admin_revoke_member_role','CREATE OR REPLACE FUNCTION public.admin_set_coach_team_assignment');
 assert.match(fn,/v_actor uuid := \(select auth\.uid\(\)\)/);
 assert.match(fn,/app_private\.is_admin\(\)/);
 assert.match(fn,/p_user_id=v_actor/);
 assert.match(fn,/update public\.role_requests set status='cancelled'\s+where user_id=p_user_id and requested_role=p_role and status='pending'\s+and \(p_team_id is null or team_id=p_team_id\)/);
 assert.ok(fn.indexOf("update public.role_requests set status='cancelled'")<
  fn.indexOf("if p_role='coach' and p_team_id is not null then"));
 assert.match(fn,/where coach_user_id=p_user_id and team_id=p_team_id and active=true/);
 assert.match(fn,/delete from public\.user_roles where user_id=p_user_id and role=p_role/);
 assert.match(fn,/if p_role='coach' then[\s\S]*?set active=false/);
 assert.match(fn,/elsif p_role='player' then[\s\S]*?set active=false/);
 assert.match(fn,/pg_advisory_xact_lock\(20261021,314\)/);
 assert.match(fn,/insert into app_private\.role_change_audit/);
 assert.doesNotMatch(fn,/delete from public\.user_roles where user_id=p_user_id\s*;/);
});

test('coach team withdrawal cancels only that pending team grant before role lock',()=>{
 const fn=before('CREATE OR REPLACE FUNCTION public.admin_set_coach_team_assignment','revoke all on function public.admin_revoke_member_role');
 assert.match(fn,/not coalesce\(\(select app_private\.is_admin\(\)\),false\)/i);
 assert.match(fn,/if p_coach_user_id=v_actor then/i);
 assert.match(fn,/if not p_active then\s+update public\.role_requests set status='cancelled'\s+where user_id=p_coach_user_id and requested_role='coach'\s+and team_id=p_team_id and status='pending';/);
 assert.ok(fn.indexOf("status='cancelled'")<fn.toLowerCase().indexOf("for share of r"));
 assert.match(fn,/for share of r/i);
 assert.match(fn,/on conflict \(coach_user_id,team_id\)/i);
 assert.match(fn,/app_private\.coach_team_assignment_audit/);
 assert.doesNotMatch(fn,/delete from public\.user_roles/);
});

test('no new grants or direct account writes are provided to the browser',()=>{
 assert.match(sql,/^begin;/m);assert.match(sql,/^commit;/m);
 for(const spec of [
  ['admin_revoke_member_role','uuid,text,uuid'],
  ['admin_set_coach_team_assignment','uuid,uuid,boolean']
 ]){
  assert.ok(sql.includes('revoke all on function public.'+spec[0]+'('+spec[1]+')'));
  assert.ok(sql.includes('grant execute on function public.'+spec[0]+'('+spec[1]+')'));
 }
 assert.doesNotMatch(sql,/\b(?:create table|drop table|alter table|truncate table)\b/i);
 assert.doesNotMatch(sql,/grant execute on function .* to (?:anon|public)\b/i);
});

test('Mon espace revalidates roles and team scopes on focus/visibility',()=>{
 assert.match(member,/recheckOnReturn/);
 assert.match(member,/document\.visibilityState==='hidden'/);
 assert.match(member,/root\.querySelector\('\.auth-signed-in'\)/);
 assert.match(member,/sessionViewGeneration\+=1;/);
 assert.match(member,/root\.replaceChildren\(el\('p','auth-loading','Actualisation sécurisée/);
 assert.match(member,/void showSession\(root,api\)/);
 assert.match(member,/window\.addEventListener\('focus',recheckOnReturn\)/);
 assert.match(member,/document\.addEventListener\('visibilitychange',recheckOnReturn\)/);
 assert.match(member,/window\.removeEventListener\('focus',recheckOnReturn\)/);
 assert.match(member,/document\.removeEventListener\('visibilitychange',recheckOnReturn\)/);
 assert.match(member,/mounted\?\.cleanup\?\.\(\)/);
});

test('admin Center drops old protected DOM and rechecks identity/role/AAL2',()=>{
 assert.match(admin,/activeReturnCleanup\?\.\(\)/);
 assert.match(admin,/root\.querySelector\('\.real-admin-layout'\)/);
 assert.match(admin,/root\.replaceChildren\(el\('p','admin-empty','Nouvelle vérification des autorisations et du MFA/);
 assert.match(admin,/void mountAdminCenter\(getClient\)/);
 assert.match(admin,/window\.addEventListener\('focus',revalidateOnReturn\)/);
 assert.match(admin,/document\.addEventListener\('visibilitychange',revalidateOnReturn\)/);
 assert.match(admin,/window\.removeEventListener\('focus',revalidateOnReturn\)/);
 assert.match(admin,/document\.removeEventListener\('visibilitychange',revalidateOnReturn\)/);
 assert.match(admin,/const verified=await adminSessionStatus\(api\)/);
 assert.match(admin,/if\(!canOpenAdmin\(verified,supabaseConfig\.adminEnabled\)\)/);
});
