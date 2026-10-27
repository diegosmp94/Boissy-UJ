-- Boissy-UJ stage 88: member free ticketing / QR recovery (isolated staging ONLY).
-- Requires stage 87 event/slot constraints and existing Auth+MFA migrations.
-- NEVER apply to the primary project dahzewvbybujqhogumte.
-- Both the DB feature gate and client UI remain OFF for production by default.
-- DO NOT APPLY TO PRODUCTION. Requires isolated Supabase/PostgreSQL staging
-- and live RLS/permission/concurrent-scanner tests before any activation.
-- No payments. Feature flag is OFF on installation, and has no public toggle.
begin;

create table if not exists app_private.free_ticketing_gate (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into app_private.free_ticketing_gate(id,enabled)
values (1,false) on conflict(id) do update
  set enabled=false,updated_at=clock_timestamp();
alter table app_private.free_ticketing_gate enable row level security;
revoke all on app_private.free_ticketing_gate from public,anon,authenticated;

create table if not exists app_private.free_event_tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.club_events(id) on delete restrict,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  token_sha256 text not null unique
    check(token_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'issued'
    check(status in ('issued','cancelled','checked_in')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  checked_in_at timestamptz,
  unique(event_id,member_user_id),
  constraint free_ticket_lifecycle_valid check (
    (status='issued' and cancelled_at is null and checked_in_at is null)
    or (status='cancelled' and cancelled_at is not null and checked_in_at is null)
    or (status='checked_in' and checked_in_at is not null and cancelled_at is null)
  )
);
create index if not exists free_event_tickets_capacity_idx
  on app_private.free_event_tickets(event_id,status);
alter table app_private.free_event_tickets enable row level security;
revoke all on app_private.free_event_tickets from public,anon,authenticated;

create table if not exists app_private.free_event_ticket_audit (
  id bigint generated always as identity primary key,
  ticket_id uuid not null,
  event_id uuid not null,
  actor_user_id uuid not null,
  action text not null check(action in ('issued','cancelled','checked_in','reissued')),
  created_at timestamptz not null default now()
);
alter table app_private.free_event_ticket_audit enable row level security;
revoke all on app_private.free_event_ticket_audit from public,anon,authenticated;

alter table app_private.free_event_tickets
 add column if not exists window_id uuid
   references app_private.event_reservation_windows(id) on delete restrict;
alter table app_private.free_event_tickets
 add column if not exists token_rotated_at timestamptz;
create index if not exists free_tickets_by_window_status
 on app_private.free_event_tickets(window_id,status);

-- Member-facing RPC: returns a fresh opaque QR on initial issuance only. No ticket or secret is
-- cached in a public table, and raw secrets are never written to logs.
-- A single event-row FOR UPDATE serializes capacity checks and issuance.
create or replace function public.request_free_event_ticket(p_event_id uuid)
returns text
language plpgsql volatile security definer set search_path=''
as $ticket$
declare
  v_actor uuid := (select auth.uid());
  v_gate boolean;
  v_event public.club_events%rowtype;
  v_used integer;
  v_secret text;
  v_ticket_id uuid;
  v_window app_private.event_reservation_windows%rowtype;
  v_window_count integer;
  v_window_used integer;
begin
  if v_actor is null or
     coalesce((select auth.jwt()->>'is_anonymous'),'false')='true'
  then raise exception 'Verified member sign-in required' using errcode='42501'; end if;

  if not exists(select 1 from auth.users u where u.id=v_actor
   and u.email_confirmed_at is not null) then
    raise exception 'Confirmed member email required' using errcode='42501';
  end if;

  select enabled into v_gate from app_private.free_ticketing_gate where id=1 for share;
  if not coalesce(v_gate,false)
  then raise exception 'Free ticketing is not activated' using errcode='42501'; end if;

  if p_event_id is null then
    raise exception 'Invalid event reference' using errcode='22023';
  end if;
  select * into v_event
  from public.club_events where id=p_event_id for update;
  if not found or v_event.published is distinct from true
    or v_event.access_kind <> 'public' or v_event.booking_kind <> 'free'
    or v_event.price_cents <> 0
    or v_event.booking_status <> 'open'
    or v_event.priority_kind <> 'none' -- no privileged early booking until separately audited
    or v_event.capacity is null or v_event.capacity < 1
    or v_event.starts_at is null or v_event.starts_at <= clock_timestamp()
    or v_event.ends_at is null or v_event.ends_at <= v_event.starts_at
  then raise exception 'Free event is unavailable' using errcode='22023'; end if;

  if exists (
    select 1 from app_private.free_event_tickets
    where event_id=p_event_id and member_user_id=v_actor
  ) then
    raise exception 'Only one lifetime ticket per member and event' using errcode='23505';
  end if;

  select count(*) into v_used from app_private.free_event_tickets
  where event_id=p_event_id and status in ('issued','checked_in');
  if v_used >= v_event.capacity then
    raise exception 'No free places remaining' using errcode='23514';
  end if;

  -- Stage 87 slots are a strict schedule: if any exist, require exactly
  -- one current PUBLIC scheduled slot. Closed/draft slots grant nothing.
  select count(*) into v_window_count
    from app_private.event_reservation_windows w
   where w.event_id=p_event_id;
  if v_window_count>0 then
    select w.* into v_window from app_private.event_reservation_windows w
     where w.event_id=p_event_id and w.status='scheduled'
      and w.access_kind='public'
      and w.opens_at<=clock_timestamp() and clock_timestamp()<w.closes_at;
    if v_window.id is null then
      raise exception 'Free booking window not open' using errcode='42501';
    end if;
    select count(*) into v_window_used from app_private.free_event_tickets t
     where t.event_id=p_event_id and t.window_id=v_window.id
       and t.status in ('issued','checked_in');
    if v_window_used>=v_window.capacity then
      raise exception 'Free booking window is full' using errcode='23514';
    end if;
  end if;

  v_secret:=encode(extensions.gen_random_bytes(32),'hex');
  insert into app_private.free_event_tickets(
    event_id,member_user_id,window_id,token_sha256,status
  ) values (
    p_event_id,v_actor,v_window.id,
    encode(extensions.digest(decode(v_secret,'hex'),'sha256'),'hex'),
    'issued'
  ) returning id into v_ticket_id;

  insert into app_private.free_event_ticket_audit(
    ticket_id,event_id,actor_user_id,action
  ) values(v_ticket_id,p_event_id,v_actor,'issued');

  return 'BUJ1:'||p_event_id::text||':'||v_secret;
end;
$ticket$;

-- Member can only cancel OWN, still-unused reservation before kickoff.
-- The event lock prevents racing issuance/cancellation from miscounting seats.
create or replace function public.cancel_my_free_event_ticket(p_event_id uuid)
returns boolean
language plpgsql volatile security definer set search_path=''
as $ticket$
declare
  v_actor uuid := (select auth.uid());
  v_gate boolean;
  v_start timestamptz;
  v_ticket_id uuid;
begin
  if v_actor is null
    or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true'
  then raise exception 'Verified member sign-in required' using errcode='42501'; end if;
  if not exists(select 1 from auth.users u where u.id=v_actor
   and u.email_confirmed_at is not null) then
    raise exception 'Confirmed member email required' using errcode='42501';
  end if;

  select enabled into v_gate from app_private.free_ticketing_gate where id=1 for share;
  if not coalesce(v_gate,false)
  then raise exception 'Free ticketing is not activated' using errcode='42501'; end if;

  select starts_at into v_start from public.club_events
    where id=p_event_id for update;
  if not found or v_start is null or v_start <= clock_timestamp()
  then return false; end if;

  update app_private.free_event_tickets set
    status='cancelled',cancelled_at=clock_timestamp()
  where event_id=p_event_id and member_user_id=v_actor
    and status='issued'
  returning id into v_ticket_id;
  if v_ticket_id is null then return false; end if;

  insert into app_private.free_event_ticket_audit(
    ticket_id,event_id,actor_user_id,action
  ) values(v_ticket_id,p_event_id,v_actor,'cancelled');
  return true;
end;
$ticket$;

-- Authorized AAL2 admin scan ONLY. Atomic update and FOR UPDATE serialize
-- simultaneous gate attendants: the first succeeds, the second gets false.
-- This returns only bool (never user identities or token digests).
create or replace function public.checkin_free_event_ticket(
  p_event_id uuid,p_qr text
)
returns boolean
language plpgsql volatile security definer set search_path=''
as $ticket$
declare
  v_actor uuid := (select auth.uid());
  v_gate boolean;
  v_event public.club_events%rowtype;
  v_ticket_id uuid;
  v_secret text;
begin
  if v_actor is null
    or not coalesce((select app_private.is_admin()),false)
  then raise exception 'Administrator MFA AAL2 required' using errcode='42501'; end if;
  if not exists(select 1 from auth.users u where u.id=v_actor
   and u.email_confirmed_at is not null) then
    raise exception 'Confirmed member email required' using errcode='42501';
  end if;

  select enabled into v_gate from app_private.free_ticketing_gate where id=1 for share;
  if not coalesce(v_gate,false)
  then raise exception 'Free ticketing is not activated' using errcode='42501'; end if;

  if p_event_id is null or p_qr is null or
    p_qr !~ ('^BUJ1:'||p_event_id::text||':[0-9a-f]{64}$')
  then return false; end if;
  v_secret:=split_part(p_qr,':',3);

  select * into v_event from public.club_events
   where id=p_event_id for update;
  if not found or v_event.published is distinct from true
    or v_event.booking_kind <> 'free' or v_event.access_kind <> 'public'
    or v_event.starts_at is null or v_event.ends_at is null
    or clock_timestamp() < v_event.starts_at-interval '90 minutes'
    or clock_timestamp() >= v_event.ends_at
  then return false; end if;

  select id into v_ticket_id from app_private.free_event_tickets
   where event_id=p_event_id and status='issued' and
     token_sha256=encode(
       extensions.digest(decode(v_secret,'hex'),'sha256'),'hex'
     ) for update;
  if not found then return false; end if;

  update app_private.free_event_tickets set
    status='checked_in',checked_in_at=clock_timestamp()
   where id=v_ticket_id and status='issued';
  if not found then return false; end if;
  insert into app_private.free_event_ticket_audit(
    ticket_id,event_id,actor_user_id,action
  ) values(v_ticket_id,p_event_id,v_actor,'checked_in');
  return true;
end;
$ticket$;

-- PostgreSQL's default PUBLIC function execute privilege must be removed.
-- The internal tables and gate remain entirely invisible via Supabase Data API.
revoke all on function public.request_free_event_ticket(uuid)
 from public,anon,authenticated;
revoke all on function public.cancel_my_free_event_ticket(uuid)
 from public,anon,authenticated;
revoke all on function public.checkin_free_event_ticket(uuid,text)
 from public,anon,authenticated;
grant execute on function public.request_free_event_ticket(uuid)
 to authenticated;
grant execute on function public.cancel_my_free_event_ticket(uuid)
 to authenticated;
grant execute on function public.checkin_free_event_ticket(uuid,text)
 to authenticated;

comment on table app_private.free_ticketing_gate is
 'OFF by default. Only a separately approved privileged database operation may enable this, after RLS/MFA and concurrent-scan staging tests.';
comment on function public.checkin_free_event_ticket(uuid,text) is
 'MFA AAL2 admin-only, atomic one-use check-in of an opaque free-event QR. Not activated.';

-- Own-only read. Never returns a secret or hash; gate OFF means [].
create or replace function public.member_my_free_event_tickets()
returns table(
  event_id uuid,title text,starts_at timestamptz,issued_at timestamptz,
  ticket_status text,can_reissue boolean
)
language plpgsql stable security definer set search_path=''
as $ticket$
declare
 v_actor uuid:=(select auth.uid());
begin
 if v_actor is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true'
  or not exists(select 1 from auth.users where id=v_actor and email_confirmed_at is not null)
 then raise exception 'Verified member required' using errcode='42501'; end if;
 if not coalesce((select enabled from app_private.free_ticketing_gate where id=1),false)
 then return; end if;
 return query
 select t.event_id,e.title,e.starts_at,t.created_at,t.status,
   t.status='issued' and e.starts_at>clock_timestamp()
 from app_private.free_event_tickets t
 join public.club_events e on e.id=t.event_id
 where t.member_user_id=v_actor
 order by e.starts_at desc,t.id limit 100;
end;
$ticket$;

-- QR recovery is rotation: old QR becomes invalid on every successful call.
-- No QR plaintext is stored in tables/logs/localStorage. The call is owner
-- scoped, requires a live gate and an unused ticket before the event begins.
create or replace function public.member_reissue_free_event_ticket(p_event_id uuid)
returns text language plpgsql volatile security definer set search_path=''
as $ticket$
declare
 v_actor uuid:=(select auth.uid());
 v_ticket app_private.free_event_tickets%rowtype;
 v_start timestamptz;
 v_secret text;
begin
 if v_actor is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true'
  or not exists(select 1 from auth.users u where u.id=v_actor
    and u.email_confirmed_at is not null)
 then raise exception 'Verified member required' using errcode='42501'; end if;
 if not coalesce((select enabled from app_private.free_ticketing_gate where id=1),false)
 then raise exception 'Ticketing disabled' using errcode='42501';end if;
 select starts_at into v_start from public.club_events
  where id=p_event_id for update;
 if not found or v_start is null or v_start<=clock_timestamp()
 then raise exception 'Event unavailable for QR recovery' using errcode='42501';end if;
 select * into v_ticket from app_private.free_event_tickets
  where event_id=p_event_id and member_user_id=v_actor for update;
 if v_ticket.id is null or v_ticket.status<>'issued' then
  raise exception 'No unused own ticket to recover' using errcode='42501';
 end if;
 v_secret:=encode(extensions.gen_random_bytes(32),'hex');
 update app_private.free_event_tickets
  set token_sha256=encode(extensions.digest(decode(v_secret,'hex'),'sha256'),'hex'),
      token_rotated_at=clock_timestamp()
  where id=v_ticket.id and status='issued';
 insert into app_private.free_event_ticket_audit(ticket_id,event_id,actor_user_id,action)
 values(v_ticket.id,p_event_id,v_actor,'reissued');
 return 'BUJ1:'||p_event_id::text||':'||v_secret;
end;
$ticket$;

-- Administrative opening is not a public ticket sale, and can ONLY run on
-- a staging database explicitly activated via privileged manual operations.
-- It prepares an already approved free/public event for gate-enabled booking.
create or replace function public.admin_open_staging_free_event(p_event_id uuid)
returns boolean language plpgsql volatile security definer set search_path=''
as $ticket$
declare v_event public.club_events%rowtype;
begin
 if (select auth.uid()) is null or
  not coalesce((select app_private.is_admin()),false) then
  raise exception 'AAL2 admin required' using errcode='42501';
 end if;
 if not coalesce((select enabled from app_private.free_ticketing_gate where id=1),false)
 then raise exception 'Ticket issuance is disabled' using errcode='42501';end if;
 select * into v_event from public.club_events where id=p_event_id for update;
 if v_event.id is null or not v_event.published
  or v_event.access_kind<>'public' or v_event.booking_kind<>'free'
  or v_event.price_cents<>0 or coalesce(v_event.premium_price_cents,0)<>0
  or v_event.priority_kind<>'none' or v_event.capacity is null or
  v_event.capacity<1 or v_event.starts_at<=clock_timestamp()
  or v_event.ends_at<=v_event.starts_at then
  raise exception 'Free event not eligible for staging issuance' using errcode='42501';
 end if;
 update public.club_events set booking_status='open',
   updated_at=clock_timestamp() where id=p_event_id;
 return true;
end;
$ticket$;

-- Replace stage 87 trigger's unconditional open prohibition with a condition
-- restricted to a manually enabled flag AND the admin AAL2 JWT. Other slot
-- capacity, dates and Premium isolation checks are preserved in full.
create or replace function app_private.guard_event_reservation_consistency()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare
 v_quota bigint;
 v_issued bigint;
begin
 if new.booking_status not in ('not_open','closed')
  and not (new.booking_status='open'
   and coalesce((select enabled from app_private.free_ticketing_gate where id=1),false)
   and (select auth.uid()) is not null
   and coalesce((select app_private.is_admin()),false)) then
  raise exception 'Reservations cannot open before stage 88'
   using errcode='42501';
 end if;
 if tg_op='UPDATE' then
  select count(*) into v_issued from app_private.free_event_tickets t
    where t.event_id=new.id and t.status in ('issued','checked_in');
  if v_issued>0 and (new.capacity is null or new.capacity<v_issued or
     new.starts_at is distinct from old.starts_at or
     new.published is distinct from true or new.booking_kind<>'free' or
     new.access_kind<>'public') then
    raise exception 'Existing issued tickets prevent unsafe event changes'
     using errcode='42501';
  end if;
  select coalesce(sum(w.capacity),0) into v_quota
    from app_private.event_reservation_windows w
    where w.event_id=new.id and w.status<>'closed';
  if v_quota>0 and (new.capacity is null or v_quota>new.capacity) then
   raise exception 'Event capacity cannot undercut active slot quotas'
    using errcode='22023';
  end if;
  if exists(
   select 1 from app_private.event_reservation_windows w
    where w.event_id=new.id and w.status<>'closed'
    and (new.starts_at is null or w.closes_at>new.starts_at
      or (new.access_kind='premium' and w.access_kind='public')
      or (new.access_kind='public' and w.access_kind='premium'
       and (new.priority_kind<>'premium'
        or w.opens_at<new.priority_starts_at
        or w.closes_at>new.priority_ends_at))))
  then raise exception 'Existing slot rules prevent incompatible event edit'
   using errcode='22023';end if;
 end if;
 return new;
end;
$fn$;

-- A sold-out/issued slot cannot be reconfigured below already issued
-- tickets or made to overlap after issuance. Closing a window is allowed
-- (blocks new issues, does not invalidate existing checked-in tickets).
create or replace function app_private.guard_issued_free_slot()
returns trigger language plpgsql security definer set search_path=''
as $ticket$
begin
 if tg_op='UPDATE' and exists(
   select 1 from app_private.free_event_tickets t
   where t.window_id=old.id and t.status in ('issued','checked_in')
 ) and (
   new.opens_at is distinct from old.opens_at or
   new.closes_at is distinct from old.closes_at or
   new.capacity is distinct from old.capacity or
   new.access_kind is distinct from old.access_kind or
   (new.status is distinct from old.status and new.status<>'closed')
 ) then
  raise exception 'Issued tickets lock reservation window parameters'
   using errcode='42501';
 end if;
 return new;
end;
$ticket$;
drop trigger if exists prevent_unsafe_free_ticket_slot_change
 on app_private.event_reservation_windows;
create trigger prevent_unsafe_free_ticket_slot_change
 before update on app_private.event_reservation_windows
 for each row execute function app_private.guard_issued_free_slot();
revoke all on function app_private.guard_issued_free_slot()
 from public,anon,authenticated;

revoke all on function public.member_my_free_event_tickets()
 from public,anon,authenticated,service_role;
revoke all on function public.member_reissue_free_event_ticket(uuid)
 from public,anon,authenticated,service_role;
revoke all on function public.admin_open_staging_free_event(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.member_my_free_event_tickets() to authenticated;
grant execute on function public.member_reissue_free_event_ticket(uuid) to authenticated;
grant execute on function public.admin_open_staging_free_event(uuid) to authenticated;

commit;
