-- Boissy-UJ step 89: SECURITY-REVIEWED STAGING ONLY QR entry control.
-- Requires step 87 AND isolated step 88 ticket migration.
-- NEVER apply on Supabase primary project dahzewvbybujqhogumte.
-- No admin/client control can flip the feature gate in this migration.
begin;

create table if not exists app_private.free_ticket_entry_attempts (
 id bigint generated always as identity primary key,
 event_id uuid not null references public.club_events(id) on delete restrict,
 ticket_id uuid references app_private.free_event_tickets(id) on delete restrict,
 actor_user_id uuid not null references auth.users(id) on delete restrict,
 outcome text not null check (outcome in (
  'accepted','already_used','cancelled','not_found',
  'invalid_code','event_unavailable','rate_limited')),
 created_at timestamptz not null default clock_timestamp()
);
create index if not exists free_ticket_entry_attempts_event_time
 on app_private.free_ticket_entry_attempts(event_id,created_at desc);
create index if not exists free_ticket_entry_attempts_actor_time
 on app_private.free_ticket_entry_attempts(actor_user_id,created_at desc);
alter table app_private.free_ticket_entry_attempts enable row level security;
revoke all on app_private.free_ticket_entry_attempts from public,anon,authenticated;

-- Server-side privileges checked for EVERY call. No email, raw QR,
-- ticket hash or person name is ever surfaced to the scanner.
create or replace function public.admin_free_ticket_scan_status()
returns jsonb language plpgsql stable security definer set search_path=''
as $scan$
begin
 if (select auth.uid()) is null
   or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Administrator MFA AAL2 required' using errcode='42501';end if;
 return pg_catalog.jsonb_build_object(
  'enabled',coalesce((select enabled
   from app_private.free_ticketing_gate where id=1),false),
  'mode','staging_test_only');
end;
$scan$;

-- Listing hides attendee identity; it lists only published FREE PUBLIC events.
create or replace function public.admin_list_free_ticket_scan_events()
returns table(
 event_id uuid,title text,starts_at timestamptz,ends_at timestamptz,
 capacity integer,issued_count bigint,entered_count bigint
)
language plpgsql stable security definer set search_path=''
as $scan$
begin
 if (select auth.uid()) is null
   or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Administrator MFA AAL2 required' using errcode='42501';end if;
 if not coalesce((select enabled from app_private.free_ticketing_gate where id=1),false)
 then return;end if;
 return query
 select e.id,e.title,e.starts_at,e.ends_at,e.capacity,
  count(t.id) filter(where t.status='issued')::bigint,
  count(t.id) filter(where t.status='checked_in')::bigint
 from public.club_events e
 left join app_private.free_event_tickets t on t.event_id=e.id
 where e.published=true and e.access_kind='public'
  and e.booking_kind='free' and e.price_cents=0
  and e.starts_at is not null and e.ends_at is not null
  and e.ends_at>clock_timestamp()-interval '1 day'
 group by e.id,e.title,e.starts_at,e.ends_at,e.capacity
 order by e.starts_at desc,e.id limit 100;
end;
$scan$;

-- The ONLY authority for admitting a QR. Transactional event-row lock
-- serializes concurrent scanners and issued ticket changes. Each attempt
-- is server logged without raw bearer codes; errors produce no admission.
create or replace function public.admin_scan_free_event_ticket(
 p_event_id uuid,p_qr text
) returns jsonb language plpgsql volatile security definer set search_path=''
as $scan$
declare
 v_actor uuid:=(select auth.uid());
 v_gate boolean;
 v_event public.club_events%rowtype;
 v_ticket app_private.free_event_tickets%rowtype;
 v_token text;
 v_outcome text;
 v_now timestamptz:=clock_timestamp();
 v_recent integer;
begin
 if v_actor is null or
  not coalesce((select app_private.is_admin()),false)
 then raise exception 'Administrator MFA AAL2 required' using errcode='42501';end if;
 if not exists(select 1 from auth.users u where u.id=v_actor
  and u.email_confirmed_at is not null) then
  raise exception 'Email verification required' using errcode='42501';end if;
 select enabled into v_gate from app_private.free_ticketing_gate
  where id=1 for share;
 if not coalesce(v_gate,false) then
  raise exception 'Ticketing disabled until staging signoff' using errcode='42501';
 end if;
 if p_event_id is null then
  raise exception 'Event reference required' using errcode='22023';end if;

 -- Wait for other scanners issuing/cancelling the same event before checking.
 select * into v_event from public.club_events
  where id=p_event_id for update;
 if v_event.id is null then
  return pg_catalog.jsonb_build_object('status','rejected');
 end if;

 select count(*) into v_recent from app_private.free_ticket_entry_attempts a
  where a.actor_user_id=v_actor
    and a.created_at>v_now-interval '1 minute';
 if v_recent>=75 then
  return pg_catalog.jsonb_build_object('status','rate_limited');
 end if;

 if v_event.published is distinct from true
   or v_event.booking_kind<>'free' or v_event.access_kind<>'public'
   or v_event.price_cents<>0 or v_event.ends_at is null
   or v_event.starts_at is null
   or v_now<v_event.starts_at-interval '90 minutes'
   or v_now>=v_event.ends_at then
  v_outcome:='event_unavailable';
 elsif p_qr is null or pg_catalog.length(p_qr)<>106
   or p_qr !~ ('^BUJ1:'||p_event_id::text||':[0-9a-f]{64}$') then
  v_outcome:='invalid_code';
 else
  v_token:=pg_catalog.split_part(p_qr,':',3);
  select * into v_ticket from app_private.free_event_tickets t
   where t.event_id=p_event_id
     and t.token_sha256=pg_catalog.encode(
       extensions.digest(pg_catalog.decode(v_token,'hex'),'sha256'),'hex')
    for update;
  if v_ticket.id is null then
   v_outcome:='not_found';
  elsif v_ticket.status='checked_in' then
   v_outcome:='already_used';
  elsif v_ticket.status='cancelled' then
   v_outcome:='cancelled';
  elsif v_ticket.status='issued' then
   update app_private.free_event_tickets
    set status='checked_in',checked_in_at=v_now
    where id=v_ticket.id and status='issued';
   if not found then
    v_outcome:='already_used';
   else
    insert into app_private.free_event_ticket_audit(
      ticket_id,event_id,actor_user_id,action)
     values(v_ticket.id,p_event_id,v_actor,'checked_in');
    v_outcome:='accepted';
   end if;
  else
   v_outcome:='not_found';
  end if;
 end if;
 insert into app_private.free_ticket_entry_attempts(
  event_id,ticket_id,actor_user_id,outcome,created_at)
 values(p_event_id,v_ticket.id,v_actor,v_outcome,v_now);
 return pg_catalog.jsonb_build_object('status',v_outcome);
end;
$scan$;

-- Keep compatibility with earlier clients, without a separate bypass path.
create or replace function public.checkin_free_event_ticket(
 p_event_id uuid,p_qr text
) returns boolean language plpgsql volatile security definer set search_path=''
as $scan$
declare v_result jsonb;
begin
 v_result:=public.admin_scan_free_event_ticket(p_event_id,p_qr);
 return v_result->>'status'='accepted';
end;
$scan$;

-- Back-office aggregate only: no names, ticket ids, scan secrets,
-- attendee ids or operator identities leave the database.
create or replace function public.admin_free_ticket_entry_report(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $scan$
declare
 v_event public.club_events%rowtype;
 v_issued bigint;
 v_checked bigint;
 v_cancelled bigint;
 v_recent jsonb;
begin
 if (select auth.uid()) is null
  or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Administrator MFA AAL2 required' using errcode='42501';end if;
 if not coalesce((select enabled from app_private.free_ticketing_gate where id=1),false)
 then raise exception 'Staging ticket gate disabled' using errcode='42501';end if;
 select * into v_event from public.club_events where id=p_event_id;
 if v_event.id is null or v_event.access_kind<>'public'
  or v_event.booking_kind<>'free' then
  raise exception 'Free event not found' using errcode='22023';end if;
 select count(*) filter(where t.status='issued'),
   count(*) filter(where t.status='checked_in'),
   count(*) filter(where t.status='cancelled')
 into v_issued,v_checked,v_cancelled
 from app_private.free_event_tickets t where t.event_id=p_event_id;
 select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('at',s.created_at,'status',s.outcome)
    order by s.created_at desc), '[]'::jsonb)
 into v_recent from (
   select a.created_at,a.outcome from app_private.free_ticket_entry_attempts a
    where a.event_id=p_event_id
    order by a.created_at desc,a.id desc limit 20
 ) s;
 return pg_catalog.jsonb_build_object(
  'event_id',v_event.id,'title',v_event.title,'capacity',v_event.capacity,
  'issued',v_issued,'checked_in',v_checked,'cancelled',v_cancelled,
  'recent',v_recent);
end;
$scan$;

-- Service-only privacy lifecycle. Never run automatic cleanups on live data.
create or replace function public.service_purge_old_free_ticket_scan_attempts()
returns integer language plpgsql security definer set search_path=''
as $scan$
declare v_count integer;
begin
 delete from app_private.free_ticket_entry_attempts
  where created_at<clock_timestamp()-interval '90 days';
 get diagnostics v_count=row_count;
 return v_count;
end;
$scan$;

revoke all on function public.admin_free_ticket_scan_status()
 from public,anon,authenticated,service_role;
revoke all on function public.admin_list_free_ticket_scan_events()
 from public,anon,authenticated,service_role;
revoke all on function public.admin_scan_free_event_ticket(uuid,text)
 from public,anon,authenticated,service_role;
revoke all on function public.checkin_free_event_ticket(uuid,text)
 from public,anon,authenticated,service_role;
revoke all on function public.admin_free_ticket_entry_report(uuid)
 from public,anon,authenticated,service_role;
revoke all on function public.service_purge_old_free_ticket_scan_attempts()
 from public,anon,authenticated,service_role;
grant execute on function public.admin_free_ticket_scan_status() to authenticated;
grant execute on function public.admin_list_free_ticket_scan_events() to authenticated;
grant execute on function public.admin_scan_free_event_ticket(uuid,text) to authenticated;
grant execute on function public.checkin_free_event_ticket(uuid,text) to authenticated;
grant execute on function public.admin_free_ticket_entry_report(uuid) to authenticated;
grant execute on function public.service_purge_old_free_ticket_scan_attempts() to service_role;
comment on table app_private.free_ticket_entry_attempts is
 'Staging-only 90-day pseudonymous scan decisions, never raw QR or ticket token.';
commit;
