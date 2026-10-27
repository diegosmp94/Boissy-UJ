-- Étape 84 Boissy-UJ : Stripe TEST refunds, disputes, durable reorder recovery.
-- STAGING ISOLÉ UNIQUEMENT. Depends on stages 82 and 83.
-- Neither this migration nor the Stripe Edge functions are authorized on the
-- single connected Boissy-UJ primary project. No rows or payments are created.
begin;

-- A paid grant becomes visible ONLY after an independent Stripe API lookup
-- binds its exact successful charge and payment intent to the private source.
create table if not exists app_private.premium_test_charge_proofs (
 source_reference text primary key
  references app_private.premium_access_grants(source_reference) on delete cascade,
 charge_id text not null unique check(charge_id ~ '^ch_[a-zA-Z0-9_]{6,180}$'),
 payment_intent_id text not null unique
  check(payment_intent_id ~ '^pi_[a-zA-Z0-9_]{6,180}$'),
 customer_id text not null check(customer_id ~ '^cus_[a-zA-Z0-9_]{6,100}$'),
 bound_at timestamptz not null default now()
);
create index if not exists premium_charge_proofs_customer_charge
 on app_private.premium_test_charge_proofs(customer_id,charge_id);

-- Never silently drop an unfamiliar or early reversal. Store its minimal,
-- signed-event identifiers (not Stripe payload, payer details or credentials).
-- Stored pending events are reconciled on payment binding, even if delivered
-- *before* invoice.paid or the Checkout session. No endless webhook 503.
create table if not exists app_private.premium_test_reversal_inbox (
 event_id text primary key check(event_id ~ '^evt_[a-zA-Z0-9_]{6,160}$'),
 event_type text not null check(event_type in (
  'refund.created','refund.updated','refund.failed','charge.refunded',
  'charge.refund.updated','charge.dispute.created','charge.dispute.updated',
  'charge.dispute.closed','charge.dispute.funds_withdrawn',
  'charge.dispute.funds_reinstated')),
 charge_id text not null check(charge_id ~ '^ch_[a-zA-Z0-9_]{6,180}$'),
 customer_id text not null check(customer_id ~ '^cus_[a-zA-Z0-9_]{6,100}$'),
 stripe_event_at timestamptz not null,
 received_at timestamptz not null default now(),
 applied_at timestamptz,
 source_reference text,
 check(applied_at is null or source_reference is not null)
);
create index if not exists premium_reversal_pending_charge
 on app_private.premium_test_reversal_inbox(charge_id,customer_id)
 where applied_at is null;

alter table app_private.premium_test_charge_proofs enable row level security;
alter table app_private.premium_test_reversal_inbox enable row level security;
revoke all on app_private.premium_test_charge_proofs from public,anon,authenticated;
revoke all on app_private.premium_test_reversal_inbox from public,anon,authenticated;

-- Signed reversal, resolved to a real TEST charge by Stripe's API.
-- No source_reference or user_id accepted from the caller.
create or replace function public.billing_record_verified_test_reversal(
 p_event_id text,p_event_type text,p_event_created_at timestamptz,
 p_charge_id text,p_customer_id text
) returns text language plpgsql security definer set search_path=''
as $fn$
declare
 v_now timestamptz:=clock_timestamp();
 v_source text;
begin
 if p_event_id is null or p_event_id !~ '^evt_[a-zA-Z0-9_]{6,160}$'
  or p_event_type not in (
   'refund.created','refund.updated','refund.failed','charge.refunded',
   'charge.refund.updated','charge.dispute.created','charge.dispute.updated',
   'charge.dispute.closed','charge.dispute.funds_withdrawn',
   'charge.dispute.funds_reinstated')
  or p_charge_id is null or p_charge_id !~ '^ch_[a-zA-Z0-9_]{6,180}$'
  or p_customer_id is null or p_customer_id !~ '^cus_[a-zA-Z0-9_]{6,100}$'
  or p_event_created_at is null
  or p_event_created_at>v_now+interval '5 minutes'
  or p_event_created_at<v_now-interval '90 days' then
  raise exception 'Invalid TEST reversal data' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(20261027,pg_catalog.hashtext(p_charge_id));
 insert into app_private.premium_test_reversal_inbox
  (event_id,event_type,charge_id,customer_id,stripe_event_at)
 values(p_event_id,p_event_type,p_charge_id,p_customer_id,p_event_created_at)
 on conflict(event_id) do nothing;
 if not found then
  -- Duplicate event must not update a different charge or user.
  if not exists(select 1 from app_private.premium_test_reversal_inbox r
   where r.event_id=p_event_id and r.event_type=p_event_type
    and r.charge_id=p_charge_id and r.customer_id=p_customer_id) then
   raise exception 'Mismatched duplicate TEST reversal' using errcode='42501';
  end if;
 end if;
 select p.source_reference into v_source
 from app_private.premium_test_charge_proofs p
 join app_private.premium_access_grants g
  on g.source_reference=p.source_reference
 where p.charge_id=p_charge_id and p.customer_id=p_customer_id
 for update of p;
 if v_source is null then
  return 'queued'; -- durable acknowledgement; bind will reconcile later
 end if;
 update app_private.premium_access_grants g
  set revoked_at=greatest(v_now,g.verified_at)
 where g.source_reference=v_source and g.revoked_at is null;
 update app_private.premium_test_reversal_inbox r
  set source_reference=v_source,applied_at=coalesce(r.applied_at,v_now)
 where r.charge_id=p_charge_id and r.customer_id=p_customer_id
   and r.applied_at is null;
 return 'applied';
end;
$fn$;

-- Called after paid event processed AND official Stripe API independently
-- verified PaymentIntent status, exact amount/customer and successful Charge.
-- A refunded/disputed charge is bound but its grant is immediately revoked.
create or replace function public.billing_bind_verified_test_charge(
 p_source_reference text,p_charge_id text,p_payment_intent_id text,
 p_customer_id text,p_reversed boolean
) returns boolean language plpgsql security definer set search_path=''
as $fn$
declare
 v_grant app_private.premium_access_grants%rowtype;
 v_link app_private.premium_test_checkout_links%rowtype;
 v_existing app_private.premium_test_charge_proofs%rowtype;
 v_has_reversal boolean:=false;
 v_now timestamptz:=clock_timestamp();
begin
 if p_source_reference is null
  or p_charge_id is null or p_charge_id !~ '^ch_[a-zA-Z0-9_]{6,180}$'
  or p_payment_intent_id is null
  or p_payment_intent_id !~ '^pi_[a-zA-Z0-9_]{6,180}$'
  or p_customer_id is null or p_customer_id !~ '^cus_[a-zA-Z0-9_]{6,100}$'
  or p_reversed is null then
  raise exception 'Invalid Stripe TEST charge proof' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(20261027,pg_catalog.hashtext(p_charge_id));
 select g.* into v_grant from app_private.premium_access_grants g
  where g.source_reference=p_source_reference for update;
 if v_grant.id is null or v_grant.source_kind<>'verified_stripe_test' then
  raise exception 'No verified Premium grant to bind' using errcode='42501';
 end if;
 select l.* into v_link
 from app_private.premium_test_grant_sources s
 join app_private.premium_test_checkout_links l on l.checkout_id=s.checkout_id
 where s.source_reference=p_source_reference for update of l;
 if v_link.checkout_id is null
  or v_link.user_id<>v_grant.user_id
  or v_link.plan_kind<>v_grant.plan_kind
  or v_link.customer_id is distinct from p_customer_id
  or (v_link.plan_kind='annual' and v_link.checkout_id<>p_source_reference)
  or (v_link.plan_kind='monthly' and v_link.subscription_id is null) then
  raise exception 'Stripe TEST charge has no matching verified checkout'
    using errcode='42501';
 end if;
 select * into v_existing from app_private.premium_test_charge_proofs
  where source_reference=p_source_reference for update;
 if v_existing.source_reference is not null
  and (v_existing.charge_id<>p_charge_id
   or v_existing.payment_intent_id<>p_payment_intent_id
   or v_existing.customer_id<>p_customer_id) then
  raise exception 'Conflicting payment identity for grant'
    using errcode='23505';
 end if;
 insert into app_private.premium_test_charge_proofs
  (source_reference,charge_id,payment_intent_id,customer_id)
 values(p_source_reference,p_charge_id,p_payment_intent_id,p_customer_id)
 on conflict(source_reference) do nothing;
 select exists(select 1 from app_private.premium_test_reversal_inbox r
  where r.charge_id=p_charge_id and r.customer_id=p_customer_id)
 into v_has_reversal;
 if p_reversed or v_has_reversal then
  update app_private.premium_access_grants g
   set revoked_at=greatest(v_now,g.verified_at)
  where g.source_reference=p_source_reference and g.revoked_at is null;
 end if;
 update app_private.premium_test_reversal_inbox r
  set source_reference=p_source_reference,applied_at=coalesce(applied_at,v_now)
  where r.charge_id=p_charge_id and r.customer_id=p_customer_id
    and r.applied_at is null;
 return true;
end;
$fn$;

-- Member authorization is now fail-closed until the charge proof has been
-- bound. This eliminates the race between invoice.paid -> grant -> charge proof.
create or replace function app_private.member_has_active_premium()
returns boolean language sql stable security definer set search_path=''
as $fn$
 select (select auth.uid()) is not null
  and exists(select 1 from auth.users u
    where u.id=(select auth.uid()) and u.email_confirmed_at is not null)
  and exists(
    select 1 from app_private.premium_access_grants g
    join app_private.premium_test_charge_proofs p
      on p.source_reference=g.source_reference
    where g.user_id=(select auth.uid())
      and g.source_kind='verified_stripe_test'
      and g.verified_at<=now() and g.revoked_at is null
      and g.valid_from<=now() and now()<g.valid_until
  );
$fn$;

-- The RPC still exposes only *own* plan/state/expiry, never financial IDs.
-- Pending unbound grants must not be represented as active.
create or replace function public.member_my_premium_status()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare
 v_user uuid:=(select auth.uid());
 v_now timestamptz:=clock_timestamp();
 v_active app_private.premium_access_grants%rowtype;
 v_latest app_private.premium_access_grants%rowtype;
begin
 if v_user is null then
  raise exception 'Authentication required' using errcode='28000';
 end if;
 if not exists(select 1 from auth.users u
  where u.id=v_user and u.email_confirmed_at is not null) then
  return jsonb_build_object('state','unverified','active',false,
   'plan',null,'valid_until',null);
 end if;
 select g.* into v_active from app_private.premium_access_grants g
 join app_private.premium_test_charge_proofs p
  on p.source_reference=g.source_reference
 where g.user_id=v_user
  and g.source_kind='verified_stripe_test' and g.verified_at<=v_now
  and g.revoked_at is null and g.valid_from<=v_now and v_now<g.valid_until
 order by g.valid_until desc,g.created_at desc,g.id
 limit 1;
 if v_active.id is not null then
  return jsonb_build_object('state','active','active',true,
   'plan',v_active.plan_kind,'valid_until',v_active.valid_until);
 end if;
 select g.* into v_latest from app_private.premium_access_grants g
 join app_private.premium_test_charge_proofs p
  on p.source_reference=g.source_reference
 where g.user_id=v_user and g.verified_at<=v_now
 order by g.verified_at desc,g.id desc limit 1;
 if v_latest.id is null then
  return jsonb_build_object('state','none','active',false,
   'plan',null,'valid_until',null);
 end if;
 return jsonb_build_object('state',
  case when v_latest.revoked_at is not null then 'revoked'
   when v_latest.valid_from>v_now then 'upcoming' else 'expired' end,
  'active',false,'plan',v_latest.plan_kind,
  'valid_until',v_latest.valid_until);
end;
$fn$;

-- Operational queue health, no charge identifiers or user details exposed.
create or replace function public.billing_test_reversal_backlog()
returns jsonb language sql stable security definer set search_path=''
as $fn$
 select jsonb_build_object(
  'pending',count(*) filter(where r.applied_at is null),
  'oldest',min(r.received_at) filter(where r.applied_at is null),
  'reconciled',count(*) filter(where r.applied_at is not null)
 ) from app_private.premium_test_reversal_inbox r;
$fn$;

revoke all on function public.billing_record_verified_test_reversal(
 text,text,timestamptz,text,text)
 from public,anon,authenticated,service_role;
revoke all on function public.billing_bind_verified_test_charge(
 text,text,text,text,boolean)
 from public,anon,authenticated,service_role;
revoke all on function public.billing_test_reversal_backlog()
 from public,anon,authenticated,service_role;
revoke all on function app_private.member_has_active_premium()
 from public,anon,authenticated;
revoke all on function public.member_my_premium_status()
 from public,anon,authenticated;
grant execute on function public.billing_record_verified_test_reversal(
 text,text,timestamptz,text,text) to service_role;
grant execute on function public.billing_bind_verified_test_charge(
 text,text,text,text,boolean) to service_role;
grant execute on function public.billing_test_reversal_backlog()
 to service_role;
grant execute on function public.member_my_premium_status()
 to authenticated;
commit;
