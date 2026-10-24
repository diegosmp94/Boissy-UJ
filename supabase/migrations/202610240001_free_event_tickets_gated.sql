-- Boissy-UJ: free-event tickets, server-only transactional prototype.
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
values (1,false) on conflict(id) do nothing;
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
  action text not null check(action in ('issued','cancelled','checked_in')),
  created_at timestamptz not null default now()
);
alter table app_private.free_event_ticket_audit enable row level security;
revoke all on app_private.free_event_ticket_audit from public,anon,authenticated;

-- Member-facing RPC: returns an opaque QR only once. No ticket or secret is
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
begin
  if v_actor is null or
     coalesce((select auth.jwt()->>'is_anonymous'),'false')='true'
  then raise exception 'Verified member sign-in required' using errcode='42501'; end if;

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

  v_secret:=encode(extensions.gen_random_bytes(32),'hex');
  insert into app_private.free_event_tickets(
    event_id,member_user_id,token_sha256,status
  ) values (
    p_event_id,v_actor,
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
commit;
