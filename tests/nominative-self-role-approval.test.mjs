import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mayDecideRequest,moderateMessage} from '../admin-role-moderation.mjs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610280003_nominative_sport_self_approval.sql');
const ui=read('admin-role-moderation.mjs');
const member=read('role-workflow.mjs');

test('default approval separation remains for any account and for protected admin role',()=>{
 const owner='owner', other='another';
 for(const role of ['player','coach','admin']){
  const request={user_id:owner,status:'pending',requested_role:role};
  assert.equal(mayDecideRequest(owner,request),false,'default own '+role);
  assert.equal(mayDecideRequest(other,request),true,'independent approver '+role);
 }
 assert.equal(mayDecideRequest(owner,{user_id:owner,status:'pending',requested_role:'admin'},true),false);
 assert.equal(mayDecideRequest(owner,{user_id:owner,status:'approved',requested_role:'coach'},true),false);
 assert.equal(mayDecideRequest(owner,{user_id:owner,status:'pending',requested_role:'supporter'},true),false);
 assert.equal(mayDecideRequest(null,{user_id:owner,status:'pending',requested_role:'coach'},true),false);
});

test('allowlist bit may reveal approval controls only for own sports-role requests',()=>{
 const owner='owner';
 for(const role of ['player','coach']){
  const r={user_id:owner,status:'pending',requested_role:role};
  assert.equal(mayDecideRequest(owner,r,true),true);
  assert.equal(mayDecideRequest(owner,r,false),false);
  assert.equal(mayDecideRequest(owner,r,1),false);
 }
 assert.match(moderateMessage(true),/Cliquer à nouveau/);
 assert.match(ui,/admin_can_self_approve_role_requests/);
 assert.match(ui,/selfApprovalAllowed=cap\?\.error==null && cap\?\.data===true/);
 assert.match(ui,/mayDecideRequest\(userId,request,selfApprovalAllowed\)/);
 assert.match(ui,/if\(!selfRequest\)buttons\.append\(reject\)/);
 assert.match(ui,/if\(selfRequest\)card\.append/);
 assert.match(ui,/const gate=await verifiedAdmin\(api,userId\)/);
 assert.match(ui,/api\.rpc\('admin_decide_role_request'/);
 assert.match(member,/exception nominative/i);
});

test('exception is a private per-account whitelist with no initial user and no client-side grants',()=>{
 assert.match(sql,/create table if not exists app_private\.role_self_approval_allowlist/);
 assert.match(sql,/user_id uuid primary key references auth\.users\(id\)/);
 assert.match(sql,/alter table app_private\.role_self_approval_allowlist enable row level security/);
 assert.match(sql,/revoke all on table app_private\.role_self_approval_allowlist[\s\S]*?from public,anon,authenticated/);
 assert.doesNotMatch(sql,/insert into app_private\.role_self_approval_allowlist/);
 assert.match(sql,/insert into public\.user_roles\(user_id,role,granted_by\)/);
 assert.doesNotMatch(sql,/service_role_key|sb_secret_|sk_live_/i);
 assert.match(sql,/where s\.user_id=\(select auth\.uid\(\)\) and s\.enabled=true/);
 assert.match(sql,/select coalesce\(\(select app_private\.is_admin\(\)\),false\)/);
 assert.match(sql,/grant execute on function public\.admin_can_self_approve_role_requests\(\)[\s\S]*?to authenticated/);
});

test('the role-granting RPC retains admin AAL2, locked request, and sports-only exception',()=>{
 assert.match(sql,/if not coalesce\(\(select app_private\.is_admin\(\)\),false\) then/);
 assert.match(sql,/v_admin uuid := \(select auth\.uid\(\)\)/);
 assert.match(sql,/where id=p_request_id for update/);
 assert.match(sql,/v_self := \(v_request\.user_id=v_admin\)/);
 assert.match(sql,/not p_approve/);
 assert.match(sql,/v_request\.requested_role not in \('player','coach'\)/);
 assert.match(sql,/from app_private\.role_self_approval_allowlist a/);
 assert.match(sql,/where a\.user_id=v_admin and a\.enabled=true/);
 assert.match(sql,/insert into public\.user_roles\(user_id,role,granted_by\)/);
 assert.match(sql,/insert into public\.staff_team_assignments/);
 assert.match(sql,/on conflict\(coach_user_id,team_id\)/);
 assert.match(sql,/v_request\.requested_role='coach'/);
 assert.match(sql,/status=case when p_approve then 'approved' else 'rejected' end/);
 assert.match(sql,/insert into app_private\.role_change_audit/);
});

test('legacy no-self-review constraint remains and self source is separately audited',()=>{
 assert.doesNotMatch(sql,/drop constraint never_self_review|drop constraint decision_is_final/i);
 assert.match(sql,/add column if not exists self_approved_by uuid/);
 assert.match(sql,/self_approved_by=user_id and/);
 assert.match(sql,/reviewed_by is null and/);
 assert.match(sql,/requested_role in \('player','coach'\) and/);
 assert.match(sql,/reviewed_by=case when v_self then null else v_admin end/);
 assert.match(sql,/self_approved_by=case when v_self then v_admin else null end/);
 assert.match(sql,/where id=v_request\.id/);
 assert.match(sql,/clear_self_approval_on_admin_revocation/);
 assert.match(sql,/if old\.role='admin'/);
 assert.match(sql,/delete from app_private\.role_self_approval_allowlist/);
});
