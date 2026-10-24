import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 createServerOnlyFreeTicketCode,parseFreeTicketCode,
 digestFreeTicketSecret,equalsRecordedTicketDigest
} from '../supabase/functions/_shared/free-ticket-qr-protocol.mjs';
import {STAGING_PROPOSED_MIGRATIONS} from '../scripts/staging-migration-plan.mjs';

const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610240001_free_event_tickets_gated.sql');
const priv=read('scripts/free-ticket-staging-privileges.sql');

const procedure=(name,next)=>{
 const a=sql.indexOf('create or replace function public.'+name);
 assert.ok(a>=0,name+' function is missing');
 const b=next?sql.indexOf('create or replace function public.'+next,a+1):
  sql.indexOf('-- PostgreSQL',a+1);
 assert.ok(b>a,name+' function end is missing');
 return sql.slice(a,b);
};

test('free tickets remain invisible and disabled by default, including repeat installs',()=>{
 assert.match(sql,/create table if not exists app_private\.free_ticketing_gate/);
 assert.match(sql,/enabled boolean not null default false/);
 assert.match(sql,/values \(1,false\) on conflict\(id\) do update\s+set enabled=false/);
 for(const name of ['free_ticketing_gate','free_event_tickets','free_event_ticket_audit']){
  assert.match(sql,new RegExp('alter table app_private\\.'+name+' enable row level security'));
  assert.match(sql,new RegExp('revoke all on app_private\\.'+name+' from public,anon,authenticated'));
 }
 assert.doesNotMatch(sql,/grant (?:select|insert|update|delete|all)\s+on app_private\.free_/i);
 assert.doesNotMatch(sql,/public\.free_event_tickets/);
});
test('one private QR ticket per member and event, with no plaintext QR stored',()=>{
 assert.match(sql,/event_id uuid not null references public\.club_events\(id\)/);
 assert.match(sql,/member_user_id uuid not null references auth\.users\(id\)/);
 assert.match(sql,/token_sha256 text not null unique/);
 assert.match(sql,/unique\(event_id,member_user_id\)/);
 assert.match(sql,/token_sha256 ~ '\^\[0-9a-f\]\{64\}\$'/);
 assert.match(sql,/status in \('issued','cancelled','checked_in'\)/);
 assert.match(sql,/constraint free_ticket_lifecycle_valid check/);
 assert.doesNotMatch(sql,/raw_qr|plaintext_secret|member_email|member_phone|full_name/);
 const ticket=createServerOnlyFreeTicketCode('22222222-2222-4222-8222-222222222222');
 const parsed=parseFreeTicketCode(ticket);
 assert.equal(parsed.eventId,'22222222-2222-4222-8222-222222222222');
 assert.equal(equalsRecordedTicketDigest(digestFreeTicketSecret(parsed.secret),
  digestFreeTicketSecret(parsed.secret)),true);
 assert.notEqual(parsed.secret,digestFreeTicketSecret(parsed.secret));
});
test('SQL matches Step 61 BUJ1 cryptographic format, not guessable ID-only codes',()=>{
 const issue=procedure('request_free_event_ticket','cancel_my_free_event_ticket');
 assert.match(issue,/v_secret:=encode\(extensions\.gen_random_bytes\(32\),'hex'\)/);
 assert.match(issue,/encode\(extensions\.digest\(decode\(v_secret,'hex'\),'sha256'\),'hex'\)/);
 assert.match(issue,/return 'BUJ1:'\|\|p_event_id::text\|\|':'\|\|v_secret/);
 assert.match(issue,/insert into app_private\.free_event_tickets/);
 assert.doesNotMatch(issue,/return [^;]*(?:v_ticket_id|v_actor|member_user_id)/);
});
test('ticket issue is fail-closed behind authenticated members and a locked switch',()=>{
 const issue=procedure('request_free_event_ticket','cancel_my_free_event_ticket');
 assert.match(issue,/v_actor uuid := \(select auth\.uid\(\)\)/);
 assert.match(issue,/auth\.jwt\(\)->>'is_anonymous'/);
 assert.match(issue,/select enabled into v_gate from app_private\.free_ticketing_gate where id=1 for share/);
 assert.match(issue,/if not coalesce\(v_gate,false\)/);
 assert.match(issue,/where id=p_event_id for update/);
 assert.match(issue,/v_event\.published is distinct from true/);
 for(const field of ["v_event.access_kind <> 'public'","v_event.booking_kind <> 'free'",
  "v_event.price_cents <> 0","v_event.booking_status <> 'open'",
  "v_event.priority_kind <> 'none'","v_event.capacity is null",
  'v_event.starts_at <= clock_timestamp()'])
  assert.ok(issue.includes(field),field);
 assert.match(issue,/exists \(\s*select 1 from app_private\.free_event_tickets/);
 assert.match(issue,/select count\(\*\) into v_used from app_private\.free_event_tickets/);
 assert.match(issue,/status in \('issued','checked_in'\)/);
 assert.match(issue,/if v_used >= v_event\.capacity/);
 assert.ok(issue.indexOf('for update')<issue.indexOf('select count(*) into v_used'),
  'Lock event before counting seats to prevent concurrent overbooking');
});
test('member cancellation cannot cancel other member, used or started tickets',()=>{
 const cancel=procedure('cancel_my_free_event_ticket','checkin_free_event_ticket');
 assert.match(cancel,/auth\.uid\(\)/);
 assert.match(cancel,/auth\.jwt\(\)->>'is_anonymous'/);
 assert.match(cancel,/select enabled into v_gate.+for share/);
 assert.match(cancel,/where id=p_event_id for update/);
 assert.match(cancel,/v_start <= clock_timestamp\(\)/);
 assert.match(cancel,/where event_id=p_event_id and member_user_id=v_actor\s+and status='issued'/);
 assert.match(cancel,/status='cancelled',cancelled_at=clock_timestamp\(\)/);
 assert.match(cancel,/insert into app_private\.free_event_ticket_audit/);
 assert.doesNotMatch(cancel,/member_user_id=p_user_id|return .*token_sha256/);
});
test('scanner requires MFA admin, event ID, a limited entry window and atomic one-time transition',()=>{
 const check=procedure('checkin_free_event_ticket',null);
 assert.match(check,/not coalesce\(\(select app_private\.is_admin\(\)\),false\)/);
 assert.match(check,/auth\.uid\(\)/);
 assert.match(check,/select enabled into v_gate.+for share/);
 assert.match(check,/p_qr !~ \('\^BUJ1:'/);
 assert.match(check,/token_sha256=encode\(/);
 assert.match(check,/where id=p_event_id for update/);
 assert.match(check,/status='issued' and\s+token_sha256/);
 assert.match(check,/for update/);
 assert.match(check,/where id=v_ticket_id and status='issued'/);
 assert.match(check,/status='checked_in',checked_in_at=clock_timestamp\(\)/);
 assert.match(check,/v_event\.starts_at-interval '90 minutes'/);
 assert.match(check,/clock_timestamp\(\) >= v_event\.ends_at/);
 assert.match(check,/return false;/);
 assert.match(check,/insert into app_private\.free_event_ticket_audit/);
 assert.doesNotMatch(check,/return\s+v_actor|return\s+v_secret|return\s+v_ticket_id/);
});
test('privileged RPCs grant only signed-in callers and independently re-check permissions',()=>{
 for(const name of ['request_free_event_ticket(uuid)',
  'cancel_my_free_event_ticket(uuid)','checkin_free_event_ticket(uuid,text)']){
  assert.ok(sql.includes('revoke all on function public.'+name),'revoke '+name);
  assert.ok(sql.includes('grant execute on function public.'+name),'grant '+name);
 }
 assert.match(sql,/from public,anon,authenticated/);
 assert.match(sql,/to authenticated/);
 assert.match(sql,/security definer set search_path=''/);
 assert.doesNotMatch(sql,/set search_path='public'|security definer(?! set search_path)/i);
 assert.doesNotMatch(sql,/create policy .* using \(true\)|grant execute on function .* to anon/i);
});
test('staging-only, read-only assertions check actual role privileges, RLS and OFF switch',()=>{
 assert.match(priv,/STAGING ONLY/);
 assert.match(priv,/enabled into v_enabled from app_private\.free_ticketing_gate/);
 assert.match(priv,/if v_enabled is distinct from false/);
 assert.match(priv,/relrowsecurity/);
 assert.match(priv,/has_table_privilege\('anon'/);
 assert.match(priv,/has_table_privilege\('authenticated'/);
 assert.match(priv,/has_function_privilege\('anon'/);
 assert.match(priv,/has_function_privilege\('authenticated'/);
 assert.doesNotMatch(priv,/\bupdate\b\s+app_private|\binsert\b\s+into\s+app_private|\bdelete\b\s+from\s+app_private/i);
 assert.equal(STAGING_PROPOSED_MIGRATIONS.at(-1).file,
  '202610240001_free_event_tickets_gated.sql');
});
test('migration is transactional, static QA is not a substitute for live two-scanner acceptance',()=>{
 assert.match(sql,/^begin;/m);
 assert.match(sql,/commit;\s*$/);
 assert.match(sql,/DO NOT APPLY TO PRODUCTION/);
 assert.doesNotMatch(sql,/stripe|payment_intent|checkout\.sessions|sk_live_/i);
 assert.match(priv,/not a live multi-account or/i);
});
