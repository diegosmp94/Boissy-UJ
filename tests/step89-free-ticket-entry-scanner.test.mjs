import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 SCAN_OUTCOMES,normalizeFreeTicketScan,validScannedFreeTicket,
 normalizeScanReport,scanCameraAvailable
} from '../admin-free-ticket-scanner.mjs';
import {canUseFreeTickets,FREE_TICKET_STAGING}
 from '../free-ticket-staging-config.mjs';
import {ADMIN_MODULES} from '../admin-center.mjs';
import {availableAdminModules} from '../admin-navigation.mjs';
import {adminCapabilities} from '../admin-control-reliability.mjs';
import {createServerOnlyFreeTicketCode} from '../supabase/functions/_shared/free-ticket-qr-protocol.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610270008_step89_staging_free_ticket_entry.sql');
const oldSql=read('supabase/migrations/202610270007_step88_free_member_ticket_staging.sql');
const ui=read('admin-free-ticket-scanner.mjs');
const center=read('admin-center.mjs');
const css=read('admin-console.css');
const eventId='11111111-1111-4111-8111-111111111111';
const ticket=createServerOnlyFreeTicketCode(eventId);

test('step89: no QR scanner in production, optional module depends on independent protected staging probe',async()=>{
 assert.equal(FREE_TICKET_STAGING.enabled,false);
 assert.equal(canUseFreeTickets(),false);
 assert.ok(ADMIN_MODULES.some(x=>x.id==='entry-scan'));
 assert.equal(new Set(ADMIN_MODULES.map(x=>x.id)).size,ADMIN_MODULES.length);
 assert.equal(availableAdminModules(ADMIN_MODULES,{eventsReady:true}).some(x=>x.id==='entry-scan'),false);
 assert.equal(availableAdminModules(ADMIN_MODULES,{scannerReady:true}).some(x=>x.id==='entry-scan'),true);
 assert.match(center,/case 'entry-scan':void mountAdminFreeTicketScanner/);
 assert.match(center,/import \{mountAdminFreeTicketScanner\} from '\.\/admin-free-ticket-scanner\.mjs'/);
 const code=read('admin-control-reliability.mjs');
 assert.match(code,/canUseFreeTickets\(\)\?adminCapability\(\(\)=>api\.rpc\('admin_free_ticket_scan_status'/);
 assert.match(code,/value=>value\?\.enabled===true&&value\.mode==='staging_test_only'/);
 assert.match(code,/scannerReady/);
});
test('step89: QR format is exact event-bound and never guessable from ticket ID',()=>{
 assert.equal(validScannedFreeTicket(ticket,eventId),true);
 for(const input of [
  null,undefined,'',ticket+'0',ticket.replace(/^BUJ1/,'BUJ2'),
  ticket.toUpperCase(),ticket.replace(eventId,'22222222-2222-4222-8222-222222222222'),
  'https://example.org/'+ticket,'BUJ1:'+eventId+':'+'0'.repeat(63),
  'BUJ1:'+eventId+':'+'0'.repeat(64)+'\n'
 ])assert.equal(validScannedFreeTicket(input,eventId),false);
});
test('step89: only exact server decisions grant admission; offline and unknown never do',()=>{
 assert.deepEqual(Object.keys(SCAN_OUTCOMES).sort(),
  ['accepted','already_used','cancelled','invalid_code','not_found','event_unavailable','rate_limited','rejected'].sort());
 assert.equal(normalizeFreeTicketScan({status:'accepted'}).success,true);
 for(const x of Object.keys(SCAN_OUTCOMES).filter(x=>x!=='accepted')){
  const state=normalizeFreeTicketScan({status:x});
  assert.equal(state.success,false,x);
  assert.match(state.label,/refusée|refusé|réessaie/);
 }
 for(const obj of [null,'accepted',{},[],{status:'pending'},
  {status:'accepted_but_offline'},{status:true}])
  assert.equal(normalizeFreeTicketScan(obj),null);
 assert.match(ui,/if\(!outcome\)throw Error\('Unconfirmed scan'\)/);
 assert.match(ui,/Connexion interrompue ou réponse incertaine : NE PAS laisser entrer/);
 assert.match(ui,/message\.dataset\.scanResult='unconfirmed'/);
});
test('step89: status report validates server summary, ignores private raw details',()=>{
 const report={event_id:eventId,title:'Tournoi',
  capacity:120,issued:40,checked_in:25,cancelled:5,
  recent:[{at:'2026-10-27T10:00:00Z',status:'accepted',ticket_id:'private'},
   {at:'2026-10-27T10:10:00Z',status:'already_used',email:'private'},
   {at:'bad',status:'accepted'},{at:'2026-10-27T10:20:00Z',status:'bogus'}]
 };
 assert.deepEqual(normalizeScanReport(report,eventId),{
  title:'Tournoi',capacity:120,issued:40,checked_in:25,cancelled:5,
  recent:[
   {at:'2026-10-27T10:00:00Z',status:'accepted'},
   {at:'2026-10-27T10:10:00Z',status:'already_used'}]
 });
 assert.equal(normalizeScanReport({...report,event_id:'not-owned'},eventId),null);
 assert.equal(normalizeScanReport({...report,issued:130},eventId),null);
 assert.equal(normalizeScanReport({...report,recent:null},eventId),null);
});
test('step89: camera is progressive-enhancement; unsupported, absent or denied detector does not grant entry',async()=>{
 assert.equal(await scanCameraAvailable({}),false);
 assert.equal(await scanCameraAvailable({BarcodeDetector:class {static getSupportedFormats(){return ['qr_code'];}}}),true);
 assert.equal(await scanCameraAvailable({BarcodeDetector:class {static getSupportedFormats(){return ['code_128'];}}}),false);
 assert.equal(await scanCameraAvailable({BarcodeDetector:class {static getSupportedFormats(){throw Error('not granted');}}}),false);
 assert.match(ui,/navigator\.mediaDevices\.getUserMedia\(/);
 assert.match(ui,/facingMode:\{ideal:'environment'\}/);
 assert.match(ui,/new window\.BarcodeDetector\(\{formats:\['qr_code'\]\}\)/);
 assert.match(ui,/getSupportedFormats\(\)/);
 assert.match(ui,/void sendCode\(code\)/);
 assert.match(ui,/opened\.getTracks\(\)\.forEach\(x=>x\.stop\(\)\)/);
 assert.match(ui,/for\(const track of old\.getTracks\(\)\)track\.stop\(\)/);
 assert.match(ui,/document\.visibilityState==='hidden'/);
});
test('step89: SQL audit is private, pseudonymous, and no bearer QR or human data persisted',()=>{
 for(const marker of [
  'create table if not exists app_private.free_ticket_entry_attempts',
  "outcome in (",
  "'accepted','already_used','cancelled','not_found'",
  'event_id uuid not null references public.club_events(id)',
  'actor_user_id uuid not null references auth.users(id)',
  'alter table app_private.free_ticket_entry_attempts enable row level security',
  'revoke all on app_private.free_ticket_entry_attempts from public,anon,authenticated',
  'where created_at<clock_timestamp()-interval \'90 days\'',
  'to service_role'
 ])assert.ok(sql.includes(marker),marker);
 assert.doesNotMatch(sql,/create (?:table|column)[^;]*(?:raw_qr|plaintext|ticket_secret|token_sha256|email|phone)/i);
 assert.doesNotMatch(sql,/grant (?:select|insert|update|delete) on app_private\.free_ticket_entry_attempts/i);
 assert.match(sql,/comment on table app_private\.free_ticket_entry_attempts/);
});
test('step89: scan decisions serialized at event row, ticket row and status transition',()=>{
 const scan=sql.split('create or replace function public.admin_scan_free_event_ticket(')[1]
  .split('create or replace function public.checkin_free_event_ticket(')[0];
 for(const marker of [
  "v_actor uuid:=(select auth.uid())",
  'app_private.is_admin()',
  'u.email_confirmed_at is not null',
  'free_ticketing_gate',
  'for share',
  'where id=p_event_id for update',
  'where t.event_id=p_event_id',
  't.token_sha256=pg_catalog.encode(',
  "extensions.digest(pg_catalog.decode(v_token,'hex'),'sha256')",
  'for update;',
  "v_ticket.status='checked_in'",
  "v_ticket.status='cancelled'",
  "v_ticket.status='issued'",
  "where id=v_ticket.id and status='issued'",
  "status='checked_in',checked_in_at=v_now",
  "values(v_ticket.id,p_event_id,v_actor,'checked_in')",
  'app_private.free_ticket_entry_attempts',
  "'status',v_outcome"
 ])assert.ok(scan.includes(marker),marker);
 assert.ok(scan.indexOf('where id=p_event_id for update')<
  scan.indexOf('where t.event_id=p_event_id'));
 assert.match(scan,/if v_recent>=75 then/);
 assert.doesNotMatch(scan,/return pg_catalog\.jsonb_build_object\('status','accepted'\)\s*;/);
});
test('step89: only AAL2 admin can scan/report/list; no anonymous RPC exposure',()=>{
 for(const n of [
  'admin_free_ticket_scan_status()',
  'admin_list_free_ticket_scan_events()',
  'admin_scan_free_event_ticket(uuid,text)',
  'checkin_free_event_ticket(uuid,text)',
  'admin_free_ticket_entry_report(uuid)'
 ]){
  assert.ok(sql.includes('revoke all on function public.'+n),n);
  assert.ok(sql.includes('grant execute on function public.'+n+' to authenticated;'),n);
 }
 for(const p of [
  'admin_free_ticket_scan_status()',
  'admin_list_free_ticket_scan_events()',
  'admin_scan_free_event_ticket(',
  'admin_free_ticket_entry_report('
 ]){
  const block=sql.split('create or replace function public.'+p)[1]?.split('$scan$;')[0];
  assert.ok(block,p);
  assert.match(block,/app_private\.is_admin\(\)/,p);
  assert.match(block,/auth\.uid\(\)/,p);
 }
 assert.match(sql,/v_result:=public\.admin_scan_free_event_ticket\(p_event_id,p_qr\)/);
 assert.match(sql,/return v_result->>'status'='accepted'/);
 assert.doesNotMatch(sql,/grant execute on function public\.admin_scan_free_event_ticket\([^;]*to anon/i);
 assert.match(sql,/returns jsonb language plpgsql volatile security definer set search_path=''/);
});
test('step89: scanner UI enforces secure owner AAL2, no offline admission or persistent raw QR',()=>{
 for(const marker of [
  'canUseFreeTickets()',
  "result.status==='admin'",
  "result.level==='aal2'",
  "result.userId===expectedUserId",
  "result.roles?.includes('admin')",
  "api.rpc('admin_scan_free_event_ticket'",
  "api.rpc('admin_free_ticket_entry_report'",
  "api.rpc('admin_list_free_ticket_scan_events'",
  "qrInput.type='password'",
  "qrInput.value=''",
  "const code=qrInput.value",
  "MutationObserver",
  "observer.observe(document.body",
  "document.removeEventListener('visibilitychange',onHidden)",
  "stopCamera();",
  "video"
 ])assert.ok(ui.includes(marker),marker);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|sendBeacon|toDataURL|console\.log|console\.error|sentry|analytics|document\.cookie|innerHTML\s*=/i);
 assert.match(css,/\.admin-scan-video/);
 assert.match(css,/\.admin-scan-history/);
 assert.match(css,/@media\(max-width:580px\)/);
});
test('step89: SQL depends on previous stage, keeps gate OFF and never creates payment or people',()=>{
 assert.match(sql,/Requires step 87 AND isolated step 88 ticket migration/);
 assert.match(sql,/NEVER apply on Supabase primary project/);
 assert.match(oldSql,/enabled boolean not null default false/);
 assert.match(sql,/if not coalesce\(v_gate,false\)/);
 assert.doesNotMatch(sql,/insert into app_private\.free_ticketing_gate|set enabled=true|stripe\.checkout|sk_live_|grant .* to anon/i);
});
