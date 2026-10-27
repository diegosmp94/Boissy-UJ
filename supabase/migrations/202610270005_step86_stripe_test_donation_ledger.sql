-- Boissy-UJ stage 86B: DONATIONS STRIPE TEST ONLY. ISOLATED STAGING REQUIRED.
-- MUST NEVER BE RUN ON MAIN SUPABASE PROJECT dahzewvbybujqhogumte.
-- Requires 86A public.donation_campaigns. Does not create transactions.
begin;

create table if not exists app_private.donation_test_checkouts (
 checkout_id text primary key check(checkout_id ~ '^cs_test_[a-zA-Z0-9_]{6,180}$'),
 user_id uuid not null references auth.users(id) on delete cascade,
 campaign_id uuid not null references public.donation_campaigns(id) on delete restrict,
 frequency text not null check(frequency in ('once','monthly')),
 amount_cents integer not null check(amount_cents between 100 and 100000),
 customer_id text check(customer_id ~ '^cus_[a-zA-Z0-9_]{6,100}$'),
 subscription_id text unique check(subscription_id ~ '^sub_[a-zA-Z0-9_]{6,100}$'),
 created_at timestamptz not null default now(),
 check(frequency='monthly' or subscription_id is null)
);
create index if not exists donation_test_campaign_lookup
 on app_private.donation_test_checkouts(campaign_id,created_at desc);
create table if not exists app_private.donation_test_receipts (
 source_reference text primary key check(
  source_reference ~ '^(in|cs_test)_[a-zA-Z0-9_]{6,180}$'),
 checkout_id text not null
  references app_private.donation_test_checkouts(checkout_id) on delete restrict,
 event_id text not null unique check(event_id ~ '^evt_[a-zA-Z0-9_]{6,160}$'),
 payment_intent_id text not null unique
  check(payment_intent_id ~ '^pi_[a-zA-Z0-9_]{6,180}$'),
 charge_id text not null unique check(charge_id ~ '^ch_[a-zA-Z0-9_]{6,180}$'),
 amount_cents integer not null check(amount_cents between 100 and 100000),
 frequency text not null check(frequency in ('once','monthly')),
 status text not null default 'settled' check(status in ('settled','reversed')),
 verified_at timestamptz not null default now(),
 reversed_at timestamptz
);
create index if not exists donation_test_receipts_by_checkout
 on app_private.donation_test_receipts(checkout_id,verified_at desc);
create table if not exists app_private.donation_test_reversal_inbox (
 event_id text primary key check(event_id ~ '^evt_[a-zA-Z0-9_]{6,160}$'),
 charge_id text not null check(charge_id ~ '^ch_[a-zA-Z0-9_]{6,180}$'),
 event_type text not null check(event_type in (
  'charge.refunded','charge.dispute.created','refund.created','refund.updated')),
 received_at timestamptz not null default now(),
 applied_at timestamptz
);
create index if not exists donation_test_pending_reversals
 on app_private.donation_test_reversal_inbox(charge_id)
 where applied_at is null;
alter table app_private.donation_test_checkouts enable row level security;
alter table app_private.donation_test_receipts enable row level security;
alter table app_private.donation_test_reversal_inbox enable row level security;
revoke all on app_private.donation_test_checkouts from public,anon,authenticated;
revoke all on app_private.donation_test_receipts from public,anon,authenticated;
revoke all on app_private.donation_test_reversal_inbox from public,anon,authenticated;

-- Only service_role after staging Auth and Stripe TEST Checkout generated server-side.
create or replace function public.billing_register_test_donation_checkout(
 p_user_id uuid,p_checkout_id text,p_campaign_id uuid,
 p_frequency text,p_amount_cents integer)
returns boolean language plpgsql security definer set search_path=''
as $fn$
begin
 if p_user_id is null or p_campaign_id is null
   or p_checkout_id is null or p_checkout_id !~ '^cs_test_[a-zA-Z0-9_]{6,180}$'
   or p_frequency not in ('once','monthly') or p_amount_cents not between 100 and 100000
   or not exists(select 1 from auth.users u where u.id=p_user_id
      and u.email_confirmed_at is not null)
   or not exists(select 1 from public.donation_campaigns c
     where c.id=p_campaign_id and c.published=true and c.status='open'
     and c.starts_at<=now() and (c.ends_at is null or now()<c.ends_at))
 then raise exception 'Donation TEST checkout is not authorized'
   using errcode='42501';end if;
 insert into app_private.donation_test_checkouts
   (checkout_id,user_id,campaign_id,frequency,amount_cents)
 values(p_checkout_id,p_user_id,p_campaign_id,p_frequency,p_amount_cents)
 on conflict(checkout_id) do nothing;
 if not found then
  raise exception 'Donation checkout already registered' using errcode='23505';
 end if;
 return true;
end;
$fn$;

create or replace function public.billing_bind_test_donation_subscription(
 p_checkout_id text,p_customer_id text,p_subscription_id text)
returns boolean language plpgsql security definer set search_path=''
as $fn$
declare v_link app_private.donation_test_checkouts%rowtype;
begin
 if p_checkout_id is null or p_customer_id is null
  or p_customer_id !~ '^cus_[a-zA-Z0-9_]{6,100}$'
  or p_subscription_id is null
  or p_subscription_id !~ '^sub_[a-zA-Z0-9_]{6,100}$'
 then raise exception 'Invalid monthly TEST binding' using errcode='22023';end if;
 select * into v_link from app_private.donation_test_checkouts
  where checkout_id=p_checkout_id for update;
 if v_link.checkout_id is null or v_link.frequency<>'monthly'
   or (v_link.customer_id is not null and v_link.customer_id<>p_customer_id)
   or (v_link.subscription_id is not null and v_link.subscription_id<>p_subscription_id)
 then raise exception 'Wrong monthly TEST donation Checkout'
  using errcode='42501';end if;
 update app_private.donation_test_checkouts
  set customer_id=p_customer_id,subscription_id=p_subscription_id
  where checkout_id=p_checkout_id;
 return true;
end;
$fn$;

-- Never expose donor IDs or raw Checkout records to a member browser.
create or replace function public.billing_resolve_test_donation_subscription(
 p_subscription_id text)
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare v_link app_private.donation_test_checkouts%rowtype;
begin
 select * into v_link from app_private.donation_test_checkouts
  where subscription_id=p_subscription_id and frequency='monthly';
 if v_link.checkout_id is null then
  raise exception 'Unknown verified TEST subscription; retry'
   using errcode='P0001';
 end if;
 return jsonb_build_object('checkout_id',v_link.checkout_id,
  'customer_id',v_link.customer_id,'amount_cents',v_link.amount_cents);
end;
$fn$;

-- Webhook handler MUST verify signature over exact raw body then retrieve
-- successful PaymentIntent + Charge from Stripe TEST for EACH new paid source.
create or replace function public.billing_apply_verified_test_donation(
 p_event_id text,p_event_created_at timestamptz,p_source_reference text,
 p_checkout_id text,p_customer_id text,p_payment_intent_id text,
 p_charge_id text,p_amount_cents integer,p_frequency text,p_reversed boolean)
returns boolean language plpgsql security definer set search_path=''
as $fn$
declare
 v_link app_private.donation_test_checkouts%rowtype;
 v_now timestamptz:=clock_timestamp();
 v_reversed boolean;
begin
 if p_event_id is null or p_event_id !~ '^evt_[a-zA-Z0-9_]{6,160}$'
  or p_event_created_at is null or p_event_created_at>v_now+interval '5 minutes'
  or p_event_created_at<v_now-interval '90 days'
  or p_source_reference is null
  or p_checkout_id is null or p_checkout_id !~ '^cs_test_[a-zA-Z0-9_]{6,180}$'
  or p_customer_id is null or p_customer_id !~ '^cus_[a-zA-Z0-9_]{6,100}$'
  or p_payment_intent_id is null or p_payment_intent_id !~ '^pi_[a-zA-Z0-9_]{6,180}$'
  or p_charge_id is null or p_charge_id !~ '^ch_[a-zA-Z0-9_]{6,180}$'
  or p_frequency not in ('once','monthly')
  or p_amount_cents not between 100 and 100000 or p_reversed is null
  or (p_frequency='once' and p_source_reference<>p_checkout_id)
  or (p_frequency='monthly' and
    p_source_reference !~ '^in_[a-zA-Z0-9_]{6,180}$')
 then raise exception 'Invalid signed donation TEST receipt' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(20261027,pg_catalog.hashtext(p_charge_id));
 select * into v_link from app_private.donation_test_checkouts
  where checkout_id=p_checkout_id for update;
 if v_link.checkout_id is null or v_link.frequency<>p_frequency
  or v_link.amount_cents<>p_amount_cents
  or (v_link.customer_id is not null and v_link.customer_id<>p_customer_id)
  or (p_frequency='monthly' and v_link.subscription_id is null)
 then raise exception 'Payment does not match a registered TEST donation'
  using errcode='42501';end if;
 -- Resolve pending reversals before granting even a TEST success indicator.
 select (p_reversed or exists(
  select 1 from app_private.donation_test_reversal_inbox r
   where r.charge_id=p_charge_id
 )) into v_reversed;
 insert into app_private.donation_test_receipts(
  source_reference,checkout_id,event_id,payment_intent_id,
  charge_id,amount_cents,frequency,status,reversed_at)
 values(p_source_reference,p_checkout_id,p_event_id,p_payment_intent_id,
  p_charge_id,p_amount_cents,p_frequency,
  case when v_reversed then 'reversed' else 'settled' end,
  case when v_reversed then v_now else null end)
 on conflict(source_reference) do nothing;
 if not found and not exists(
   select 1 from app_private.donation_test_receipts r
   where r.source_reference=p_source_reference and r.checkout_id=p_checkout_id
    and r.event_id=p_event_id and r.payment_intent_id=p_payment_intent_id
    and r.charge_id=p_charge_id and r.amount_cents=p_amount_cents) then
  raise exception 'TEST donation payment identity conflict' using errcode='23505';
 end if;
 -- Stable merchant identity for one-time checkout, never supplied by browser.
 if v_link.customer_id is null then
  update app_private.donation_test_checkouts set customer_id=p_customer_id
   where checkout_id=p_checkout_id;
 end if;
 update app_private.donation_test_reversal_inbox
  set applied_at=coalesce(applied_at,v_now)
  where charge_id=p_charge_id and applied_at is null;
 return true;
end;
$fn$;

create or replace function public.billing_record_verified_test_donation_reversal(
 p_event_id text,p_event_type text,p_charge_id text)
returns text language plpgsql security definer set search_path=''
as $fn$
declare v_source text;
begin
 if p_event_id is null or p_event_id !~ '^evt_[a-zA-Z0-9_]{6,160}$'
  or p_event_type not in ('charge.refunded','charge.dispute.created',
    'refund.created','refund.updated')
  or p_charge_id is null or p_charge_id !~ '^ch_[a-zA-Z0-9_]{6,180}$'
 then raise exception 'Invalid signed TEST reversal' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(20261027,pg_catalog.hashtext(p_charge_id));
 insert into app_private.donation_test_reversal_inbox(event_id,event_type,charge_id)
  values(p_event_id,p_event_type,p_charge_id) on conflict(event_id) do nothing;
 if not found and not exists(select 1 from app_private.donation_test_reversal_inbox
    where event_id=p_event_id and charge_id=p_charge_id and event_type=p_event_type)
 then raise exception 'Replayed reversal mismatch' using errcode='23505';end if;
 update app_private.donation_test_receipts set
  status='reversed',reversed_at=coalesce(reversed_at,clock_timestamp())
  where charge_id=p_charge_id and status='settled' returning source_reference into v_source;
 if v_source is null then return 'queued';end if;
 update app_private.donation_test_reversal_inbox
  set applied_at=coalesce(applied_at,clock_timestamp())
  where charge_id=p_charge_id and applied_at is null;
 return 'reversed';
end;
$fn$;

create or replace function public.admin_test_donation_campaign_totals()
returns table(campaign_id uuid,settled_total_cents bigint,settled_count bigint)
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or
  not coalesce((select app_private.is_admin()),false) then
  raise exception 'Admin MFA required' using errcode='42501';
 end if;
 return query select l.campaign_id,
  coalesce(sum(r.amount_cents),0)::bigint,count(*)::bigint
 from app_private.donation_test_receipts r
 join app_private.donation_test_checkouts l on l.checkout_id=r.checkout_id
 where r.status='settled'
 group by l.campaign_id;
end;
$fn$;

-- RPC grants are explicit; no data / receipts visible to anonymous users.
revoke all on function public.billing_register_test_donation_checkout(uuid,text,uuid,text,integer)
 from public,anon,authenticated,service_role;
revoke all on function public.billing_bind_test_donation_subscription(text,text,text)
 from public,anon,authenticated,service_role;
revoke all on function public.billing_resolve_test_donation_subscription(text)
 from public,anon,authenticated,service_role;
revoke all on function public.billing_apply_verified_test_donation(
 text,timestamptz,text,text,text,text,text,integer,text,boolean)
 from public,anon,authenticated,service_role;
revoke all on function public.billing_record_verified_test_donation_reversal(text,text,text)
 from public,anon,authenticated,service_role;
revoke all on function public.admin_test_donation_campaign_totals()
 from public,anon,authenticated,service_role;
grant execute on function public.billing_register_test_donation_checkout(uuid,text,uuid,text,integer)
 to service_role;
grant execute on function public.billing_bind_test_donation_subscription(text,text,text)
 to service_role;
grant execute on function public.billing_resolve_test_donation_subscription(text)
 to service_role;
grant execute on function public.billing_apply_verified_test_donation(
 text,timestamptz,text,text,text,text,text,integer,text,boolean)
 to service_role;
grant execute on function public.billing_record_verified_test_donation_reversal(text,text,text)
 to service_role;
grant execute on function public.admin_test_donation_campaign_totals()
 to authenticated;
commit;
