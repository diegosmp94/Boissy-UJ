import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canEditMemberDisplayName,normalizeMemberDisplayName,isProfileNameChanged} from '../admin-member-rules.mjs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610220005_p2_member_profile_edit.sql');
const ui=read('admin-users.mjs');

test('P2 validates display name length and strips redundant spaces',()=>{
 assert.deepEqual(normalizeMemberDisplayName('  Éloïse   Martin  '),{valid:true,value:'Éloïse Martin',message:''});
 for(const value of ['',null,'x','a'.repeat(81),'abc\nxyz','abc\u007fdef'])
  assert.equal(normalizeMemberDisplayName(value).valid,false);
 assert.equal(normalizeMemberDisplayName('ab').valid,true);
 assert.equal(normalizeMemberDisplayName('a'.repeat(80)).valid,true);
});
test('P2 can edit other members, never its own admin identity',()=>{
 assert.equal(canEditMemberDisplayName('admin','member'),true);
 assert.equal(canEditMemberDisplayName('admin','admin'),false);
 assert.equal(canEditMemberDisplayName('admin',''),false);
 assert.equal(canEditMemberDisplayName(null,'member'),false);
 assert.equal(isProfileNameChanged('Éloïse Martin','  Éloïse  Martin '),false);
 assert.equal(isProfileNameChanged('Éloïse Martin','Éloïse Meunier'),true);
});
test('P2 administrative SQL requires AAL2 and forbids self-modification',()=>{
 assert.match(sql,/function public\.admin_update_member_display_name\(/);
 assert.match(sql,/app_private\.is_admin\(\)/);
 assert.match(sql,/v_actor uuid:=\(select auth\.uid\(\)\)/);
 assert.match(sql,/p_member_id=v_actor/);
 assert.match(sql,/char_length\(v_name\)<2 or char_length\(v_name\)>80/);
 assert.match(sql,/pg_catalog\.btrim\(p_display_name\)/);
 assert.match(sql,/where p\.id=p_member_id for update/);
 assert.match(sql,/if v_old=v_name/);
});
test('P2 changes only the profile name and updated timestamp, with private audit',()=>{
 assert.match(sql,/update public\.profiles set display_name=v_name,updated_at=now\(\)/);
 assert.match(sql,/insert into app_private\.member_profile_change_audit/);
 assert.match(sql,/alter table app_private\.member_profile_change_audit enable row level security/);
 assert.match(sql,/revoke all on app_private\.member_profile_change_audit from public,anon,authenticated/);
 assert.match(sql,/revoke all on function public\.admin_update_member_display_name\(uuid,text\) from public,anon/);
 assert.match(sql,/grant execute on function public\.admin_update_member_display_name\(uuid,text\) to authenticated/);
 assert.doesNotMatch(sql,/delete\s+from\s+(auth\.users|public\.user_roles)|insert\s+into\s+public\.user_roles/i);
});
test('P2 UI uses only audited RPC and verifies MFA before write',()=>{
 assert.match(ui,/adminSessionStatus\(api,userId\)/);
 assert.match(ui,/gate\.status==='admin'&&gate\.level==='aal2'/);
 assert.match(ui,/api\.rpc\('admin_update_member_display_name',\{/);
 assert.match(ui,/p_member_id:profile\.id,p_display_name:validation\.value/);
 assert.match(ui,/Confirmer la modification/);
 assert.match(ui,/confirmedValue!==validation\.value/);
 assert.match(ui,/if\(!await verified\(\)\)/);
 assert.match(ui,/if\(!card\.isConnected\)return/);
 assert.doesNotMatch(ui,/supabase\.auth\.admin|\.insert\(|\.delete\(|\.update\(|innerHTML\s*=/);
});
test('P2 presentation is responsive and existing role-revocation stays intact',()=>{
 assert.match(read('admin-console.css'),/\.admin-member-edit\[hidden\]/);
 assert.match(read('admin-console.css'),/@media\(max-width:560px\)/);
 assert.match(ui,/api\.rpc\('admin_revoke_member_role'/);
 assert.match(ui,/canRevokeRole\(userId,profile\.id,role\)/);
 assert.match(read('admin-center.mjs'),/case 'users':void mountAdminMembers\(view,api,verified\.userId\);break/);
});
