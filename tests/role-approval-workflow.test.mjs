import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ADVANCED_ROLES,roleSummary,validateRoleRequest,canApproveRoleRequest} from '../role-workflow.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610210013_cumulative_roles_approvals.sql');
const js=read('role-workflow.mjs');
const auth=read('auth.mjs');
const cc=read('control-center.mjs');
const cfg=read('auth-config.mjs');
const spec=read('docs/CAHIER_DES_CHARGES.md');

test('double and triple roles remain additive, never exclusive',()=>{
 assert.deepEqual(ADVANCED_ROLES.map(x=>x.id),['player','coach','admin']);
 assert.deepEqual(roleSummary(['player','coach','admin']),
   ['Joueur','Entraîneur','Administrateur']);
 assert.deepEqual(roleSummary(['supporter','player','player']),['Supporter','Joueur']);
 assert.match(sql,/id uuid primary key default gen_random_uuid\(\)/);
 assert.match(sql,/on conflict\(user_id,role\) do nothing/);
 assert.doesNotMatch(sql,/delete from public\.user_roles where user_id=v_request\.user_id/);
});
test('request respects role/team constraints and never grants a role by itself',()=>{
 assert.equal(validateRoleRequest('coach','team-uuid').valid,true);
 assert.equal(validateRoleRequest('coach',null).valid,false);
 assert.equal(validateRoleRequest('player','team-uuid').valid,false);
 assert.equal(validateRoleRequest('admin',null).valid,true);
 assert.equal(validateRoleRequest('supporter',null).valid,false);
 const code=sql.split('create or replace function public.member_request_role(')[1]
  .split('create or replace function public.admin_decide_role_request(')[0];
 assert.match(code,/v_user uuid := \(select auth\.uid\(\)\)/);
 assert.match(code,/insert into public\.role_requests/);
 assert.doesNotMatch(code,/insert into public\.user_roles/);
 assert.match(code,/Role already granted/);
 assert.match(code,/Coach team permission already granted/);
});
test('pending requests cannot duplicate role and coach-team combinations',()=>{
 assert.match(sql,/role_requests_pending_unique_idx/);
 assert.match(sql,/where status='pending'/);
 assert.match(sql,/coalesce\(team_id,'00000000-0000-0000-0000-000000000000'::uuid\)/);
 assert.match(sql,/constraint coach_needs_team check/);
 assert.match(sql,/constraint never_self_review/);
});
test('only owners and MFA admins can read role requests',()=>{
 assert.match(sql,/alter table public\.role_requests enable row level security/);
 assert.match(sql,/revoke all on public\.role_requests from public,anon,authenticated/);
 assert.match(sql,/grant select on public\.role_requests to authenticated/);
 assert.match(sql,/user_id=\(select auth\.uid\(\)\) or \(select app_private\.is_admin\(\)\)/);
 assert.doesNotMatch(sql,/create policy[^;]*for (insert|update|delete)/i);
});
test('admin with AAL2 and distinct user is required for approval',()=>{
 const decision=sql.split('create or replace function public.admin_decide_role_request(')[1]
   .split('create or replace function public.admin_revoke_member_role(')[0];
 assert.match(decision,/v_admin uuid := \(select auth\.uid\(\)\)/);
 assert.match(decision,/app_private\.is_admin\(\)/);
 assert.match(decision,/for update/);
 assert.match(decision,/v_request\.user_id=v_admin/);
 assert.match(decision,/Self-approval is prohibited/);
 assert.match(decision,/status=case when p_approve then 'approved' else 'rejected' end/);
 assert.equal(canApproveRoleRequest('a',{user_id:'a',status:'pending'},true),false);
 assert.equal(canApproveRoleRequest('a',{user_id:'b',status:'pending'},true),true);
 assert.equal(canApproveRoleRequest('a',{user_id:'b',status:'pending'},false),false);
 assert.equal(canApproveRoleRequest('a',{user_id:'b',status:'rejected'},true),false);
});
test('coach assignment is explicit, preserving previous member roles',()=>{
 assert.match(sql,/if v_request\.requested_role='coach' then/);
 assert.match(sql,/insert into public\.staff_team_assignments/);
 assert.match(sql,/on conflict\(coach_user_id,team_id\)/);
 assert.match(sql,/do update set active=true/);
 assert.match(spec,/Une attribution n'est pas implicite/);
});
test('revocation is scoped; cannot remove final administrator',()=>{
 const revoke=sql.split('create or replace function public.admin_revoke_member_role(')[1]
   .split('-- Remove stale invitation visibility')[0];
 assert.match(revoke,/p_user_id=v_actor/);
 assert.match(revoke,/pg_catalog\.pg_advisory_xact_lock/);
 assert.match(revoke,/Last administrator cannot be revoked/);
 assert.match(revoke,/if p_role='coach' and p_team_id is not null then/);
 assert.match(revoke,/update public\.staff_team_assignments set active=false/);
 assert.match(revoke,/delete from public\.user_roles where user_id=p_user_id and role=p_role/);
 assert.match(revoke,/update app_private\.team_player_memberships set active=false/);
 assert.match(revoke,/response='cancelled'/);
});
test('approvals and revocations have private immutable audit',()=>{
 assert.match(sql,/create table if not exists app_private\.role_change_audit/);
 assert.match(sql,/alter table app_private\.role_change_audit enable row level security/);
 assert.match(sql,/revoke all on app_private\.role_change_audit from public,anon,authenticated/);
 assert.match(sql,/action text not null check\(action in/);
 assert.match(sql,/insert into app_private\.role_change_audit/g);
 assert.match(sql,/action\)/);
 assert.doesNotMatch(sql,/grant (select|insert|update|delete) on app_private\.role_change_audit/i);
});
test('revoked players lose access to stale invitations',()=>{
 assert.match(sql,/create or replace function public\.player_my_callups\(\)/);
 assert.match(sql,/tm\.active=true/);
 assert.match(sql,/r\.role='player'/);
 assert.match(sql,/c\.player_user_id=\(select auth\.uid\(\)\)/);
});
test('UI is a harmless preview, member RPC only mounted if auth is enabled',()=>{
 assert.match(cc,/mountRoleManagementPreview\(root\)/);
 assert.match(auth,/mountMemberRoleRequests\(account,api,user\.id\)/);
 assert.match(js,/if\(!supabaseConfig\.enabled\|\|!api\|\|!userId\)return/);
 assert.match(js,/api\.rpc\('member_request_role'/);
 assert.doesNotMatch(js,/api\.rpc\('admin_decide_role_request'/);
 assert.doesNotMatch(js,/api\.rpc\('admin_revoke_member_role'/);
 assert.match(js,/Aucune donnée n’est envoyée à Supabase/);
 assert.match(cfg,/adminEnabled:\s*true/);
});
