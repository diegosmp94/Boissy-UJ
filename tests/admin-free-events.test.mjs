import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateFreeEventDraft,eventRpcArgs,eventDateInput} from '../admin-event-rules.mjs';
import {ADMIN_MODULES} from '../admin-center.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610210022_admin_free_events.sql');
const code=read('admin-management.mjs'),hub=read('admin-center.mjs');
const draft={
 title:'Tournoi du club',description:'Tournoi gratuit organisé par le club.',
 category:'sport',start:'2026-11-14T13:00',end:'2026-11-14T17:00',
 location:'Terrain du club',capacity:'90',publish:false
};
test('free event draft supports valid real details and unpublished records',()=>{
 assert.equal(validateFreeEventDraft(draft),null);
 assert.equal(validateFreeEventDraft({...draft,start:'',end:'',publish:false}),null);
 assert.match(validateFreeEventDraft({...draft,start:'',end:'',publish:true}),/publication/);
 assert.match(validateFreeEventDraft({...draft,start:'2026-11-14T13:00',end:''}),/deux dates/);
 assert.match(validateFreeEventDraft({...draft,end:'2026-11-14T12:00'}),/postérieure/);
});
test('free events use strict length, category and capacity checks',()=>{
 assert.match(validateFreeEventDraft({...draft,title:'X'}),/titre/);
 assert.match(validateFreeEventDraft({...draft,title:'A'.repeat(151)}),/titre/);
 assert.match(validateFreeEventDraft({...draft,description:'A'.repeat(4001)}),/description/);
 assert.match(validateFreeEventDraft({...draft,location:'A'.repeat(161)}),/lieu/);
 assert.match(validateFreeEventDraft({...draft,category:'paid'}),/catégorie/);
 for(const capacity of ['0','-1','1.5','100001','bad']){
  assert.match(validateFreeEventDraft({...draft,capacity}),/capacité/);
 }
 assert.equal(validateFreeEventDraft({...draft,capacity:''}),null);
});
test('event save uses optimistic updated_at version and exact RFC3339 datetimes',()=>{
 const row={id:'event-one',updated_at:'2026-10-21T18:30:00+00:00'};
 const args=eventRpcArgs(draft,row);
 assert.equal(args.p_id,'event-one');
 assert.equal(args.p_expected_updated_at,row.updated_at);
 assert.equal(args.p_publish,false);
 assert.equal(args.p_capacity,90);
 assert.equal(args.p_location_label,'Terrain du club');
 assert.match(args.p_starts_at,/^2026-11-14T/);
 const brandNew=eventRpcArgs({...draft,capacity:''});
 assert.equal(brandNew.p_capacity,null);
 assert.equal(brandNew.p_id,null);
 assert.throws(()=>eventRpcArgs({...draft,category:'premium'}));
});
test('local start and end timestamps convert cleanly from API records',()=>{
 assert.equal(eventDateInput(null),'');
 assert.equal(eventDateInput('not-a-date'),'');
 assert.match(eventDateInput('2026-11-14T13:00:00Z'),/^2026-11-14T\d\d:\d\d$/);
});
test('MFA-based SQL listing and save never allow anonymous writers',()=>{
 assert.match(sql,/public\.admin_list_free_events\(\)/);
 assert.match(sql,/public\.admin_save_free_event\(/);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/app_private\.is_admin\(\)/);
 assert.match(sql,/revoke all on function public\.admin_list_free_events\(\) from public,anon/);
 assert.match(sql,/revoke all on function public\.admin_save_free_event/);
 assert.match(sql,/grant execute on function public\.admin_save_free_event/);
 assert.match(sql,/alter table app_private\.admin_free_events_audit enable row level security/);
 assert.match(sql,/revoke all on table app_private\.admin_free_events_audit from public,anon,authenticated/);
 assert.match(sql,/Event changed: refresh before saving/);
 assert.doesNotMatch(sql,/grant (insert|update|delete) on public\.club_events to anon/i);
});
test('free event SQL enforces no payment and keeps booking inactive',()=>{
 assert.match(sql,/'public','free',0,null,p_capacity,'not_open','none',p_publish/);
 assert.match(sql,/price_cents=0,premium_price_cents=null/);
 assert.match(sql,/booking_status='not_open',priority_kind='none'/);
 assert.match(sql,/v_old\.booking_kind<>'free'/);
 assert.match(sql,/v_old\.access_kind<>'public'/);
 assert.match(sql,/p_publish and \(p_starts_at is null or p_ends_at is null\)/);
});
test('real event editor is registered behind admin MFA route',()=>{
 assert.equal(ADMIN_MODULES.some(x=>x.id==='events'),true);
 assert.match(hub,/case 'events':mountAdminFreeEvents\(view,api,verified.userId\)/);
 assert.match(hub,/const check=await adminSessionStatus\(api,verified.userId\)/);
 assert.match(code,/rpcList:'admin_list_free_events',rpcSave:'admin_save_free_event'/);
 assert.match(code,/validate:validateFreeEventDraft/);
 assert.match(code,/args:eventRpcArgs/);
 assert.match(code,/if\(!await guarded\(api,userId\)\)/);
 assert.match(code,/if\(requiresConfirmation&&key!==confirmKey\)/);
 assert.doesNotMatch(code,/\.insert\(|\.update\(|\.delete\(|innerHTML\s*=/);
});

test('missing database migration keeps free event module hidden instead of showing broken controls',()=>{
 assert.match(hub,/const eventProbe=await api\.rpc\('admin_list_free_events'\)/);
 assert.match(hub,/const eventsReady=!eventProbe\.error&&Array\.isArray\(eventProbe\.data\)/);
 assert.match(hub,/availableAdminModules\(ADMIN_MODULES,\{eventsReady,coachTeamsReady,mediaReady,newsRevisionsReady\}\)/);
 assert.match(hub,/if\(serial!==currentGeneration\|\|!root\.isConnected\)return/);
});
