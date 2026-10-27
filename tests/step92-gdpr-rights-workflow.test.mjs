import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PRIVACY_RIGHTS,PRIVACY_STATES,privacyRequestInputError,
 safeMyPrivacyRequests} from '../member-privacy-rights.mjs';
import {PRIVACY_SCOPES,privacyDecisionError,validPrivacyEvidence,
 normalizePrivacyCases} from '../admin-privacy-rights.mjs';
import {ADMIN_MODULES} from '../admin-center.mjs';
import {availableAdminModules} from '../admin-navigation.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610270011_step92_privacy_rights_workflow.sql');
const own=read('member-privacy-rights.mjs');
const admin=read('admin-privacy-rights.mjs');
const hub=read('admin-center.mjs');
const probe=read('admin-control-reliability.mjs');
const auth=read('auth.mjs');
const minorConsent=read('supabase/migrations/202610260018_public_person_profile_consent.sql');
const mediaPurge=read('supabase/migrations/202610260017_media_purge_queue.sql');
const id='11111111-1111-4111-8111-111111111111';

test('step92: distinct rights categories and authentic own request only',()=>{
 assert.deepEqual(Object.keys(PRIVACY_RIGHTS),
  ['access','rectification','erasure','restriction','portability','objection','consent_withdrawal']);
 assert.equal(privacyRequestInputError('erasure',''),null);
 assert.equal(privacyRequestInputError('unsupported',''), 'Type de demande invalide.');
 assert.equal(privacyRequestInputError('access','x'.repeat(601)).includes('600'),true);
 assert.ok(privacyRequestInputError('access','text\nsecret'));
 assert.match(own,/api\.auth\.getUser\(\)/);
 assert.match(own,/r\.data\?\.user\?\.id===userId/);
 assert.match(own,/email_confirmed_at/);
 assert.match(own,/api\.rpc\('member_submit_privacy_request'/);
 assert.match(own,/api\.rpc\('member_my_privacy_requests'/);
 assert.match(own,/aucun compte ou un fichier|ne supprime pas automatiquement/);
 assert.match(own,/Pour une demande au nom d’un enfant/);
 assert.doesNotMatch(own,/\.delete\(|\.update\(|\.insert\(|admin\.deleteUser|service_role|document\.cookie|localStorage|sessionStorage|innerHTML/);
});
test('step92: private request history and admin case list reject unsafe records',()=>{
 const c={id,request_kind:'access',status:'submitted',
  received_at:'2026-10-27T10:00:00Z',
  due_at:'2026-11-27T10:00:00Z',
  updated_at:'2026-10-27T10:01:00Z'};
 assert.deepEqual(safeMyPrivacyRequests([c]),[c]);
 assert.deepEqual(safeMyPrivacyRequests([{...c,status:'bad'},null]),[]);
 assert.equal(safeMyPrivacyRequests({data:[c]}),null);
 assert.deepEqual(normalizePrivacyCases([c]),[c]);
 assert.deepEqual(normalizePrivacyCases([{...c,request_kind:'admin'}]),[]);
 assert.equal(normalizePrivacyCases(undefined),null);
 assert.equal(Object.keys(PRIVACY_STATES).length,5);
});
test('step92: admin decisions and internal evidence require review and bound text',()=>{
 assert.equal(privacyDecisionError('completed','x'.repeat(30)),null);
 assert.equal(privacyDecisionError('in_review',''),null);
 assert.ok(privacyDecisionError('completed','short'));
 assert.ok(privacyDecisionError('rejected',''));
 assert.ok(privacyDecisionError('in_review','Some unsupported hidden note'));
 assert.ok(privacyDecisionError('cancelled',''));
 assert.equal(validPrivacyEvidence('case/2026-10-27'),true);
 assert.equal(validPrivacyEvidence('internal:ticket-221'),true);
 for(const x of [null,'abc','a'.repeat(121),'a b','client@email.com','\nsecret', '']) 
  assert.equal(validPrivacyEvidence(x),false);
 assert.equal(Object.keys(PRIVACY_SCOPES).length,8);
});
test('step92: private RLS for requests, receipt, audit, retention and no broad table grants',()=>{
 for(const table of ['privacy_rights_requests','privacy_request_steps',
  'privacy_requests_audit','privacy_retention_register','privacy_retention_audit']){
  assert.match(sql,new RegExp('create table if not exists app_private\\.'+table));
  assert.match(sql,new RegExp('alter table app_private\\.'+table+' enable row level security'));
  assert.match(sql,new RegExp('revoke all on app_private\\.'+table+' from public,anon,authenticated'));
 }
 assert.match(sql,/subject_user_id uuid, -- deliberately no FK/);
 assert.match(sql,/received_at timestamptz not null default clock_timestamp/);
 assert.match(sql,/due_at timestamptz not null default \(clock_timestamp\(\)\+interval '1 month'\)/);
 assert.match(sql,/create unique index if not exists privacy_one_open_request_per_kind/);
 assert.match(sql,/status in \('submitted','in_review','awaiting_action'\)/);
 assert.match(sql,/char_length\(description\)<=600/);
 assert.doesNotMatch(sql,/grant (?:select|insert|update|delete) on app_private\.privacy_/i);
 assert.doesNotMatch(sql,/insert into auth\.users|delete from auth\.users|delete from storage\.objects|delete from public\.news_media_assets/i);
});
test('step92: identity, email verification, no proxy user ID, request limit and append-only audit',()=>{
 const submit=sql.split('create or replace function public.member_submit_privacy_request(')[1]
  .split('create or replace function public.member_my_privacy_requests(')[0];
 for(const marker of [
  'actor uuid:=(select auth.uid())',
  "auth.jwt()->>'is_anonymous'",
  'u.email_confirmed_at is not null',
  'p_kind not in',
  "p_description ~ '[[:cntrl:]]'",
  'if active_count>=5',
  'subject_user_id,request_kind,description',
  "if p_kind='erasure' then",
  'privacy_request_steps(request_id,scope)',
  "'auth_account','member_profile','club_roles','public_person_profiles'",
  "'private_media','awards_ballots','payments_and_invoices','external_processors'",
  "values(request_id,actor,'submit')"
 ])assert.ok(submit.includes(marker),marker);
 assert.doesNotMatch(submit,/p_subject_user_id|p_user_id|user_metadata/);
 const personal=sql.split('create or replace function public.member_my_privacy_requests()')[1]
  .split('create or replace function public.admin_list_privacy_requests()')[0];
 assert.match(personal,/where r.subject_user_id=actor/);
 assert.doesNotMatch(personal,/subject_user_id uuid,/);
});
test('step92: admin rights only with is_admin AAL2 server-verified and protected RPCs',()=>{
 for(const sig of [
  'admin_list_privacy_requests()',
  'admin_list_privacy_request_steps(uuid)',
  'admin_update_privacy_step(uuid,text,text,text)',
  'admin_extend_privacy_request(uuid,text,timestamptz)',
  'admin_transition_privacy_request(uuid,text,text,timestamptz)',
  'admin_privacy_retention_and_consent()',
  'admin_approve_privacy_retention_rule(text,text,text,timestamptz)'
 ]){
  assert.ok(sql.includes('revoke all on function public.'+sig),sig);
  assert.ok(sql.includes('grant execute on function public.'+sig+' to authenticated;')||
    sql.includes('grant execute on function public.'+sig+'\n to authenticated;'),sig);
 }
 for(const name of ['admin_list_privacy_requests','admin_list_privacy_request_steps',
  'admin_update_privacy_step','admin_extend_privacy_request',
  'admin_transition_privacy_request','admin_privacy_retention_and_consent',
  'admin_approve_privacy_retention_rule']){
  const body=sql.split('create or replace function public.'+name+'(')[1]?.split('$fn$;')[0];
  assert.ok(body,name);assert.match(body,/auth.uid\(\)/,name);
  assert.match(body,/app_private\.is_admin\(\)/,name);
 }
 assert.ok(sql.includes("revoke all on function public.member_submit_privacy_request(text,text)"));
 assert.ok(sql.includes("grant execute on function public.member_submit_privacy_request(text,text) to authenticated;"));
 assert.match(admin,/adminSessionStatus\(api,userId\)/);
 assert.match(admin,/v.level==='aal2'/);
 assert.doesNotMatch(admin,/api\.from\('auth.users'\)|api\.auth\.admin|\.storage\.from\(|\.delete\(/);
});
test('step92: erasure remains outstanding until manual checklist AND real Auth deletion confirmed',()=>{
 const steps=sql.split('create or replace function public.admin_update_privacy_step(')[1]
  .split('create or replace function public.admin_extend_privacy_request(')[0];
 for(const fragment of [
  'where id=p_request_id for update',
  "request_row.request_kind<>'erasure'",
  "p_scope='auth_account' and p_state='not_applicable'",
  "p_scope='auth_account' and exists(",
  "where u.id=request_row.subject_user_id",
  'privacy_request_steps',
  'p_evidence_ref',
  'privacy_requests_audit'
 ])assert.ok(steps.includes(fragment),fragment);
 const state=sql.split('create or replace function public.admin_transition_privacy_request(')[1]
  .split('create or replace function public.admin_privacy_retention_and_consent(')[0];
 for(const fragment of [
  "p_status='completed' and old.request_kind='erasure'",
  'from auth.users u where u.id=old.subject_user_id',
  "s.state='pending'",
  'if pending_steps<>0',
  "select count(*) from app_private.privacy_request_steps",
  "<>8",
  'then null else old.subject_user_id',
  "then '' else old.description",
  'p_expected_updated_at',
  'old.updated_at is distinct from p_expected_updated_at'
 ])assert.ok(state.includes(fragment),fragment);
 assert.doesNotMatch(state,/delete from auth\.users|delete from storage\.objects|delete from public\.profiles|api\.deleteUser/);
});
test('step92: retention decisions are NOT seeded legal values, admin-only, audit and optimistic lock',()=>{
 const pre=sql.split('create or replace function public.member_submit_privacy_request(')[0];
 assert.match(pre,/insert into app_private\.privacy_retention_register\(dataset\)/);
 assert.doesNotMatch(pre,/values\('auth_accounts',\s*'/);
 assert.match(pre,/approved_at timestamptz/);
 assert.match(pre,/retention_rule text check/);
 assert.match(pre,/legal_basis text check/);
 const approve=sql.split('create or replace function public.admin_approve_privacy_retention_rule(')[1]
  .split('revoke all on function public.member_submit_privacy_request(')[0];
 assert.match(approve,/p_expected_approved_at/);
 assert.match(approve,/old.approved_at is distinct from p_expected_approved_at/);
 assert.match(approve,/privacy_retention_audit/);
 assert.match(approve,/app_private.is_admin/);
 assert.match(admin,/admin_approve_privacy_retention_rule/);
 assert.match(admin,/Durée et base légale à renseigner par le club/);
});
test('step92: original secure media purge and separate public profile consent are reused, not bypassed',()=>{
 assert.match(mediaPurge,/admin_begin_news_media_purge/);
 assert.match(mediaPurge,/admin_finish_news_media_purge/);
 assert.match(mediaPurge,/storage.objects/);
 assert.match(minorConsent,/profile_consent_confirmed/);
 assert.match(minorConsent,/profile_visible/);
 assert.match(sql,/from app_private.news_media_purge_jobs/);
 assert.match(sql,/from public.team_public_people/);
 assert.match(admin,/Les mineurs nécessitent une vérification d’autorité parentale/);
 assert.match(admin,/media_purges_pending/);
});
test('step92: RGPD module in Control Center is hidden on failed backend capability',()=>{
 assert.equal(availableAdminModules(ADMIN_MODULES).some(x=>x.id==='privacy-rights'),false);
 assert.equal(availableAdminModules(ADMIN_MODULES,{privacyReady:true}).some(x=>x.id==='privacy-rights'),true);
 assert.match(probe,/adminCapability\(\(\)=>api\.rpc\('admin_list_privacy_requests'\)/);
 assert.match(hub,/case 'privacy-rights':void mountAdminPrivacyRights\(view,api,verified.userId\)/);
 assert.match(hub,/const availableModules=availableAdminModules\(ADMIN_MODULES,\{eventsReady,eventRulesReady,scannerReady,awardsReady,privacyReady,/);
 assert.match(auth,/mountMemberPrivacyRights\(account,api,user.id/);
});
