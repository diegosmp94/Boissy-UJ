import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {advancedEventEuros,validateAdvancedEvent,advancedEventRpcArgs,
 validateReservationWindow,reservationWindowRpcArgs} from '../admin-advanced-events.mjs';
import {ADMIN_MODULES} from '../admin-center.mjs';
import {availableAdminModules} from '../admin-navigation.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610270006_step87_advanced_event_booking_rules.sql');
const center=read('admin-center.mjs');
const editor=read('admin-advanced-events.mjs');
const publicEvents=read('events-center.mjs');
const originalEvents=read('admin-management.mjs');
const draft={
 title:'Tournoi Boissy UJ',description:'Réunion sportive officielle',
 category:'sport',start:'2026-12-15T15:00',end:'2026-12-15T19:00',
 location:'Terrain du club',capacity:'120',access:'public',booking:'free',
 price:'0',premiumPrice:'',priority:'none',priorityStart:'',priorityEnd:'',
 status:'not_open',published:false
};
const event={id:'b88e9301-dc36-41dd-891b-f7ac91ec1d14',
 capacity:120,access_kind:'public',priority_kind:'premium',
 priority_starts_at:'2026-12-10T08:00:00Z',
 priority_ends_at:'2026-12-11T08:00:00Z',
 starts_at:'2026-12-15T15:00:00Z'};
const windowDraft={opens:'2026-12-10T10:00',closes:'2026-12-10T16:00',
 capacity:'40',access:'premium',status:'scheduled'};

test('stage87: financial amounts require integer cents, bounded EUR prices and optional Premium discounts',()=>{
 assert.equal(advancedEventEuros('10,55'),1055);
 assert.equal(advancedEventEuros('10000'),1000000);
 assert.equal(advancedEventEuros('',{optional:true}),null);
 assert.equal(advancedEventEuros('0'),0);
 for(const invalid of ['-1','1.555','2e4','NaN','10000.01','10001','00.10','  .50']){
  assert.throws(()=>advancedEventEuros(invalid),undefined,invalid);
 }
});
test('stage87: draft metadata and publish rules accept free, paid and Premium without payment activation',()=>{
 assert.equal(validateAdvancedEvent(draft),null);
 assert.equal(validateAdvancedEvent({...draft,booking:'paid',price:'25',premiumPrice:'0'}),null);
 assert.equal(validateAdvancedEvent({...draft,access:'premium'}),null);
 assert.equal(validateAdvancedEvent({...draft,published:true}),null);
 assert.equal(advancedEventRpcArgs(draft).p_booking_status,'not_open');
 assert.equal(advancedEventRpcArgs({...draft,booking:'paid',price:'25'}).p_price_cents,2500);
 assert.equal(advancedEventRpcArgs({...draft,access:'premium'}).p_access_kind,'premium');
 assert.throws(()=>advancedEventRpcArgs({...draft,status:'open'}));
});
test('stage87: impossible price/status/priority/date and quota drafts are rejected before server write',()=>{
 for(const patch of [
  {status:'open'}, {status:'full'}, {booking:'paid',price:'0'},
  {booking:'free',price:'15'}, {premiumPrice:'1'},
  {price:'20',premiumPrice:'30'}, {capacity:'0'},{capacity:'100001'},
  {access:'member'}, {start:'',published:true},{end:''},
  {end:'2026-12-15T10:00'},
  {priority:'premium',priorityStart:'',priorityEnd:''},
  {priority:'none',priorityStart:'2026-12-09T08:00'},
  {priority:'premium',access:'premium'},
  {priority:'premium',priorityStart:'2026-12-10T08:00',
   priorityEnd:'2026-12-15T16:00'}
 ])assert.ok(validateAdvancedEvent({...draft,...patch}),JSON.stringify(patch));
 const priorities=validateAdvancedEvent({...draft,priority:'premium',
  priorityStart:'2026-12-10T08:00',priorityEnd:'2026-12-11T08:00'});
 assert.equal(priorities,null);
});
test('stage87: protected event RPC uses optimistic version, never local privilege flags',()=>{
 const saved={id:event.id,updated_at:'2026-10-27T10:00:00Z'};
 const args=advancedEventRpcArgs({...draft,capacity:'120'},saved);
 assert.equal(args.p_id,event.id);
 assert.equal(args.p_expected_updated_at,saved.updated_at);
 assert.equal(args.p_capacity,120);
 assert.equal(args.p_price_cents,0);
 assert.equal(args.p_premium_price_cents,null);
 assert.equal(args.p_published,false);
 assert.equal(args.p_booking_status,'not_open');
 assert.ok(args.p_starts_at.endsWith('Z'));
});
test('stage87: slot validation requires exact event, non-overrun, priority window and non-public access for Premium events',()=>{
 assert.equal(validateReservationWindow(windowDraft,event),null);
 assert.equal(reservationWindowRpcArgs(windowDraft,event).p_capacity,40);
 for(const patch of [
  {capacity:'0'}, {capacity:'121'}, {capacity:'nope'},
  {opens:'2026-12-10T16:00',closes:'2026-12-10T10:00'},
  {closes:'2026-12-15T16:00'},
  {opens:'2026-12-09T07:00'},
  {status:'open'}, {access:'unknown'},
 ])assert.ok(validateReservationWindow({...windowDraft,...patch},event),JSON.stringify(patch));
 assert.ok(validateReservationWindow(windowDraft,{...event,capacity:null}));
 assert.ok(validateReservationWindow({...windowDraft,access:'public'},
  {...event,access_kind:'premium'}));
 assert.ok(validateReservationWindow(windowDraft,{...event,priority_kind:'none'}));
 const args=reservationWindowRpcArgs(windowDraft,event,
  {id:'f5bd95dc-97e0-42c1-a137-cf458c04c746',
    updated_at:'2026-10-27T10:00:00Z'});
 assert.equal(args.p_expected_updated_at,'2026-10-27T10:00:00Z');
 assert.equal(args.p_status,'scheduled');
});
test('stage87: SQL private windows, immutable audit, RLS and no browser permissions',()=>{
 for(const marker of [
  'create table if not exists app_private.event_reservation_windows',
  'references public.club_events(id) on delete restrict',
  'capacity integer not null check(capacity between 1 and 100000)',
  "status in ('draft','scheduled','closed')",
  'alter table app_private.event_reservation_windows enable row level security',
  'revoke all on app_private.event_reservation_windows from public,anon,authenticated',
  'app_private.admin_event_booking_rules_audit',
  'alter table app_private.admin_event_booking_rules_audit enable row level security',
  'revoke all on app_private.admin_event_booking_rules_audit from public,anon,authenticated'
 ])assert.ok(sql.includes(marker),marker);
 assert.doesNotMatch(sql,/grant (?:select|update|delete|insert) on app_private\./);
});
test('stage87: four admin RPCs gate their own MFA before accessing event/slot data',()=>{
 for(const name of ['admin_list_advanced_events','admin_save_advanced_event',
  'admin_list_event_reservation_windows','admin_save_event_reservation_window']){
  const heading='create or replace function public.'+name+'(';
  const section=sql.split(heading)[1]?.split('$fn$;')[0];
  assert.ok(section,name);
  assert.match(section,/app_private\.is_admin\(\)/,name);
  assert.match(section,/auth\.uid\(\)/,name);
  assert.ok(sql.includes('grant execute on function public.'+name+'('),name);
  assert.ok(sql.includes('revoke all on function public.'+name+'('),name);
 }
 assert.doesNotMatch(sql,/grant execute on function public\.admin_[^;]*?\)\s+to (?:anon|public)/i);
});
test('stage87: SQL forbids open/full, enforces premium/paid price, no auto booking or payment',()=>{
 for(const marker of [
  "p_booking_status not in ('not_open','closed')",
  "p_access_kind not in ('public','premium')",
  "p_booking_kind not in ('free','paid')",
  "p_booking_kind='paid' and p_price_cents=0",
  "p_premium_price_cents>p_price_cents",
  "p_priority_kind not in ('none','premium')",
  "p_priority_kind='premium'",
  "p_priority_ends_at>p_starts_at",
  'p_expected_updated_at',
  "errcode='40001'",
  'admin_event_booking_rules_audit'
 ])assert.ok(sql.includes(marker),marker);
 assert.doesNotMatch(sql,/stripe\.checkout|sk_live_|insert into public\.event_reservations|create table.*tickets/i);
});
test('stage87: global parent trigger prevents legacy free editor from undermining active window quotas',()=>{
 for(const marker of [
  'create or replace function app_private.guard_event_reservation_consistency()',
  "v_quota>new.capacity",
  "w.closes_at>new.starts_at",
  "new.access_kind='premium' and w.access_kind='public'",
  "new.priority_kind<>'premium'",
  "new.booking_status not in ('not_open','closed')",
  'create trigger club_event_reservation_consistency_guard',
  'before insert or update on public.club_events'
 ])assert.ok(sql.includes(marker),marker);
 assert.match(originalEvents,/rpcList:'admin_list_free_events',rpcSave:'admin_save_free_event'/);
});
test('stage87: transactional row locks, overlap rejection and event-level quota ceiling',()=>{
 for(const marker of [
  'where id=p_event_id for update',
  'where id=p_id and event_id=p_event_id for update',
  'w.opens_at<p_closes_at and p_opens_at<w.closes_at',
  'v_other_capacity+p_capacity>v_event.capacity',
  "p_closes_at>v_event.starts_at",
  "p_access_kind='premium' and v_event.access_kind='public'",
  "v_event.priority_kind<>'premium'",
  "v_old.status='closed' and p_status<>'closed'",
  "w.status<>'closed'",
  "Window changed: refresh required"
 ])assert.ok(sql.includes(marker),marker);
});
test('stage87: admin module mounts behind MFA, preserves old free editor and requires event capability',()=>{
 const ids=ADMIN_MODULES.map(x=>x.id);
 assert.ok(ids.includes('events'));
 assert.ok(ids.includes('event-rules'));
 assert.equal(new Set(ids).size,ids.length);
 assert.match(center,/case 'events':mountAdminFreeEvents\(view,api,verified.userId\)/);
 assert.match(center,/case 'event-rules':void mountAdminAdvancedEvents\(view,api,verified.userId\)/);
 assert.match(editor,/adminSessionStatus\(api,userId\)/);
 assert.match(editor,/x.level==='aal2'/);
 assert.match(editor,/admin_list_advanced_events/);
 assert.match(editor,/admin_save_advanced_event/);
 assert.match(editor,/admin_save_event_reservation_window/);
 assert.match(editor,/confirmation/);
 assert.match(editor,/Aucune réservation ouverte/);
 assert.equal(availableAdminModules(ADMIN_MODULES,{eventsReady:false})
  .some(x=>x.id==='event-rules'),false);
 assert.equal(availableAdminModules(ADMIN_MODULES,{eventsReady:true})
  .some(x=>x.id==='event-rules'),true);
 assert.doesNotMatch(editor,/\.insert\(|\.delete\(|\.update\(|innerHTML\s*=/);
});
test('stage87: public events remain informational without QR or payment actions',()=>{
 assert.match(publicEvents,/Réservation en ligne indisponible/);
 assert.match(publicEvents,/Réservations non activées sur ce site/);
 assert.match(publicEvents,/premium_price_cents/);
 assert.doesNotMatch(publicEvents,/stripe\.checkout|payWith|api\.rpc\('reserve_event/);
});
