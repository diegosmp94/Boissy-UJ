import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  canShowRoleModeration,mayDecideRequest,moderateMessage
} from '../admin-role-moderation.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const src=read('admin-role-moderation.mjs');
const auth=read('auth.mjs');
const cfg=read('auth-config.mjs');
const sql=read('supabase/migrations/202610210013_cumulative_roles_approvals.sql');
const css=read('styles.css');

test('admin moderation remains unavailable while public authentication is disabled',()=>{
 assert.match(cfg,/enabled:\s*false/);
 assert.equal(canShowRoleModeration('admin-1','admin-1',['admin'],'aal2'),false);
 assert.match(src,/if\(!supabaseConfig\.enabled \|\| !container\?\.isConnected/);
 assert.match(auth,/mountAdminRoleModeration\(account,api,user\.id\)/);
 assert.match(src,/if\(!gate\.authorized\)/);
});
test('true access requires getUser verification, admin role AND MFA level AAL2',()=>{
 assert.match(src,/api\.auth\.getUser\(\)/);
 assert.match(src,/api\.auth\.mfa\.getAuthenticatorAssuranceLevel\(\)/);
 assert.match(src,/levelResult\.data\?\.currentLevel==='aal2'/);
 assert.match(src,/roles\.data\|\|\[\]\)\.map\(x=>x\.role\)/);
 assert.match(src,/sessionUserId===verifiedUserId/);
 assert.match(src,/roleNames\.includes\('admin'\)/);
});
test('self approval, reviewed and unknown roles blocked before RPC',()=>{
 const pending={user_id:'user-2',status:'pending',requested_role:'coach'};
 assert.equal(mayDecideRequest('admin-1',pending),true);
 assert.equal(mayDecideRequest('user-2',pending),false);
 assert.equal(mayDecideRequest('admin-1',{...pending,status:'approved'}),false);
 assert.equal(mayDecideRequest('admin-1',{...pending,requested_role:'supporter'}),false);
 assert.equal(mayDecideRequest(null,pending),false);
});
test('approval and rejection require two-click confirmation and renewed MFA check',()=>{
 assert.match(moderateMessage(true),/Cliquer à nouveau/);
 assert.match(moderateMessage(false),/Cliquer à nouveau/);
 assert.match(src,/if\(selected!==intent\)/);
 assert.match(src,/const gate=await verifiedAdmin\(api,userId\)/);
 assert.match(src,/if\(!gate\.authorized\)/);
 assert.match(src,/api\.rpc\('admin_decide_role_request'/);
 assert.match(src,/p_request_id:request\.id,p_approve:approval/);
 assert.match(src,/p_reason:reason\.value\.trim\(\)\|\|null/);
});
test('moderation fetch is bounded and server query is filter scoped',()=>{
 assert.match(src,/\.eq\('status',filter\.value\)/);
 assert.match(src,/\.limit\(60\)/);
 assert.match(src,/select\('id,user_id,requested_role,team_id,status,requested_at'\)/);
 assert.match(src,/if\(!section\.isConnected\)return/);
 assert.doesNotMatch(src,/service_role|sb_secret_|Authorization:.*service_role|localStorage/);
 assert.doesNotMatch(src,/\.insert\(|\.update\(|\.delete\(|innerHTML\s*=/);
});
test('database remains sole authority for approvals, MFA and anti-self-promotion',()=>{
 assert.match(sql,/create or replace function public\.admin_decide_role_request/);
 assert.match(sql,/v_request\.user_id=v_admin/);
 assert.match(sql,/app_private\.is_admin\(\)/);
 assert.match(sql,/for update/);
 assert.match(sql,/revoke all on function public\.admin_decide_role_request/);
 assert.match(css,/\.admin-role-moderation\[hidden\] \{display:none!important;\}/);
});
