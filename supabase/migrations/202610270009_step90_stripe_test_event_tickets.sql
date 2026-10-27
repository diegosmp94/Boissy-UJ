-- Stage 90: STRIPE TEST paid event tickets + verified Premium discounts.
-- ISOLATED STAGING ONLY: requires 82-84, 87, 88, 89 migrations.
-- NEVER deploy on Supabase primary dahzewvbybujqhogumte.
-- This migration creates ZERO sales, transactions, events or tickets.
begin;

alter table app_private.free_event_tickets
 add column if not exists ticket_origin text not null default 'free'
  check(ticket_origin in ('free','test_paid','premium_comp'));
alter table app_private.free_event_tickets
 add column if not exists payment_checkout_id text unique;
alter table app_private.free_event_tickets
 add constraint step90_ticket_source_consistency check(
  (ticket_origin='test_paid' and payment_checkout_id is not null)
  or (ticket_origin<>'test_paid' and payment_checkout_id is null));

create table if not exists app_private.ticket_test_orders (
 checkout_id text primary key check(checkout_id ~ '^cs_test_[a-zA-Z0-9_]{6,180}$'),
 event_id uuid not null references public.club_events(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 window_id uuid references app_private.event_reservation_windows(id) on delete restrict,
 amount_cents integer not null check(amount_cents between 50 and 1000000),
 currency text not null default 'eur' check(currency='eur'),
 tier text not null check(tier in ('public','premium')),
 status text not null default 'pending'
  check(status in ('pending','issued','paid_unfulfilled','reversed','expired')),
 hold_until timestamptz not null,
 created_at timestamptz not null default now(),
 settled_at timestamptz,
 payment_intent_id text unique check(payment_intent_id ~ '^pi_[a-zA-Z0-9_]{6,180}$'),
 charge_id text unique check(charge_id ~ '^ch_[a-zA-Z0-9_]{6,180}$'),
 customer_id text check(customer_id ~ '^cus_[a-zA-Z0-9_]{6,180}$'),
 event_idempotency text unique check(event_idempotency ~ '^evt_[a-zA-Z0-9_]{6,180}$'),
 ticket_id uuid unique references app_private.free_event_tickets(id),
 check(
  (status='pending' and settled_at is null and ticket_id is null)
  or (status='expired' and ticket_id is null)
  or (status in ('issued','paid_unfulfilled','reversed') and settled_at is not null)
 )
);
create index if not exists ticket_test_active_holds
 on app_private.ticket_test_orders(event_id,hold_until)
 where status='pending';
create index if not exists ticket_test_user_orders
 on app_private.ticket_test_orders(user_id,event_id);
alter table app_private.ticket_test_orders enable row level security;
revoke all on app_private.ticket_test_orders from public,anon,authenticated;

create table if not exists app_private.ticket_test_reversal_inbox (
 event_id text primary key check(event_id ~ '^evt_[a-zA-Z0-9_]{6,180}$'),
 charge_id text not null check(charge_id ~ '^ch_[a-zA-Z0-9_]{6,180}$'),
 event_type text not null
   check(event_type in ('charge.refunded','refund.created',
    'refund.updated','charge.dispute.created')),
 received_at timestamptz not null default now()
);
create index if not exists ticket_test_reversal_by_charge
 on app_private.ticket_test_reversal_inbox(charge_id);
alter table app_private.ticket_test_reversal_inbox enable row level security;
revoke all on app_private.ticket_test_reversal_inbox from public,anon,authenticated;

-- Server-only authorization: no user-controlled premium claim or tier.
create or replace function app_private.ticket_test_price(
 p_user_id uuid,p_event_id uuid
) returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare
 e public.club_events%rowtype;
 premium boolean;
 price integer;
 window_record app_private.event_reservation_windows%rowtype;
 windows integer;
begin
 if p_user_id is null or not exists(select 1 from auth.users u
    where u.id=p_user_id and u.email_confirmed_at is not null)
 then raise exception 'Verified member required' using errcode='42501';end if;
 if not coalesce((select enabled from app_private.free_ticketing_gate where id=1),false)
 then raise exception 'Staging ticketing disabled' using errcode='42501';end if;
 select * into e from public.club_events where id=p_event_id;
 if e.id is null or e.published is distinct from true or
  e.booking_kind<>'paid' or e.booking_status<>'open'
  or e.capacity is null or e.capacity<1 or e.price_cents is null
  or e.price_cents not between 50 and 1000000
  or e.starts_at<=clock_timestamp() or e.ends_at<=e.starts_at
 then raise exception 'Paid event unavailable' using errcode='42501';end if;
 select exists(
  select 1 from app_private.premium_access_grants g
   join app_private.premium_test_charge_proofs p
    on p.source_reference=g.source_reference
   where g.user_id=p_user_id and g.revoked_at is null
    and g.valid_from<=now() and now()<g.valid_until
    and g.verified_at<=now()
 ) into premium;
 if e.access_kind='premium' and not premium then
  raise exception 'Verified Premium access required' using errcode='42501';end if;
 if e.priority_kind='premium'
  and clock_timestamp()>=e.priority_starts_at
  and clock_timestamp()<e.priority_ends_at
  and not premium then
  raise exception 'Premium priority is active' using errcode='42501';end if;
 select count(*) into windows
  from app_private.event_reservation_windows w where w.event_id=e.id;
 if windows>0 then
  select * into window_record
   from app_private.event_reservation_windows w
   where w.event_id=e.id and w.status='scheduled'
    and w.opens_at<=clock_timestamp() and clock_timestamp()<w.closes_at
    and (w.access_kind='public' or premium)
   limit 1;
  if window_record.id is null then
   raise exception 'No eligible open booking window' using errcode='42501';end if;
 end if;
 price:=case when premium and e.premium_price_cents is not null
  then e.premium_price_cents else e.price_cents end;
 if price not between 0 and 1000000 then
  raise exception 'Invalid Premium price' using errcode='42501';end if;
 return jsonb_build_object('amount_cents',price,
  'tier',case when premium then 'premium' else 'public' end,
  'window_id',window_record.id);
end;
$fn$;
revoke all on function app_private.ticket_test_price(uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function app_private.ticket_test_price(uuid,uuid)
 to service_role;

-- The member may request a genuinely free Premium entitlement, without Stripe.
-- This never awards a discount without server-verified unrevoked Premium grants.
create or replace function public.member_request_premium_test_comp_ticket(
 p_event_id uuid
) returns text language plpgsql security definer set search_path=''
as $fn$
declare
 actor uuid:=(select auth.uid());
 e public.club_events%rowtype;
 price jsonb;
 slot uuid;
 count_used bigint;
 active_holds bigint;
 slot_issued bigint;
 secret text;
 ticket uuid;
begin
 if actor is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true'
 then raise exception 'Sign-in required' using errcode='42501';end if;
 select * into e from public.club_events where id=p_event_id for update;
 if e.id is null then raise exception 'Event unavailable' using errcode='42501';end if;
 price:=app_private.ticket_test_price(actor,p_event_id);
 if (price->>'tier')<>'premium' or (price->>'amount_cents')::int<>0 then
  raise exception 'No verified complimentary Premium access'
   using errcode='42501';end if;
 if exists(select 1 from app_private.free_event_tickets t
  where t.event_id=p_event_id and t.member_user_id=actor) then
  raise exception 'One lifetime ticket per member and event'
   using errcode='23505';end if;
 select count(*) into count_used from app_private.free_event_tickets t
  where t.event_id=p_event_id and t.status in ('issued','checked_in');
 select count(*) into active_holds from app_private.ticket_test_orders o
  where o.event_id=p_event_id and o.status='pending'
   and o.hold_until>clock_timestamp();
 if count_used+active_holds>=e.capacity then
  raise exception 'Sold out' using errcode='23514';end if;
 slot:=nullif(price->>'window_id','')::uuid;
 if slot is not null then
  select count(*) into slot_issued from app_private.free_event_tickets t
   where t.window_id=slot and t.status in ('issued','checked_in');
  if slot_issued+
   (select count(*) from app_private.ticket_test_orders o
     where o.window_id=slot and o.status='pending'
      and o.hold_until>clock_timestamp()) >=
   (select w.capacity from app_private.event_reservation_windows w where w.id=slot)
  then raise exception 'Window sold out' using errcode='23514';end if;
 end if;
 secret:=pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
 insert into app_private.free_event_tickets(
  event_id,member_user_id,window_id,token_sha256,ticket_origin)
 values(p_event_id,actor,slot,
  pg_catalog.encode(extensions.digest(pg_catalog.decode(secret,'hex'),'sha256'),'hex'),
  'premium_comp') returning id into ticket;
 insert into app_private.free_event_ticket_audit(
  ticket_id,event_id,actor_user_id,action)
 values(ticket,p_event_id,actor,'issued');
 return 'BUJ1:'||p_event_id::text||':'||secret;
end;
$fn$;

-- Privileged Checkout registration. Its quoted ticket amount is verified AGAIN
-- under the same event row lock that protects issued seats and pending holds.
create or replace function public.billing_register_test_ticket_order(
 p_user_id uuid,p_event_id uuid,p_checkout_id text,p_amount_cents integer,
 p_tier text,p_window_id uuid
) returns boolean language plpgsql security definer set search_path=''
as $fn$
declare
 e public.club_events%rowtype;
 price jsonb;
 occupied bigint;
 window_occupied bigint;
begin
 if p_checkout_id is null or
   p_checkout_id !~ '^cs_test_[a-zA-Z0-9_]{6,180}$'
  or p_amount_cents is null or p_amount_cents not between 50 and 1000000
 then raise exception 'Invalid TEST Checkout' using errcode='22023';end if;
 select * into e from public.club_events where id=p_event_id for update;
 if e.id is null then raise exception 'Event unavailable' using errcode='42501';end if;
 price:=app_private.ticket_test_price(p_user_id,p_event_id);
 if (price->>'amount_cents')::int is distinct from p_amount_cents
  or price->>'tier' is distinct from p_tier
  or nullif(price->>'window_id','')::uuid is distinct from p_window_id
 then raise exception 'TEST price changed, Checkout rejected'
  using errcode='42501';end if;
 if exists(select 1 from app_private.free_event_tickets t
   where t.event_id=p_event_id and t.member_user_id=p_user_id)
  or exists(select 1 from app_private.ticket_test_orders o
   where o.event_id=p_event_id and o.user_id=p_user_id
    and o.status in ('issued','paid_unfulfilled','reversed'))
  or exists(select 1 from app_private.ticket_test_orders o
   where o.event_id=p_event_id and o.user_id=p_user_id
    and o.status='pending' and o.hold_until>clock_timestamp())
 then raise exception 'Existing seat or pending Checkout' using errcode='23505';end if;
 select count(*) into occupied from app_private.free_event_tickets t
  where t.event_id=p_event_id and t.status in ('issued','checked_in');
 occupied:=occupied+(select count(*) from app_private.ticket_test_orders o
  where o.event_id=p_event_id and o.status='pending'
   and o.hold_until>clock_timestamp());
 if occupied>=e.capacity then
  raise exception 'Event sold out' using errcode='23514';end if;
 if p_window_id is not null then
  select count(*) into window_occupied from app_private.free_event_tickets t
   where t.window_id=p_window_id and t.status in ('issued','checked_in');
  window_occupied:=window_occupied+
   (select count(*) from app_private.ticket_test_orders o
    where o.window_id=p_window_id and o.status='pending'
     and o.hold_until>clock_timestamp());
  if window_occupied >= (select w.capacity from app_private.event_reservation_windows w
    where w.id=p_window_id) then
   raise exception 'Window sold out' using errcode='23514';end if;
 end if;
 insert into app_private.ticket_test_orders(
  checkout_id,event_id,user_id,window_id,amount_cents,tier,hold_until)
 values(p_checkout_id,p_event_id,p_user_id,p_window_id,p_amount_cents,
  p_tier,clock_timestamp()+interval '15 minutes');
 return true;
end;
$fn$;

-- On duplicate or unordered paid event, never issue a second ticket.
-- The receipt is bound ONLY after verified Stripe signed event, price-line,
-- PaymentIntent and Charge checks in the Edge Function.
create or replace function public.billing_apply_verified_test_ticket_payment(
 p_event_id uuid,p_checkout_id text,p_event_id_stripe text,
 p_customer_id text,p_payment_intent_id text,p_charge_id text,
 p_amount_cents integer,p_reversed boolean
) returns text language plpgsql security definer set search_path=''
as $fn$
declare
 e public.club_events%rowtype;
 o app_private.ticket_test_orders%rowtype;
 used bigint;
 slot_used bigint;
 secret text;
 ticket uuid;
 result text;
 is_reversed boolean;
begin
 if p_checkout_id is null or p_checkout_id !~ '^cs_test_[a-zA-Z0-9_]{6,180}$'
  or p_event_id_stripe is null or p_event_id_stripe !~ '^evt_[a-zA-Z0-9_]{6,180}$'
  or p_customer_id is null or p_customer_id !~ '^cus_[a-zA-Z0-9_]{6,180}$'
  or p_payment_intent_id is null or p_payment_intent_id !~ '^pi_[a-zA-Z0-9_]{6,180}$'
  or p_charge_id is null or p_charge_id !~ '^ch_[a-zA-Z0-9_]{6,180}$'
  or p_amount_cents not between 50 and 1000000 or p_reversed is null
 then raise exception 'Invalid signed TEST payment identifiers' using errcode='22023';end if;
 select * into e from public.club_events where id=p_event_id for update;
 if e.id is null then raise exception 'Event unavailable' using errcode='42501';end if;
 select * into o from app_private.ticket_test_orders
   where checkout_id=p_checkout_id and event_id=p_event_id for update;
 if o.checkout_id is null or o.amount_cents<>p_amount_cents or
  (o.payment_intent_id is not null and o.payment_intent_id<>p_payment_intent_id)
  or (o.charge_id is not null and o.charge_id<>p_charge_id)
  or (o.customer_id is not null and o.customer_id<>p_customer_id) then
  raise exception 'Payment not linked to this TEST order' using errcode='42501';
 end if;
 if o.status<>'pending' then
  if o.payment_intent_id=p_payment_intent_id and o.charge_id=p_charge_id
   and o.customer_id=p_customer_id and o.amount_cents=p_amount_cents then
   return o.status;
  end if;
  raise exception 'Conflicting settled TEST payment' using errcode='23505';
 end if;
 is_reversed:=p_reversed or exists(
  select 1 from app_private.ticket_test_reversal_inbox r
   where r.charge_id=p_charge_id);
 if is_reversed then
  result:='reversed';
 elsif e.booking_kind<>'paid' or e.published is distinct from true
   or e.starts_at<=clock_timestamp() or
   o.hold_until<=clock_timestamp()
   or exists(select 1 from app_private.free_event_tickets t
       where t.event_id=p_event_id and t.member_user_id=o.user_id)
 then
  result:='paid_unfulfilled';
 else
  select count(*) into used from app_private.free_event_tickets t
   where t.event_id=p_event_id and t.status in ('issued','checked_in');
  if used>=e.capacity then result:='paid_unfulfilled';end if;
  if result is null and o.window_id is not null then
   select count(*) into slot_used from app_private.free_event_tickets t
    where t.window_id=o.window_id and t.status in ('issued','checked_in');
   if slot_used >= (select w.capacity from app_private.event_reservation_windows w
     where w.id=o.window_id) then result:='paid_unfulfilled';end if;
  end if;
  if result is null then result:='issued';end if;
 end if;
 if result='issued' then
  secret:=pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
  insert into app_private.free_event_tickets(
   event_id,member_user_id,window_id,token_sha256,
   ticket_origin,payment_checkout_id)
  values(p_event_id,o.user_id,o.window_id,
    pg_catalog.encode(extensions.digest(pg_catalog.decode(secret,'hex'),'sha256'),'hex'),
    'test_paid',p_checkout_id) returning id into ticket;
  insert into app_private.free_event_ticket_audit(
   ticket_id,event_id,actor_user_id,action)
  values(ticket,p_event_id,o.user_id,'issued');
  -- The secret never leaves the database here. Member QR recovery rotates it.
 end if;
 update app_private.ticket_test_orders set
  status=result,settled_at=clock_timestamp(),customer_id=p_customer_id,
  payment_intent_id=p_payment_intent_id,charge_id=p_charge_id,
  event_idempotency=p_event_id_stripe,ticket_id=ticket
 where checkout_id=p_checkout_id;
 return result;
end;
$fn$;

-- A signed reversal can precede its paid event. Persist first, reconcile
-- when the corresponding verified charge binding arrives later.
create or replace function public.billing_record_test_ticket_reversal(
 p_event_id_stripe text,p_event_type text,p_charge_id text
) returns text language plpgsql security definer set search_path=''
as $fn$
declare
 o app_private.ticket_test_orders%rowtype;
begin
 if p_event_id_stripe is null or
   p_event_id_stripe !~ '^evt_[a-zA-Z0-9_]{6,180}$'
  or p_event_type not in ('charge.refunded','refund.created',
     'refund.updated','charge.dispute.created')
  or p_charge_id is null or p_charge_id !~ '^ch_[a-zA-Z0-9_]{6,180}$'
 then raise exception 'Invalid Stripe TEST reversal' using errcode='22023';end if;
 insert into app_private.ticket_test_reversal_inbox(
  event_id,event_type,charge_id)
 values(p_event_id_stripe,p_event_type,p_charge_id)
 on conflict(event_id) do nothing;
 if not found and not exists(select 1 from app_private.ticket_test_reversal_inbox
  where event_id=p_event_id_stripe and charge_id=p_charge_id
    and event_type=p_event_type) then
  raise exception 'Conflicting reversal event' using errcode='23505';end if;
 select * into o from app_private.ticket_test_orders
   where charge_id=p_charge_id for update;
 if o.checkout_id is null then return 'pending_match';end if;
 -- Never revoke an unrelated ticket. A checked-in entry remains historical.
 if o.status='issued' then
  update app_private.free_event_tickets set
   status='cancelled',cancelled_at=clock_timestamp()
   where id=o.ticket_id and status='issued';
  update app_private.ticket_test_orders set status='reversed'
   where checkout_id=o.checkout_id;
 elsif o.status='paid_unfulfilled' then
  update app_private.ticket_test_orders set status='reversed'
   where checkout_id=o.checkout_id;
 end if;
 return 'reconciled';
end;
$fn$;

-- Refund/chargeback never reinstates a revoked ticket.
create or replace function public.member_my_test_paid_tickets()
returns table(
 event_id uuid,title text,starts_at timestamptz,status text,
 amount_cents integer,can_reissue boolean
) language plpgsql stable security definer set search_path=''
as $fn$
declare actor uuid:=(select auth.uid());
begin
 if actor is null or coalesce((select auth.jwt()->>'is_anonymous'),'false')='true'
  or not exists(select 1 from auth.users where id=actor
   and email_confirmed_at is not null) then
  raise exception 'Verified account required' using errcode='42501';end if;
 if not coalesce((select enabled from app_private.free_ticketing_gate where id=1),false)
 then return;end if;
 return query
 select o.event_id,e.title,e.starts_at,
  o.status,o.amount_cents,
  o.status='issued' and t.status='issued'
   and e.starts_at>clock_timestamp()
 from app_private.ticket_test_orders o
 join public.club_events e on e.id=o.event_id
 left join app_private.free_event_tickets t on t.id=o.ticket_id
 where o.user_id=actor and o.status<>'pending'
 order by e.starts_at desc limit 100;
end;
$fn$;

revoke all on function public.member_request_premium_test_comp_ticket(uuid)
 from public,anon,authenticated,service_role;
revoke all on function public.billing_register_test_ticket_order(
 uuid,uuid,text,integer,text,uuid)
 from public,anon,authenticated,service_role;
revoke all on function public.billing_apply_verified_test_ticket_payment(
 uuid,text,text,text,text,text,integer,boolean)
 from public,anon,authenticated,service_role;
revoke all on function public.billing_record_test_ticket_reversal(text,text,text)
 from public,anon,authenticated,service_role;
revoke all on function public.member_my_test_paid_tickets()
 from public,anon,authenticated,service_role;
grant execute on function public.member_request_premium_test_comp_ticket(uuid)
 to authenticated;
grant execute on function public.billing_register_test_ticket_order(
 uuid,uuid,text,integer,text,uuid)
 to service_role;
grant execute on function public.billing_apply_verified_test_ticket_payment(
 uuid,text,text,text,text,text,integer,boolean)
 to service_role;
grant execute on function public.billing_record_test_ticket_reversal(text,text,text)
 to service_role;
grant execute on function public.member_my_test_paid_tickets()
 to authenticated;
commit;
