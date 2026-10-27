import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isVerifiedAdmin,adminSessionStatus} from '../admin-security.mjs';
import {ADMIN_MODULES,canOpenAdmin} from '../admin-center.mjs';
import {canRevokeRole,filterMembers} from '../admin-users.mjs';
import {supabaseConfig} from '../auth-config.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const auth=read('auth.mjs'),app=read('app.js'),guard=read('admin-center.mjs'),sql=read('supabase/migrations/202610210021_private_admin_management_lists.sql');

test('real administration can be reached only by a server-assigned role with verified AAL2',()=>{
 assert.equal(supabaseConfig.enabled,true);
 assert.equal(supabaseConfig.adminEnabled,true);
 assert.equal(isVerifiedAdmin('x','x',['admin','supporter'],'aal2'),true);
 assert.equal(isVerifiedAdmin('x','x',['admin'],'aal1'),false);
 assert.equal(isVerifiedAdmin('x','y',['admin'],'aal2'),false);
 assert.equal(isVerifiedAdmin('x','x',['supporter'],'aal2'),false);
 assert.equal(canOpenAdmin({status:'admin',level:'aal2',roles:['admin']}),true);
 for(const status of ['signed-out','mfa-required','supporter','unverified'])
  assert.equal(canOpenAdmin({status,level:'aal2',roles:['admin']}),false);
 assert.equal(canOpenAdmin({status:'admin',level:'aal2',roles:['admin']},false),false);
});
test('identity verification requests getUser and MFA level, not user-editable metadata',async()=>{
 const api={
  auth:{
   getUser:async()=>({data:{user:{id:'one'}},error:null}),
   mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1'},error:null})}
  },
  from:table=>{
   assert.equal(table,'user_roles');
   return {select:()=>({eq:async()=>({data:[{role:'admin'},{role:'supporter'}],error:null})})};
  }
 };
 assert.equal((await adminSessionStatus(api,'one')).status,'mfa-required');
 assert.equal((await adminSessionStatus(api,'two')).status,'signed-out');
 api.auth.mfa.getAuthenticatorAssuranceLevel=async()=>({data:{currentLevel:'aal2'},error:null});
 assert.equal((await adminSessionStatus(api,'one')).status,'admin');
 assert.doesNotMatch(read('admin-security.mjs'),/user_metadata|raw_user_meta_data|localStorage/);
});
test('real administrative route no longer mounts public demo Control Center',()=>{
 assert.match(app,/adminCenterMarkup,mountAdminCenter,unmountAdminCenter/);
 assert.match(app,/if\(path==='\/control-center'\) void mountAdminCenter\(getAuthClient\); else unmountAdminCenter\(\);/);
 assert.doesNotMatch(app,/mountControlCenter\(|controlCenterMarkup\(|mountPresentation\(|\/#\/presentation|href="#\/presentation"/);
 assert.doesNotMatch(read('index.html'),/href="#\/presentation"/);
 assert.doesNotMatch(guard,/mountTeamWorkspace\(|mountMatchWorkspace\(|mountRoleManagementPreview\(|MODE PRÉVISUALISATION/);
});
test('signed-out and AAL1 visitors get no admin data and an account sign-in route',()=>{
 assert.match(guard,/if\(!canOpenAdmin\(verified,supabaseConfig.adminEnabled\)\)/);
 assert.match(guard,/root.replaceChildren\(\)/);
 assert.match(guard,/a.href='#\/mon-espace'/);
 assert.match(guard,/if\(!canOpenAdmin\(check,supabaseConfig.adminEnabled\)\)/);
 assert.match(guard,/event==='SIGNED_OUT'/);
});
test('administrative panel only shows real operational modules',()=>{
 assert.deepEqual(ADMIN_MODULES.map(m=>m.id),
  ['overview','readiness','donations','users','approvals','teams','player-teams','coach-teams','seasons','matches','sport-review','events','event-rules','ticketing','entry-scan','editorial','news','news-revisions','news-media','identity']);
 assert.equal(new Set(ADMIN_MODULES.map(m=>m.id)).size,20);
 assert.doesNotMatch(guard,/dummy|prototype|simulation|fake payment|premium|stripe|mockData/i);
 assert.match(guard,/mountAuthenticatedClubIdentityEditor\(view,api,verified.userId\)/);
 assert.match(guard,/mountAuthenticatedTeamPeopleEditor\(view,api,verified.userId\)/);
 assert.match(guard,/mountAdminRoleModeration\(view,api,verified.userId\)/);
});
test('admins have an enrolment and challenge code path, never TOTP secrets in storage',()=>{
 const security=read('admin-security.mjs');
 assert.match(auth,/mountAdminMfaSetup\(account,api,user.id\)/);
 assert.match(security,/api.auth.mfa.listFactors\(\)/);
 assert.match(security,/api.auth.mfa.enroll\(\{factorType:'totp'/);
 assert.match(security,/api.auth.mfa.challenge\(\{factorId\}\)/);
 assert.match(security,/api.auth.mfa.verify\(\{factorId,challengeId:challenge.data.id,code:value\}\)/);
 assert.match(security,/secured.status!=='admin'/);
 assert.match(security,/QR/);
 assert.doesNotMatch(security,/localStorage|document.cookie|sk_live_|service_role/);
});
test('administration of member roles prevents self revocation and supporter removal',()=>{
 assert.equal(canRevokeRole('admin','someone','coach'),true);
 assert.equal(canRevokeRole('admin','someone','admin'),true);
 assert.equal(canRevokeRole('admin','admin','coach'),false);
 assert.equal(canRevokeRole('admin','someone','supporter'),false);
 const users=read('admin-users.mjs');
 assert.match(users,/admin_revoke_member_role/);
 assert.match(users,/if\(!await verified\(\)\)/);
 assert.match(users,/select\('id,display_name,created_at'\)/);
 assert.match(users,/select\('user_id,role'\)/);
 assert.doesNotMatch(users,/supabase\.auth\.admin\.|deleteUser\(|innerHTML\s*=/);
});
test('private user searches are accent-insensitive',()=>{
 assert.deepEqual(filterMembers([{display_name:'Émilie'},{display_name:'Carlos'}],'emilie').map(x=>x.display_name),['Émilie']);
 assert.equal(filterMembers([], 'x').length,0);
});
test('seasons, matches, and news use audited server RPCs only',()=>{
 const source=read('admin-management.mjs');
 for(const rpc of ['admin_save_season','admin_save_classified_match','admin_save_news_article_checked',
 'admin_list_management_matches','admin_list_management_news','admin_list_management_seasons'])
  assert.ok(source.includes(rpc),'missing '+rpc);
 assert.match(source,/if\(!await guarded\(api,userId\)\)/);
 assert.match(source,/Action sensible/);
 assert.match(source,/p_publish:d.publish/);
 assert.doesNotMatch(source,/\.insert\(|\.update\(|\.delete\(|service_role|sb_secret_|innerHTML\s*=/);
});
test('new private listing RPCs enforce MFA and do not relax existing RLS',()=>{
 assert.match(sql,/app_private\.is_admin\(\)/);
 assert.match(sql,/security definer set search_path=''/);
 assert.match(sql,/revoke all on function public.admin_list_management_matches\(\) from public,anon/);
 assert.match(sql,/revoke all on function public.admin_list_management_news\(\) from public,anon/);
 assert.match(sql,/grant execute on function public.admin_list_management_seasons\(\) to authenticated/);
 assert.doesNotMatch(sql,/create policy.*using \(true\)|grant.*(insert|update|delete).*to anon/i);
});
test('mobile and keyboard presentation is usable',()=>{
 const css=read('admin-console.css');
 assert.match(css,/@media\(max-width:850px\)/);
 assert.match(css,/@media\(max-width:530px\)/);
 assert.match(css,/focus-visible/);
 assert.match(read('index.html'),/admin-console.css/);
});
