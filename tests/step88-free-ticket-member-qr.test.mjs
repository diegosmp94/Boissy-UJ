import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canUseFreeTickets,FREE_TICKET_STAGING}
 from '../free-ticket-staging-config.mjs';
import {validPersonalTicketCode,ownFreeTicketEventEligible,
 normalizeMyFreeTicketRows} from '../member-free-tickets.mjs';
import {createServerOnlyFreeTicketCode,parseFreeTicketCode}
 from '../supabase/functions/_shared/free-ticket-qr-protocol.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610270007_step88_free_member_ticket_staging.sql');
const ui=read('member-free-tickets.mjs');
const auth=read('auth.mjs');
const preview=read('scripts/build-preview.mjs');
const license=read('assets/vendor/qrcode.LICENSE');
const qr=read('assets/vendor/qrcode.min.js');
const eventId='11111111-1111-4111-8111-111111111111';
const testLocation={origin:'https://staging.example.org'};
const stagingRef='abcdefghijklmnopqrst';
const testSupabase={url:'https://'+stagingRef+'.supabase.co'};
const testStaging={enabled:true,origin:testLocation.origin,projectRef:stagingRef};

test('step88: production is strictly OFF and requires exact isolated staging project and origin',()=>{
 assert.equal(FREE_TICKET_STAGING.enabled,false);
 assert.equal(canUseFreeTickets(),false);
 assert.equal(canUseFreeTickets(testStaging,testLocation,testSupabase),true);
 for(const [config,location,supabase] of [
  [{...testStaging,enabled:false},testLocation,testSupabase],
  [{...testStaging,projectRef:'dahzewvbybujqhogumte'},testLocation,
   {url:'https://dahzewvbybujqhogumte.supabase.co'}],
  [testStaging,{origin:'https://evil.example.org'},testSupabase],
  [testStaging,testLocation,{url:'https://dahzewvbybujqhogumte.supabase.co'}],
  [{...testStaging,origin:'http://staging.example.org'},testLocation,testSupabase],
  [{...testStaging,projectRef:'bad'},testLocation,testSupabase],
 ])assert.equal(canUseFreeTickets(config,location,supabase),false);
});
test('step88: personal QR payload validates opaque event-scoped 256-bit secret',()=>{
 const code=createServerOnlyFreeTicketCode(eventId);
 assert.equal(validPersonalTicketCode(code,eventId),true);
 assert.equal(parseFreeTicketCode(code).eventId,eventId);
 for(const wrong of [
  '',null,'BUJ1:'+eventId+':'+'0'.repeat(63),
  code+'0',code.replace(/^BUJ1/,'BUJ2'),
  code.replace(eventId,'22222222-2222-4222-8222-222222222222'),
  code.toUpperCase()
 ])assert.equal(validPersonalTicketCode(wrong,eventId),false);
});
test('step88: browser hints require a verified, public free event with open metadata',()=>{
 const future={id:eventId,title:'Événement du club',
  published:true,booking_kind:'free',access_kind:'public',
  priority_kind:'none',price_cents:0,booking_status:'open',
  capacity:60,starts_at:'2026-12-22T14:00:00Z'};
 const now=Date.parse('2026-10-27T00:00:00Z');
 assert.equal(ownFreeTicketEventEligible(future,now),true);
 for(const bad of [
  {booking_kind:'paid'},{access_kind:'premium'},{priority_kind:'premium'},
  {price_cents:100},{published:false},{capacity:null},
  {capacity:0},{starts_at:'2026-10-20T00:00:00Z'},{booking_status:'not_open'}
 ])assert.equal(ownFreeTicketEventEligible({...future,...bad},now),false);
});
test('step88: member ticket listing normalizes supported states and rejects malformed rows',()=>{
 const ticket={event_id:eventId,title:'Club',
  starts_at:'2026-12-21T15:00:00Z',issued_at:'2026-10-27T12:00:00Z',
  ticket_status:'issued',can_reissue:true};
 assert.deepEqual(normalizeMyFreeTicketRows([ticket]),[ticket]);
 assert.deepEqual(normalizeMyFreeTicketRows([
  ticket,{...ticket,event_id:'other'},null,{...ticket,can_reissue:'yes'},
  {...ticket,ticket_status:'upcoming'}
 ]),[ticket]);
 assert.equal(normalizeMyFreeTicketRows(null),null);
});
test('step88: stage61 source remains a separate historical, NOT deployed prototype',()=>{
 const proto=read('supabase/migrations/202610240001_free_event_tickets_gated.sql');
 assert.match(proto,/DO NOT APPLY TO PRODUCTION/);
 assert.match(proto,/app_private.free_ticketing_gate/);
 assert.match(sql,/stage 88/);
 assert.match(sql,/NEVER apply to the primary project dahzewvbybujqhogumte/);
 assert.match(sql,/Requires stage 87/);
 assert.match(sql,/begin;/);
 assert.match(sql,/commit;/);
});
test('step88: feature gate is OFF, private tables have RLS, member raw secret never stored',()=>{
 for(const piece of [
  'enabled boolean not null default false',
  'values (1,false) on conflict(id) do update',
  'set enabled=false,updated_at=clock_timestamp()',
  'create table if not exists app_private.free_event_tickets',
  'create table if not exists app_private.free_event_ticket_audit',
  'token_sha256 text not null unique',
  'unique(event_id,member_user_id)',
  "status in ('issued','cancelled','checked_in')",
  'alter table app_private.free_ticketing_gate enable row level security',
  'alter table app_private.free_event_tickets enable row level security',
  'alter table app_private.free_event_ticket_audit enable row level security',
  'revoke all on app_private.free_event_tickets from public,anon,authenticated',
  'references app_private.event_reservation_windows(id) on delete restrict'
 ])assert.ok(sql.includes(piece),piece);
 assert.doesNotMatch(sql,/grant (select|update|insert|delete) on app_private\.free_/i);
 assert.doesNotMatch(sql,/raw_qr|plaintext_secret|member_email|full_name|passport/);
});
test('step88: server guards ticket issuance with event lock, lifetime uniqueness and hard capacity',()=>{
 const issue=sql.split('create or replace function public.request_free_event_ticket(')[1]
  .split('create or replace function public.cancel_my_free_event_ticket(')[0];
 for(const piece of [
  "v_actor uuid := (select auth.uid())",
  "auth.jwt()->>'is_anonymous'",
  "u.email_confirmed_at is not null",
  "app_private.free_ticketing_gate where id=1 for share",
  "if not coalesce(v_gate,false)",
  "where id=p_event_id for update",
  "v_event.booking_kind <> 'free'",
  "v_event.access_kind <> 'public'",
  "v_event.booking_status <> 'open'",
  "v_event.priority_kind <> 'none'",
  "v_event.capacity is null",
  "select count(*) into v_used from app_private.free_event_tickets",
  "status in ('issued','checked_in')",
  "if v_used >= v_event.capacity",
  "Only one lifetime ticket per member",
  "v_secret:=encode(extensions.gen_random_bytes(32),'hex')",
  "extensions.digest(decode(v_secret,'hex'),'sha256')",
  "return 'BUJ1:'||p_event_id::text||':'||v_secret"
 ])assert.ok(issue.includes(piece),piece);
 assert.ok(issue.indexOf('where id=p_event_id for update')<
  issue.indexOf('select count(*) into v_used'));
});
test('step88: stage87 windows enforce non-overlap and sub-quotas on issue',()=>{
 const issue=sql.split('create or replace function public.request_free_event_ticket(')[1]
  .split('create or replace function public.cancel_my_free_event_ticket(')[0];
 for(const piece of [
  'from app_private.event_reservation_windows w',
  "where w.event_id=p_event_id;", 
  "w.status='scheduled'",
  "w.access_kind='public'",
  'w.opens_at<=clock_timestamp()',
  'clock_timestamp()<w.closes_at',
  't.window_id=v_window.id',
  'v_window_used>=v_window.capacity',
  'p_event_id,v_actor,v_window.id',
 ])assert.ok(issue.includes(piece),piece);
});
test('step88: cancellation is own-only, cannot undo a used ticket or recreate it',()=>{
 const cancel=sql.split('create or replace function public.cancel_my_free_event_ticket(')[1]
  .split('create or replace function public.checkin_free_event_ticket(')[0];
 assert.match(cancel,/auth\.uid\(\)/);
 assert.match(cancel,/email_confirmed_at/);
 assert.match(cancel,/where id=p_event_id for update/);
 assert.match(cancel,/where event_id=p_event_id and member_user_id=v_actor\s+and status='issued'/);
 assert.match(cancel,/status='cancelled',cancelled_at=clock_timestamp\(\)/);
 assert.match(cancel,/v_start <= clock_timestamp\(\)/);
 assert.match(cancel,/insert into app_private\.free_event_ticket_audit/);
});
test('step88: recovery rotates only unused own ticket before event kickoff',()=>{
 const recovery=sql.split('create or replace function public.member_reissue_free_event_ticket(')[1]
  .split('create or replace function public.admin_open_staging_free_event(')[0];
 for(const piece of [
  "v_actor uuid:=(select auth.uid())",
  "u.email_confirmed_at is not null",
  "from app_private.free_ticketing_gate where id=1",
  "where id=p_event_id for update",
  "where event_id=p_event_id and member_user_id=v_actor for update",
  "v_ticket.status<>'issued'",
  "v_start<=clock_timestamp()",
  "v_secret:=encode(extensions.gen_random_bytes(32),'hex')",
  "token_sha256=encode(extensions.digest(decode(v_secret,'hex'),'sha256'),'hex')",
  "token_rotated_at=clock_timestamp()",
  "return 'BUJ1:'||p_event_id::text||':'||v_secret"
 ])assert.ok(recovery.includes(piece),piece);
 assert.doesNotMatch(recovery,/p_member_id|p_user_id|token_raw|plaintext/);
});
test('step88: own ticket list returns no secret and refuses anonymous unverified accounts',()=>{
 const list=sql.split('create or replace function public.member_my_free_event_tickets()')[1]
  .split('create or replace function public.member_reissue_free_event_ticket(')[0];
 assert.match(list,/where t.member_user_id=v_actor/);
 assert.match(list,/auth\.jwt\(\)->>'is_anonymous'/);
 assert.match(list,/email_confirmed_at is not null/);
 assert.match(list,/v_actor is null/);
 assert.match(list,/t.status='issued' and e.starts_at>clock_timestamp\(\)/);
 assert.doesNotMatch(list,/token_sha256|v_secret|token_raw|member_user_id uuid/);
});
test('step88: only admin AAL2 can open a free event after manually enabling isolated staging',()=>{
 const opening=sql.split('create or replace function public.admin_open_staging_free_event(')[1]
  .split('create or replace function app_private.guard_event_reservation_consistency()')[0];
 assert.match(opening,/app_private\.is_admin\(\)/);
 assert.match(opening,/auth\.uid\(\)/);
 assert.match(opening,/free_ticketing_gate/);
 assert.match(opening,/v_event.priority_kind<>'none'/);
 assert.match(opening,/v_event.access_kind<>'public'/);
 assert.match(opening,/v_event.booking_kind<>'free'/);
 assert.match(opening,/v_event.capacity is null/);
 assert.match(opening,/booking_status='open'/);
 const guard=sql.split('create or replace function app_private.guard_event_reservation_consistency()')[1];
 assert.match(guard,/new.booking_status='open'/);
 assert.match(guard,/app_private.free_ticketing_gate/);
 assert.match(guard,/app_private.is_admin\(\)/);
 assert.match(guard,/v_quota>new.capacity/);
 assert.match(guard,/w.closes_at>new.starts_at/);
});
test('step88: no anonymous SQL RPC exposure, scanner stays MFA and single-use until step89',()=>{
 for(const fn of [
  'request_free_event_ticket(uuid)',
  'cancel_my_free_event_ticket(uuid)',
  'checkin_free_event_ticket(uuid,text)',
  'member_my_free_event_tickets()',
  'member_reissue_free_event_ticket(uuid)',
  'admin_open_staging_free_event(uuid)'
 ])assert.ok(sql.includes('grant execute on function public.'+fn),fn);
 for(const fn of ['member_my_free_event_tickets()',
  'member_reissue_free_event_ticket(uuid)','admin_open_staging_free_event(uuid)'])
  assert.match(sql,new RegExp('revoke all on function public\\.'+
   fn.replaceAll('(','\\(').replaceAll(')','\\)')+'\\s+from public,anon,authenticated,service_role'));
 assert.match(sql,/not coalesce\(\(select app_private\.is_admin\(\)\),false\)/);
 assert.match(sql,/where id=v_ticket_id and status='issued'/);
 assert.match(sql,/status='checked_in',checked_in_at=clock_timestamp\(\)/);
});
test('step88: Mon espace is fail closed and never sends bearer QR to another origin or persistent storage',()=>{
 assert.match(auth,/mountMemberFreeTickets\(account,api,user.id/);
 assert.match(ui,/if\(!canUseFreeTickets\(\)\)/);
 assert.match(ui,/api\.auth\.getUser\(\)/);
 assert.match(ui,/response\.data\?\.user\?\.id===expectedUserId/);
 assert.match(ui,/api\.rpc\('member_my_free_event_tickets'\)/);
 assert.match(ui,/reserve:'request_free_event_ticket'/);
 assert.match(ui,/reissue:'member_reissue_free_event_ticket'/);
 assert.match(ui,/cancel:'cancel_my_free_event_ticket'/);
 assert.match(ui,/new QR\(image,\{text:code/);
 assert.match(ui,/new URL\('\.\/assets\/vendor\/qrcode\.min\.js',import\.meta\.url\)/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|sendBeacon|fetch\(['"]https|canvas\.toDataURL|console\.log|console\.error|service_role/i);
 assert.match(preview,/cp\(join\(project,'assets'\),join\(dist,'assets'\)/);
 assert.match(license,/MIT License/);
 assert.match(qr,/QRCode/);
 assert.doesNotMatch(ui,/cdn\.jsdelivr\.net|chart\.googleapis\.com|api\.qrserver/);
});
