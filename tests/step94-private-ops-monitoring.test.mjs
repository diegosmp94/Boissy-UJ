import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OPS_CHECKS,OPS_SERVICES,OPS_COMPONENTS,OPS_CATEGORIES,
 OPS_SEVERITIES,OPS_RESOLUTIONS,safeOpsSnapshot,
 safeOpsReportInput,safeOpsResolutionInput} from '../ops-diagnostics.mjs';
import {ADMIN_MODULES} from '../admin-center.mjs';
import {availableAdminModules} from '../admin-navigation.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610270012_step94_private_ops_monitoring.sql');
const ui=read('admin-operations-monitor.mjs');
const hub=read('admin-center.mjs');
const probe=read('admin-control-reliability.mjs');
const css=read('admin-console.css');
const incidentId='11111111-1111-4111-8111-111111111111';
const sample=()=>({
 version:1,scope:'aggregates_only',checked_at:'2026-10-27T16:00:00Z',
 services:Object.fromEntries(Object.keys(OPS_SERVICES).map(k=>[k,
  ['postgres_rpc','admin_mfa'].includes(k)?'verified_now':'not_checked'])),
 checks:Object.keys(OPS_CHECKS).map(k=>({
  code:k,count:k==='retention_unapproved'?8:0,
  state:k==='retention_unapproved'?'review':'ok',observed:'database_now',
  label:'database-label-not-used'
 })),
 open_incidents:1,high_incidents:1,
 incidents:[{id:incidentId,component:'media_purge',category:'deferred_job',
  severity:'high',opened_at:'2026-10-27T12:00:00Z',
  resolved_at:null,resolution:null}],
 notes:'never display this'
});
test('step94: strict allowlist of operational checks, no human identifiers',()=>{
 assert.equal(Object.keys(OPS_CHECKS).length,9);
 assert.equal(Object.keys(OPS_SERVICES).length,7);
 assert.equal(Object.keys(OPS_COMPONENTS).length,10);
 assert.equal(Object.keys(OPS_CATEGORIES).length,6);
 assert.equal(Object.keys(OPS_SEVERITIES).length,3);
 assert.equal(Object.keys(OPS_RESOLUTIONS).length,4);
 assert.equal(Object.keys(OPS_CHECKS).some(x=>/email|user|phone|name|token|password/.test(x)),false);
});
test('step94: snapshot ignores server free-text and passes only fixed codes and counters',()=>{
 const data=sample(),safe=safeOpsSnapshot(data);
 assert.ok(safe);assert.equal(safe.checks.length,9);
 assert.equal(safe.checks.find(x=>x.code==='retention_unapproved').count,8);
 assert.equal(safe.checks[0].label,OPS_CHECKS[safe.checks[0].code]);
 assert.equal(safe.services.public_site,'not_checked');
 assert.equal(safe.services.postgres_rpc,'verified_now');
 assert.equal(safe.openIncidents,1);assert.equal(safe.highIncidents,1);
 assert.equal(Object.hasOwn(safe,'notes'),false);
 assert.equal(Object.hasOwn(safe.incidents[0],'email'),false);
 assert.equal(safe.incidents[0].component,'media_purge');
});
test('step94: fail closed on missing check, duplicate, fake pass, raw identity or malformed state',()=>{
 const data=sample();
 for(const candidate of [
  {...data,version:2},
  {...data,scope:'user_rows'},
  {...data,checks:data.checks.slice(1)},
  {...data,checks:[...data.checks.slice(0,-1),data.checks[0]]},
  {...data,checks:data.checks.map((c,i)=>i===0?{...c,count:-1}:c)},
  {...data,checks:data.checks.map((c,i)=>i===0?{...c,observed:'not_verified'}:c)},
  {...data,services:{...data.services,storage_api:'verified_without_probe'}},
  {...data,open_incidents:0},
  {...data,incidents:[{...data.incidents[0],severity:'critical'}]},
  {...data,incidents:[{...data.incidents[0],id:'user@example.org'}]},
  {...data,incidents:[{...data.incidents[0],resolution:'recovered'}]},
 ])assert.equal(safeOpsSnapshot(candidate),null);
});
test('step94: reports only fixed triage codes; no injected errors or arbitrary free text',()=>{
 assert.equal(safeOpsReportInput('storage','timeout','high'),true);
 assert.equal(safeOpsReportInput('foo','timeout','high'),false);
 assert.equal(safeOpsReportInput('storage','raw_exception','high'),false);
 assert.equal(safeOpsReportInput('storage','timeout','token'),false);
 assert.equal(safeOpsResolutionInput(incidentId,'recovered','2026-10-27T12:00:00Z'),true);
 assert.equal(safeOpsResolutionInput(incidentId,'stack trace','2026-10-27T12:00:00Z'),false);
 assert.equal(safeOpsResolutionInput('not-uuid','recovered','2026-10-27T12:00:00Z'),false);
});
test('step94: database schema is private, RLS protected, anonymous direct access denied',()=>{
 for(const table of ['ops_incidents','ops_incident_audit']){
  assert.ok(sql.includes('create table if not exists app_private.'+table),table);
  assert.ok(sql.includes('alter table app_private.'+table+' enable row level security'),table);
  assert.ok(sql.includes('revoke all on app_private.'+table+' from public,anon,authenticated'),table);
 }
 assert.match(sql,/create unique index if not exists ops_only_one_open_incident_per_category/);
 assert.doesNotMatch(sql,/grant (?:select|insert|update|delete) on app_private\.ops_/i);
 assert.doesNotMatch(sql,/\b(error_message|error_body|request_payload|access_token|email_address|ip_address|full_name)\b/i);
 assert.doesNotMatch(sql,/delete from public\.|delete from app_private\.|update public\.|insert into public\./i);
});
test('step94: MFA AAL2 required for every privileged operational RPC',()=>{
 for(const fn of ['admin_ops_snapshot()',
  'admin_ops_report_incident(text,text,text)',
  'admin_ops_resolve_incident(uuid,text,timestamptz)']){
  assert.ok(sql.includes('revoke all on function public.'+fn),fn);
  assert.ok(sql.includes('grant execute on function public.'+fn),fn);
  const code=sql.split('create or replace function public.'+fn.split('(')[0]+'(')[1]
   ?.split('$ops$;')[0];
  assert.ok(code,fn);
  assert.match(code,/auth\.uid\(\)/,fn);
  assert.match(code,/app_private\.is_admin\(\)/,fn);
 }
 assert.match(sql,/perform pg_catalog\.pg_advisory_xact_lock\(24094,1\)/);
 assert.match(sql,/if v_recent>=20/);
 assert.match(sql,/where id=p_id for update/);
 assert.match(sql,/v_row.resolved_at is not null/);
 assert.match(sql,/v_row.opened_at is distinct from p_expected_opened_at/);
});
test('step94: SQL reports only aggregate counters, actual deferred queues and stated unverified services',()=>{
 const snapshot=sql.split('create or replace function public.admin_ops_snapshot()')[1]
   .split('create or replace function public.admin_ops_report_incident(')[0];
 for(const expected of [
  'app_private.news_media_purge_jobs',
  "interval '2 hours'",
  'app_private.privacy_rights_requests',
  "interval '7 days'",
  'public.role_requests',
  'public.club_events',
  'app_private.event_reservation_windows',
  'public.club_awards',
  'public.news_media_assets',
  'app_private.privacy_retention_register',
  "pg_catalog.jsonb_build_object(",
  "'public_site','not_checked'",
  "'storage_api','not_checked'",
  "'stripe_test','not_checked'",
  "'email_delivery','not_checked'"
 ])assert.ok(snapshot.includes(expected),expected);
 assert.doesNotMatch(snapshot,/select \* from auth\.users|select .*\.email|storage_path|before_snapshot|access_token|http_get|pg_net|fetch\(/i);
 assert.match(snapshot,/scope','aggregates_only/);
});
test('step94: admin UI discards non-allowlisted data and fails closed on outage',()=>{
 for(const item of [
  'adminSessionStatus(api,userId)',
  "s.level==='aal2'",
  "s.roles?.includes('admin')",
  "api.rpc('admin_ops_snapshot')",
  "safeOpsSnapshot(response.data)",
  "api.rpc('admin_ops_report_incident',args)",
  "api.rpc('admin_ops_resolve_incident',args)",
  'serviceRows.replaceChildren()',
  'alertRows.replaceChildren()',
  'incidentRows.replaceChildren()',
  'Aucun état confirmé',
  'non vérifiés', // textual search may be case-sensitive
  'Vérifiez la résolution réellement effectuée'
 ])assert.ok(ui.includes(item),item);
 assert.doesNotMatch(ui,/console\.log|console\.error|\.innerHTML\s*=|localStorage|sessionStorage|\.delete\(|service_role|sk_live_|stack_trace/);
 assert.match(css,/\.admin-ops-service-grid/);
 assert.match(css,/@media\(max-width:600px\)/);
});
test('step94: optional module hidden if protected backend snapshot not available',()=>{
 assert.ok(ADMIN_MODULES.some(x=>x.id==='operations'));
 assert.equal(new Set(ADMIN_MODULES.map(x=>x.id)).size,ADMIN_MODULES.length);
 assert.equal(availableAdminModules(ADMIN_MODULES).some(x=>x.id==='operations'),false);
 assert.equal(availableAdminModules(ADMIN_MODULES,{operationsReady:true})
  .some(x=>x.id==='operations'),true);
 assert.match(probe,/api\.rpc\('admin_ops_snapshot'\)/);
 assert.match(hub,/case 'operations':void mountAdminOperations\(view,api,verified.userId\)/);
 assert.match(hub,/const availableModules=availableAdminModules\(ADMIN_MODULES,\{eventsReady,eventRulesReady,scannerReady,awardsReady,privacyReady,operationsReady,/);
});
