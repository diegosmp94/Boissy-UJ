-- Boissy-UJ step 94: defensive operational diagnostics, no raw logs or PII.
-- Admin MFA AAL2 only. Does not query external service health or alter queues.
begin;

create table if not exists app_private.ops_incidents (
 id uuid primary key default pg_catalog.gen_random_uuid(),
 component text not null check(component in (
  'authentication','admin_console','media_purge','privacy_requests',
  'events','awards','sports_import','web_public','storage','billing_test')),
 category text not null check(category in (
  'timeout','unavailable','permission_denied','deferred_job','inconsistent_state','manual_review')),
 severity text not null check(severity in ('low','medium','high')),
 opened_at timestamptz not null default pg_catalog.clock_timestamp(),
 resolved_at timestamptz,
 resolution text check(resolution is null or resolution in (
  'recovered','investigated','not_reproducible','superseded')),
 check((resolved_at is null)=(resolution is null)),
 check(resolved_at is null or resolved_at>=opened_at)
);
create unique index if not exists ops_only_one_open_incident_per_category
 on app_private.ops_incidents(component,category)
 where resolved_at is null;
create index if not exists ops_open_incidents_by_age
 on app_private.ops_incidents(opened_at desc)
 where resolved_at is null;
alter table app_private.ops_incidents enable row level security;
revoke all on app_private.ops_incidents from public,anon,authenticated;

create table if not exists app_private.ops_incident_audit (
 id bigint generated always as identity primary key,
 incident_id uuid not null references app_private.ops_incidents(id) on delete restrict,
 action text not null check(action in ('reported','resolved')),
 code text not null check(code in (
  'opened','recovered','investigated','not_reproducible','superseded')),
 happened_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index if not exists ops_incident_audit_event_time
 on app_private.ops_incident_audit(incident_id,happened_at desc);
alter table app_private.ops_incident_audit enable row level security;
revoke all on app_private.ops_incident_audit from public,anon,authenticated;

-- Aggregated overview. Counts only; no personal rows, IDs, emails,
-- error strings, object paths or external service probes.
create or replace function public.admin_ops_snapshot()
returns jsonb language plpgsql volatile security definer set search_path=''
as $ops$
declare
 v_now timestamptz:=pg_catalog.clock_timestamp();
 v_checks jsonb;
 v_incidents jsonb;
 v_open bigint;
 v_high bigint;
begin
 if (select auth.uid()) is null or
    not coalesce((select app_private.is_admin()),false) then
  raise exception 'Administrator MFA AAL2 required' using errcode='42501';
 end if;

 with checks(code,label,issue_count,source_status) as (
  values
  ('media_purge_delayed'::text,'Purges médias en attente depuis 2 h'::text,
   (select count(*)::bigint from app_private.news_media_purge_jobs
     where completed_at is null and requested_at<v_now-interval '2 hours'),'live'::text),
  ('privacy_overdue','Demandes RGPD hors délai',
   (select count(*)::bigint from app_private.privacy_rights_requests
     where decided_at is null and due_at<v_now),'live'),
  ('privacy_due_soon','Demandes RGPD arrivant à échéance sous 7 jours',
   (select count(*)::bigint from app_private.privacy_rights_requests
     where decided_at is null and due_at>=v_now
       and due_at<v_now+interval '7 days'),'live'),
  ('role_review_delayed','Demandes de rôle en attente depuis 7 jours',
   (select count(*)::bigint from public.role_requests
     where status='pending' and requested_at<v_now-interval '7 days'),'live'),
  ('event_booking_expired','Événements dont les réservations restent ouvertes après la fin',
   (select count(*)::bigint from public.club_events
     where booking_status='open' and ends_at<v_now),'live'),
  ('event_windows_expired','Créneaux réservables encore programmés après leur fin',
   (select count(*)::bigint from app_private.event_reservation_windows
     where status='scheduled' and closes_at<v_now),'live'),
  ('awards_expired','Scrutins Awards encore ouverts après clôture prévue',
   (select count(*)::bigint from public.club_awards
     where voting_status='open' and closes_at<v_now),'live'),
  ('media_unreviewed_visible','Médias visibles sans contrôle des droits enregistré',
   (select count(*)::bigint from public.news_media_assets
     where visible=true and rights_reviewed is distinct from true),'live'),
  ('retention_unapproved','Ensembles RGPD sans durée de conservation approuvée',
   (select count(*)::bigint from app_private.privacy_retention_register
     where approved_at is null),'review')
 )
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'code',code,'label',label,'count',issue_count,
   'state',case when source_status='review' then 'review'
    when issue_count>0 then 'attention' else 'ok' end,
   'observed','database_now'
  ) order by code),'[]'::jsonb)
 into v_checks from checks;

 select count(*),count(*) filter(where severity='high')
 into v_open,v_high from app_private.ops_incidents where resolved_at is null;

 select coalesce(pg_catalog.jsonb_agg(
  pg_catalog.jsonb_build_object(
   'id',x.id,'component',x.component,'category',x.category,
   'severity',x.severity,'opened_at',x.opened_at,
   'resolved_at',x.resolved_at,'resolution',x.resolution)
  order by x.opened_at desc,x.id),'[]'::jsonb)
 into v_incidents from (
  select id,component,category,severity,opened_at,resolved_at,resolution
  from app_private.ops_incidents
  order by opened_at desc,id desc limit 30
 ) x;

 return pg_catalog.jsonb_build_object(
  'version',1,'checked_at',v_now,'scope','aggregates_only',
  'services',pg_catalog.jsonb_build_object(
   'postgres_rpc','verified_now',
   'admin_mfa','verified_now',
   'public_site','not_checked',
   'storage_api','not_checked',
   'stripe_test','not_checked',
   'fff_import','not_checked',
   'email_delivery','not_checked'),
  'checks',v_checks,
  'open_incidents',v_open,'high_incidents',v_high,
  'incidents',v_incidents,
  'notes','No external uptime, auth delivery, Storage bytes or raw error logs were checked'
 );
end;
$ops$;

-- Admin-only categorical report. No raw errors, URLs, request payloads or PII.
create or replace function public.admin_ops_report_incident(
 p_component text,p_category text,p_severity text
) returns uuid language plpgsql volatile security definer set search_path=''
as $ops$
declare
 v_incident uuid;
 v_recent bigint;
begin
 if (select auth.uid()) is null or
  not coalesce((select app_private.is_admin()),false) then
  raise exception 'Administrator MFA AAL2 required' using errcode='42501';end if;
 if p_component is null or p_component not in(
  'authentication','admin_console','media_purge','privacy_requests',
  'events','awards','sports_import','web_public','storage','billing_test')
  or p_category is null or p_category not in (
  'timeout','unavailable','permission_denied','deferred_job',
  'inconsistent_state','manual_review')
  or p_severity is null or p_severity not in ('low','medium','high') then
  raise exception 'Invalid operational category' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(24094,1);
 select count(*) into v_recent from app_private.ops_incidents
  where opened_at>pg_catalog.clock_timestamp()-interval '1 hour';
 if v_recent>=20 then
  raise exception 'Operational incident rate limit' using errcode='23514';end if;
 insert into app_private.ops_incidents(component,category,severity)
  values(p_component,p_category,p_severity)
  returning id into v_incident;
 insert into app_private.ops_incident_audit(incident_id,action,code)
  values(v_incident,'reported','opened');
 return v_incident;
end;
$ops$;

-- Safe resolution: optimistic lock and a fixed classification, no free text.
create or replace function public.admin_ops_resolve_incident(
 p_id uuid,p_resolution text,p_expected_opened_at timestamptz
) returns boolean language plpgsql volatile security definer set search_path=''
as $ops$
declare
 v_row app_private.ops_incidents%rowtype;
begin
 if (select auth.uid()) is null or
  not coalesce((select app_private.is_admin()),false) then
  raise exception 'Administrator MFA AAL2 required' using errcode='42501';end if;
 if p_resolution is null or p_resolution not in (
  'recovered','investigated','not_reproducible','superseded') then
  raise exception 'Resolution code invalid' using errcode='22023';end if;
 select * into v_row from app_private.ops_incidents
  where id=p_id for update;
 if v_row.id is null or v_row.resolved_at is not null or
  p_expected_opened_at is null or
  v_row.opened_at is distinct from p_expected_opened_at then
  raise exception 'Incident already resolved or changed'
   using errcode='40001';end if;
 update app_private.ops_incidents set
   resolved_at=pg_catalog.clock_timestamp(),resolution=p_resolution
  where id=p_id and resolved_at is null;
 if not found then raise exception 'Incident changed' using errcode='40001';end if;
 insert into app_private.ops_incident_audit(incident_id,action,code)
  values(p_id,'resolved',p_resolution);
 return true;
end;
$ops$;

revoke all on function public.admin_ops_snapshot()
 from public,anon,authenticated,service_role;
revoke all on function public.admin_ops_report_incident(text,text,text)
 from public,anon,authenticated,service_role;
revoke all on function public.admin_ops_resolve_incident(uuid,text,timestamptz)
 from public,anon,authenticated,service_role;
grant execute on function public.admin_ops_snapshot() to authenticated;
grant execute on function public.admin_ops_report_incident(text,text,text)
 to authenticated;
grant execute on function public.admin_ops_resolve_incident(uuid,text,timestamptz)
 to authenticated;
comment on table app_private.ops_incidents is
 'MFA-only categorical operational incidents. No error bodies, personal IDs or URLs stored.';
commit;
