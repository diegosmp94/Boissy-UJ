-- Boissy-UJ / Étape 87 : préparation des règles de réservation.
-- Aucun paiement, billet, réservation, droit Premium ou jauge consommée.
-- Les statuts 'open' et 'full' restent interdits par ces RPC jusqu'à l'étape 88.
begin;

create table if not exists app_private.event_reservation_windows (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.club_events(id) on delete restrict,
 opens_at timestamptz not null,
 closes_at timestamptz not null,
 capacity integer not null check(capacity between 1 and 100000),
 access_kind text not null check(access_kind in ('public','premium')),
 status text not null default 'draft'
   check(status in ('draft','scheduled','closed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(closes_at>opens_at)
);
create index if not exists event_reservation_windows_event_dates_idx
 on app_private.event_reservation_windows(event_id,opens_at,closes_at);
alter table app_private.event_reservation_windows enable row level security;
revoke all on app_private.event_reservation_windows from public,anon,authenticated;

create table if not exists app_private.admin_event_booking_rules_audit (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null,
 window_id uuid,
 actor_id uuid not null,
 action text not null
  check(action in ('create_event','edit_event','create_window','edit_window')),
 before_snapshot jsonb,
 after_snapshot jsonb not null,
 created_at timestamptz not null default now()
);
alter table app_private.admin_event_booking_rules_audit enable row level security;
revoke all on app_private.admin_event_booking_rules_audit from public,anon,authenticated;

-- This admin list includes Premium/draft events; the public table SELECT RLS
-- continues hiding anything that is not published AND access_kind='public'.
create or replace function public.admin_list_advanced_events()
returns setof public.club_events
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null
  or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501'; end if;
 return query select * from public.club_events e
  order by e.starts_at desc nulls last,e.created_at desc,e.id limit 250;
end;
$fn$;

-- This RPC creates/edits only metadata and never enables reservations:
-- 'open' / 'full' must be decided transactionally at stage 88.
create or replace function public.admin_save_advanced_event(
 p_id uuid,
 p_title text,
 p_description text,
 p_category text,
 p_starts_at timestamptz,
 p_ends_at timestamptz,
 p_location_label text,
 p_capacity integer,
 p_access_kind text,
 p_booking_kind text,
 p_price_cents integer,
 p_premium_price_cents integer,
 p_priority_kind text,
 p_priority_starts_at timestamptz,
 p_priority_ends_at timestamptz,
 p_booking_status text,
 p_published boolean,
 p_expected_updated_at timestamptz default null
) returns uuid language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid:=(select auth.uid());
 v_old public.club_events%rowtype;
 v_new public.club_events%rowtype;
 v_slots bigint;
begin
 if v_actor is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501'; end if;
 if p_title is null or char_length(btrim(p_title)) not between 4 and 150
  or p_description is null or char_length(p_description)>4000
  or p_category is null or p_category not in ('club','sport','community','other')
  or p_location_label is null or char_length(p_location_label)>160
  or p_access_kind is null or p_access_kind not in ('public','premium')
  or p_booking_kind is null or p_booking_kind not in ('free','paid')
  or p_price_cents is null or p_price_cents not between 0 and 1000000
  or (p_booking_kind='free' and (p_price_cents<>0 or
   coalesce(p_premium_price_cents,0)<>0))
  or (p_booking_kind='paid' and p_price_cents=0)
  or (p_premium_price_cents is not null and
   (p_premium_price_cents<0 or p_premium_price_cents>p_price_cents))
  or p_priority_kind is null or p_priority_kind not in ('none','premium')
  or p_booking_status is null or p_booking_status not in ('not_open','closed')
  or p_published is null
  or (p_capacity is not null and p_capacity not between 1 and 100000)
  or (p_starts_at is null)<>(p_ends_at is null)
  or (p_starts_at is not null and p_ends_at<=p_starts_at)
  or (p_published and p_starts_at is null)
  or (p_priority_kind='none' and
   (p_priority_starts_at is not null or p_priority_ends_at is not null))
  or (p_priority_kind='premium' and
   (p_access_kind<>'public' or p_priority_starts_at is null
    or p_priority_ends_at is null or p_starts_at is null
    or p_priority_starts_at>=p_priority_ends_at
    or p_priority_ends_at>p_starts_at))
 then raise exception 'Invalid advanced event rules' using errcode='22023'; end if;

 if p_id is null then
  if p_expected_updated_at is not null then
   raise exception 'Unexpected event version' using errcode='22023'; end if;
  insert into public.club_events (
   slug,title,description,category,starts_at,ends_at,location_label,
   access_kind,booking_kind,price_cents,premium_price_cents,capacity,
   booking_status,priority_kind,priority_starts_at,priority_ends_at,published)
  values (
   'evenement-'||replace(gen_random_uuid()::text,'-',''),
   btrim(p_title),p_description,p_category,p_starts_at,p_ends_at,
   nullif(btrim(p_location_label),''),p_access_kind,p_booking_kind,
   p_price_cents,p_premium_price_cents,p_capacity,
   p_booking_status,p_priority_kind,p_priority_starts_at,p_priority_ends_at,
   p_published)
  returning * into v_new;
 else
  select * into v_old from public.club_events where id=p_id for update;
  if v_old.id is null then
   raise exception 'Event not found' using errcode='22023'; end if;
  if p_expected_updated_at is null or
   v_old.updated_at is distinct from p_expected_updated_at then
   raise exception 'Event changed: refresh required' using errcode='40001'; end if;
  select coalesce(sum(w.capacity),0) into v_slots
   from app_private.event_reservation_windows w
   where w.event_id=p_id and w.status<>'closed';
  if v_slots>0 and (p_capacity is null or v_slots>p_capacity) then
   raise exception 'Event capacity below reserved slot quotas' using errcode='22023';
  end if;
  if exists(select 1 from app_private.event_reservation_windows w
    where w.event_id=p_id and w.status<>'closed'
     and (p_starts_at is null or w.closes_at>p_starts_at
      or (w.access_kind='premium' and p_access_kind='public'
       and (p_priority_kind<>'premium' or
       w.opens_at<p_priority_starts_at or
       w.closes_at>p_priority_ends_at))
      or (p_access_kind='premium' and w.access_kind='public')))
  then raise exception 'Existing reservation windows conflict with event rules'
    using errcode='22023';
  end if;
  update public.club_events set
   title=btrim(p_title),description=p_description,category=p_category,
   starts_at=p_starts_at,ends_at=p_ends_at,
   location_label=nullif(btrim(p_location_label),''),
   access_kind=p_access_kind,booking_kind=p_booking_kind,
   price_cents=p_price_cents,premium_price_cents=p_premium_price_cents,
   capacity=p_capacity,booking_status=p_booking_status,
   priority_kind=p_priority_kind,priority_starts_at=p_priority_starts_at,
   priority_ends_at=p_priority_ends_at,published=p_published,
   updated_at=greatest(clock_timestamp(),v_old.updated_at+interval '1 microsecond')
  where id=p_id returning * into v_new;
 end if;

 insert into app_private.admin_event_booking_rules_audit
  (event_id,window_id,actor_id,action,before_snapshot,after_snapshot)
 values(v_new.id,null,v_actor,
  case when p_id is null then 'create_event' else 'edit_event' end,
  case when p_id is null then null else to_jsonb(v_old) end,to_jsonb(v_new));
 return v_new.id;
end;
$fn$;

create or replace function public.admin_list_event_reservation_windows(
 p_event_id uuid
) returns setof app_private.event_reservation_windows
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null
  or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501'; end if;
 if p_event_id is null then
  raise exception 'Event ID required' using errcode='22023'; end if;
 return query select w.* from app_private.event_reservation_windows w
  where w.event_id=p_event_id order by w.opens_at,w.id limit 100;
end;
$fn$;

-- Concurrent updates serialize on the PARENT event before checking every
-- window. Overlap and total quota are checked inside the same transaction.
-- Closed slots stay immutable (history), no deletion or member reservation.
create or replace function public.admin_save_event_reservation_window(
 p_id uuid,p_event_id uuid,p_opens_at timestamptz,p_closes_at timestamptz,
 p_capacity integer,p_access_kind text,p_status text,
 p_expected_updated_at timestamptz default null
) returns uuid language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid:=(select auth.uid());
 v_event public.club_events%rowtype;
 v_old app_private.event_reservation_windows%rowtype;
 v_new app_private.event_reservation_windows%rowtype;
 v_other_capacity bigint;
begin
 if v_actor is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Admin MFA AAL2 required' using errcode='42501'; end if;
 if p_event_id is null or p_opens_at is null or p_closes_at is null
  or p_closes_at<=p_opens_at
  or p_capacity is null or p_capacity not between 1 and 100000
  or p_access_kind is null or p_access_kind not in ('public','premium')
  or p_status is null or p_status not in ('draft','scheduled','closed')
 then raise exception 'Invalid reservation window' using errcode='22023'; end if;
 select * into v_event from public.club_events where id=p_event_id for update;
 if v_event.id is null then
  raise exception 'Event unavailable' using errcode='22023'; end if;
 if v_event.capacity is null or v_event.starts_at is null or
   p_closes_at>v_event.starts_at or
   (v_event.access_kind='premium' and p_access_kind='public') or
   (p_access_kind='premium' and v_event.access_kind='public'
    and (v_event.priority_kind<>'premium'
     or p_opens_at<v_event.priority_starts_at
     or p_closes_at>v_event.priority_ends_at))
 then raise exception 'Window outside event or Premium rules'
   using errcode='22023'; end if;
 if p_id is not null then
  select * into v_old from app_private.event_reservation_windows
   where id=p_id and event_id=p_event_id for update;
  if v_old.id is null or
    p_expected_updated_at is null or
    v_old.updated_at is distinct from p_expected_updated_at then
   raise exception 'Window changed: refresh required' using errcode='40001';
  end if;
  if v_old.status='closed' and p_status<>'closed' then
   raise exception 'Closed window cannot be reopened' using errcode='42501';
  end if;
 elsif p_expected_updated_at is not null then
  raise exception 'Unexpected slot version' using errcode='22023';
 end if;
 if p_status<>'closed' then
  if exists(select 1 from app_private.event_reservation_windows w
   where w.event_id=p_event_id and w.id is distinct from p_id
    and w.status<>'closed' and
    w.opens_at<p_closes_at and p_opens_at<w.closes_at) then
   raise exception 'Reservation windows cannot overlap' using errcode='22023';
  end if;
  select coalesce(sum(w.capacity),0) into v_other_capacity
   from app_private.event_reservation_windows w
   where w.event_id=p_event_id and w.id is distinct from p_id
   and w.status<>'closed';
  if v_other_capacity+p_capacity>v_event.capacity then
   raise exception 'Slot quotas exceed event capacity' using errcode='22023';
  end if;
 end if;
 if p_id is null then
  insert into app_private.event_reservation_windows
   (event_id,opens_at,closes_at,capacity,access_kind,status)
  values(p_event_id,p_opens_at,p_closes_at,p_capacity,p_access_kind,p_status)
  returning * into v_new;
 else
  update app_private.event_reservation_windows set
   opens_at=p_opens_at,closes_at=p_closes_at,capacity=p_capacity,
   access_kind=p_access_kind,status=p_status,
   updated_at=greatest(clock_timestamp(),v_old.updated_at+interval '1 microsecond')
  where id=p_id returning * into v_new;
 end if;
 insert into app_private.admin_event_booking_rules_audit
  (event_id,window_id,actor_id,action,before_snapshot,after_snapshot)
 values(p_event_id,v_new.id,v_actor,
  case when p_id is null then 'create_window' else 'edit_window' end,
  case when p_id is null then null else to_jsonb(v_old) end,to_jsonb(v_new));
 return v_new.id;
end;
$fn$;

-- Global safety net: even legacy free-event editors cannot lower total quota,
-- move the event before reservations close or bypass Premium segregation.
-- The BEFORE UPDATE trigger executes while its row lock serializes slot saves.
create or replace function app_private.guard_event_reservation_consistency()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare
 v_quota bigint;
begin
 if new.booking_status not in ('not_open','closed') then
  raise exception 'Reservations cannot open before stage 88'
   using errcode='42501';
 end if;
 if tg_op='UPDATE' then
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
drop trigger if exists club_event_reservation_consistency_guard
 on public.club_events;
create trigger club_event_reservation_consistency_guard
 before insert or update on public.club_events
 for each row execute function app_private.guard_event_reservation_consistency();
revoke all on function app_private.guard_event_reservation_consistency()
 from public,anon,authenticated;

-- Intentionally NO member reservation or paid Checkout RPC in this migration.
revoke all on function public.admin_list_advanced_events()
 from public,anon,authenticated,service_role;
revoke all on function public.admin_save_advanced_event(
 uuid,text,text,text,timestamptz,timestamptz,text,integer,text,text,
 integer,integer,text,timestamptz,timestamptz,text,boolean,timestamptz)
 from public,anon,authenticated,service_role;
revoke all on function public.admin_list_event_reservation_windows(uuid)
 from public,anon,authenticated,service_role;
revoke all on function public.admin_save_event_reservation_window(
 uuid,uuid,timestamptz,timestamptz,integer,text,text,timestamptz)
 from public,anon,authenticated,service_role;
grant execute on function public.admin_list_advanced_events() to authenticated;
grant execute on function public.admin_save_advanced_event(
 uuid,text,text,text,timestamptz,timestamptz,text,integer,text,text,
 integer,integer,text,timestamptz,timestamptz,text,boolean,timestamptz)
 to authenticated;
grant execute on function public.admin_list_event_reservation_windows(uuid)
 to authenticated;
grant execute on function public.admin_save_event_reservation_window(
 uuid,uuid,timestamptz,timestamptz,integer,text,text,timestamptz)
 to authenticated;
comment on table app_private.event_reservation_windows is
 'Reservation preparation only: no booking/QR ticket issued until stage 88, private admin MFA reads.';
commit;
