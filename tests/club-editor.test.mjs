import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  validateClubIdentityDraft,canEditClubIdentity,clubIdentityRpcArgs
} from '../club-editor.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610210018_club_identity_admin_cms.sql');
const admin=read('club-editor.mjs'),control=read('control-center.mjs');
const auth=read('auth.mjs'),config=read('auth-config.mjs');
const valid={
  section:'history',title:'Notre club',body:'Un texte officiel qui pourra être vérifié.',
  sortOrder:'3',publish:false,rightsConfirmed:false
};
test('draft accepts verified structure without automatic publication',()=>{
  const review=validateClubIdentityDraft(valid);
  assert.equal(review.valid,true);
  assert.equal(review.publish,false);
  assert.equal(review.sortOrder,3);
  assert.equal(review.title,'Notre club');
  assert.equal(clubIdentityRpcArgs(review).p_id,null);
});
test('publication requires rights review, drafts do not',()=>{
  assert.equal(validateClubIdentityDraft({...valid,publish:true}).valid,false);
  assert.equal(validateClubIdentityDraft({...valid,publish:true,rightsConfirmed:true}).valid,true);
  assert.equal(validateClubIdentityDraft({...valid,section:'admin'}).valid,false);
  assert.equal(validateClubIdentityDraft({...valid,title:'abc'}).valid,false);
  assert.equal(validateClubIdentityDraft({...valid,body:'short'}).valid,false);
});
test('sort order rejects fractional, negative, missing and excessive values',()=>{
  for(const sortOrder of ['','3.14','-1','10001','NaN']){
    assert.equal(validateClubIdentityDraft({...valid,sortOrder}).valid,false,sortOrder);
  }
});
test('editor permissions require same verified account, admin role and AAL2',()=>{
  assert.equal(canEditClubIdentity('one','one',['admin'],'aal2',true),true);
  assert.equal(canEditClubIdentity('one','two',['admin'],'aal2',true),false);
  assert.equal(canEditClubIdentity('one','one',['coach'],'aal2',true),false);
  assert.equal(canEditClubIdentity('one','one',['admin'],'aal1',true),false);
  assert.equal(canEditClubIdentity('one','one',['admin'],'aal2',false),false);
});
test('updates must pass original row version to RPC',()=>{
  const args=clubIdentityRpcArgs(validateClubIdentityDraft(valid),
    {id:'abc',updated_at:'2026-10-21T15:00:00.123456+00:00'});
  assert.equal(args.p_id,'abc');
  assert.equal(args.p_expected_updated_at,'2026-10-21T15:00:00.123456+00:00');
  assert.throws(()=>clubIdentityRpcArgs({valid:false}),/Validation/);
});
test('SQL mandates MFA admin on BOTH read and write and never direct client write',()=>{
  assert.equal((sql.match(/app_private\.is_admin\(\)/g)||[]).length,2);
  assert.match(sql,/if v_actor is null/);
  assert.match(sql,/p_publish and not p_rights_confirmed/);
  assert.match(sql,/for update/);
  assert.match(sql,/p_expected_updated_at is distinct from v_old\.updated_at/);
  assert.match(sql,/errcode='40001'/);
  assert.match(sql,/set search_path = ''/);
  assert.match(sql,/create table if not exists app_private\.club_identity_change_log/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on app_private\.club_identity_change_log from public,anon,authenticated/);
  assert.match(sql,/grant execute on function public\.admin_save_club_identity\([\s\S]*to authenticated/);
  assert.doesNotMatch(sql,/grant (insert|update|delete) on public\.club_identity_sections/i);
});
test('public Control Center uses an offline preview; admin editor belongs to Mon espace only',()=>{
  assert.match(control,/mountClubIdentityPreview\(root\)/);
  assert.doesNotMatch(control,/\.rpc\(|fetch\(|service_role|sb_secret_/);
  assert.match(auth,/mountAuthenticatedClubIdentityEditor\(account,api,user\.id\)/);
  assert.match(config,/adminEnabled:\s*false/);
  assert.match(admin,/if\(!supabaseConfig\.enabled\|\|!container\?\.isConnected/);
  assert.match(admin,/api\.auth\.mfa\.getAuthenticatorAssuranceLevel\(\)/);
  assert.match(admin,/api\.auth\.getUser\(\)/);
  assert.match(admin,/api\.rpc\('admin_list_club_identity'\)/);
  assert.match(admin,/api\.rpc\('admin_save_club_identity',args\)/);
  assert.match(admin,/textContent=String\(text\)/);
  assert.doesNotMatch(admin,/innerHTML\s*=|localStorage|sessionStorage/);
});
