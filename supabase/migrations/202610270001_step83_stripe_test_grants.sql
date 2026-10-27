-- Étape 83, STAGING ISOLÉ UNIQUEMENT.
-- Après 202610260019_premium_server_entitlements.sql (étape 82).
-- Ne pas exécuter sur le projet Boissy-UJ principal :
-- l'unique projet connecté ne possède pas d'environnement TEST indépendant.
-- Aucun achat ni droit n'est créé par cette migration.
begin;

create table if not exists app_private.premium_test_checkout_links (
 checkout_id text primary key check(checkout_id ~ '^cs_test_[a-zA-Z0-9_]{8,180}$'),
 user_id uuid not null references auth.users(id) on delete cascade,
 plan_kind text not null check(plan_kind in ('monthly','annual')),
 price_id text not null check(price_id ~ '^price_[a-zA-Z0-9_]{6,100}$'),
 customer_id text check(customer_id ~ '^cus_[a-zA-Z0-9_]{6,100}$'),
 subscription_id text unique check(subscription_id ~ '^sub_[a-zA-Z0-9_]{6,100}$'),
 closed_at timestamptz,
 created_at timestamptz not null default now(),
 check(plan_kind='monthly' or subscription_id is null)
);
create index if not exists premium_test_checkout_subscription_user
 on app_private.premium_test_checkout_links(user_id,created_at desc);

create table if not exists app_private.premium_test_webhook_receipts (
 event_id text primary key check(event_id ~ '^evt_[a-zA-Z0-9_]{6,160}$'),
 event_type text not null check(event_type in (
  'checkout.session.completed','checkout.session.async_payment_succeeded',
  'invoice.paid','invoice.payment_failed','customer.subscription.deleted')),
 processed_at timestamptz not null default now()
);

-- Attribution -> Checkout TEST enregistré. Cette liaison empêche
-- l'annulation d'une souscription de révoquer un autre achat de l'utilisateur.
create table if not exists app_private.premium_test_grant_sources (
 source_reference text primary key
   references app_private.premium_access_grants(source_reference) on delete cascade,
 checkout_id text not null
   references app_private.premium_test_checkout_links(checkout_id) on delete restrict
);
create index if not exists premium_test_grants_by_checkout
 on app_private.premium_test_grant_sources(checkout_id);

alter table app_private.premium_test_checkout_links enable row level security;
alter table app_private.premium_test_webhook_receipts enable row level security;
alter table app_private.premium_test_grant_sources enable row level security;
revoke all on app_private.premium_test_checkout_links from public,anon,authenticated;
revoke all on app_private.premium_test_webhook_receipts from public,anon,authenticated;
revoke all on app_private.premium_test_grant_sources from public,anon,authenticated;

-- Uniquement via le serveur Checkout après vérification réelle du JWT
-- Supabase et de l'email confirmé ; la requête cliente ne choisit jamais user_id.
create or replace function public.billing_register_test_checkout(
 p_user_id uuid,p_checkout_id text,p_price_id text,p_plan_kind text
) returns boolean language plpgsql security definer set search_path=''
as $fn$
begin
 if p_user_id is null
  or p_checkout_id is null or p_checkout_id !~ '^cs_test_[a-zA-Z0-9_]{8,180}$'
  or p_price_id is null or p_price_id !~ '^price_[a-zA-Z0-9_]{6,100}$'
  or p_plan_kind is null or p_plan_kind not in ('monthly','annual') then
  raise exception 'Invalid TEST Checkout registration' using errcode='22023';
 end if;
 if not exists(select 1 from auth.users u where u.id=p_user_id
  and u.email_confirmed_at is not null) then
  raise exception 'Verified staging account required' using errcode='42501';
 end if;
 insert into app_private.premium_test_checkout_links
  (checkout_id,user_id,price_id,plan_kind)
 values(p_checkout_id,p_user_id,p_price_id,p_plan_kind)
 on conflict(checkout_id) do nothing;
 if not found then
  raise exception 'Checkout already registered' using errcode='23505';
 end if;
 return true;
end;
$fn$;

-- Le Webhook Edge a vérifié la signature sur le RAW body et normalisé
-- le montant exact en EUR, la ligne de prix unique et le mode Stripe TEST.
-- Seul service_role a EXECUTE. Les refus sont transactionnels.
create or replace function public.billing_apply_verified_test_event(
 p_event_id text,p_event_type text,p_event_created_at timestamptz,
 p_checkout_id text default null,p_subscription_id text default null,
 p_customer_id text default null,p_price_id text default null,
 p_source_id text default null,p_period_start timestamptz default null,
 p_period_end timestamptz default null,p_paid boolean default false
) returns boolean
language plpgsql security definer set search_path=''
as $fn$
declare
 v_link app_private.premium_test_checkout_links%rowtype;
 v_now timestamptz:=clock_timestamp();
 v_expiry timestamptz;
 v_source text;
begin
 if p_event_id is null or p_event_id !~ '^evt_[a-zA-Z0-9_]{6,160}$'
  or p_event_type is null or p_event_type not in (
   'checkout.session.completed','checkout.session.async_payment_succeeded',
   'invoice.paid','invoice.payment_failed','customer.subscription.deleted')
  or p_event_created_at is null
  or p_event_created_at > v_now+interval '5 minutes'
  or p_event_created_at < v_now-interval '90 days'
  or p_paid is null then
  raise exception 'Invalid verified TEST billing event' using errcode='22023';
 end if;
 -- Unique event receipt + checkout row lock serializes independently
 -- delivered events; receipt is written last in the same transaction.
 perform pg_catalog.pg_advisory_xact_lock(20261027,pg_catalog.hashtext(p_event_id));
 if exists(select 1 from app_private.premium_test_webhook_receipts
  where event_id=p_event_id) then return true; end if;
 if p_event_type like 'checkout.session.%' then
  select * into v_link from app_private.premium_test_checkout_links
   where checkout_id=p_checkout_id for update;
 else
  select * into v_link from app_private.premium_test_checkout_links
   where subscription_id=p_subscription_id for update;
 end if;
 if not found then
  -- Webhook retry when invoice arrives before Checkout binding.
  raise exception 'Unknown Stripe TEST Checkout; retry event' using errcode='P0001';
 end if;
 if p_customer_id is null or p_customer_id !~ '^cus_[a-zA-Z0-9_]{6,100}$'
  or (v_link.customer_id is not null and v_link.customer_id<>p_customer_id)
  or p_price_id is distinct from v_link.price_id then
  raise exception 'Wrong TEST customer or price binding' using errcode='42501';
 end if;
 if v_link.closed_at is not null then
  -- Do not regrant on late events after terminal cancellation.
  insert into app_private.premium_test_webhook_receipts(event_id,event_type)
    values(p_event_id,p_event_type);
  return false;
 end if;
 if p_event_type like 'checkout.session.%' then
  if p_checkout_id is distinct from v_link.checkout_id then
   raise exception 'Wrong checkout session' using errcode='42501';
  end if;
  if v_link.plan_kind='monthly' then
   if p_subscription_id is null
    or p_subscription_id !~ '^sub_[a-zA-Z0-9_]{6,100}$'
    or (v_link.subscription_id is not null
      and v_link.subscription_id<>p_subscription_id) then
    raise exception 'Invalid subscription binding' using errcode='42501';
   end if;
   update app_private.premium_test_checkout_links
    set customer_id=p_customer_id,subscription_id=p_subscription_id
    where checkout_id=v_link.checkout_id;
   -- NEVER grant monthly Premium from Checkout; wait for invoice.paid.
  else
   if p_subscription_id is not null then
    raise exception 'Annual checkout cannot recur' using errcode='42501';
   end if;
   update app_private.premium_test_checkout_links set customer_id=p_customer_id
    where checkout_id=v_link.checkout_id;
   if p_paid then
    if p_source_id is distinct from v_link.checkout_id
      or p_period_start is null
      or p_period_start>v_now+interval '5 minutes' then
     raise exception 'Invalid paid annual period' using errcode='42501';
    end if;
    v_expiry:=p_period_start+interval '12 months';
    if v_expiry<=v_now then
     raise exception 'Annual period expired' using errcode='42501';
    end if;
    insert into app_private.premium_access_grants(
      user_id,source_kind,source_reference,plan_kind,valid_from,valid_until)
    values(v_link.user_id,'verified_stripe_test',v_link.checkout_id,
      'annual',p_period_start,v_expiry)
    on conflict(source_reference) do nothing;
    insert into app_private.premium_test_grant_sources(source_reference,checkout_id)
     values(v_link.checkout_id,v_link.checkout_id)
    on conflict(source_reference) do nothing;
   end if;
  end if;
 elsif p_event_type='invoice.paid' then
  if v_link.plan_kind<>'monthly'
   or p_subscription_id is distinct from v_link.subscription_id
   or not p_paid
   or p_source_id is null or p_source_id !~ '^in_[a-zA-Z0-9_]{6,180}$'
   or p_period_start is null or p_period_end is null
   or p_period_end<=p_period_start or p_period_end<=v_now
   or p_period_start>v_now+interval '5 minutes' then
   raise exception 'Invalid paid monthly invoice' using errcode='42501';
  end if;
  -- Each paid invoice is immutable, independent, and idempotent.
  insert into app_private.premium_access_grants(
    user_id,source_kind,source_reference,plan_kind,valid_from,valid_until)
  values(v_link.user_id,'verified_stripe_test',p_source_id,
   'monthly',p_period_start,p_period_end)
  on conflict(source_reference) do nothing;
  insert into app_private.premium_test_grant_sources(source_reference,checkout_id)
   values(p_source_id,v_link.checkout_id)
  on conflict(source_reference) do nothing;
 elsif p_event_type='customer.subscription.deleted' then
  if v_link.plan_kind<>'monthly'
   or p_subscription_id is distinct from v_link.subscription_id then
   raise exception 'Wrong subscription cancellation' using errcode='42501';
  end if;
  update app_private.premium_test_checkout_links set closed_at=v_now
   where checkout_id=v_link.checkout_id;
  -- Revoke ONLY grants linked to this subscription checkout.
  update app_private.premium_access_grants g set revoked_at=v_now
   from app_private.premium_test_grant_sources s
   where s.source_reference=g.source_reference
    and s.checkout_id=v_link.checkout_id
    and g.user_id=v_link.user_id and g.plan_kind='monthly'
    and g.revoked_at is null;
 elsif p_event_type='invoice.payment_failed' then
  -- A failed renewal must not retroactively revoke a paid period.
  null;
 end if;
 insert into app_private.premium_test_webhook_receipts(event_id,event_type)
  values(p_event_id,p_event_type);
 return true;
end;
$fn$;

revoke all on function public.billing_register_test_checkout(uuid,text,text,text)
 from public,anon,authenticated,service_role;
revoke all on function public.billing_apply_verified_test_event(
 text,text,timestamptz,text,text,text,text,text,timestamptz,timestamptz,boolean)
 from public,anon,authenticated,service_role;
grant execute on function public.billing_register_test_checkout(uuid,text,text,text)
 to service_role;
grant execute on function public.billing_apply_verified_test_event(
 text,text,timestamptz,text,text,text,text,text,timestamptz,timestamptz,boolean)
 to service_role;
comment on function public.billing_apply_verified_test_event(
 text,text,timestamptz,text,text,text,text,text,timestamptz,timestamptz,boolean)
 is 'Stripe TEST, authorized isolated staging only; signed webhook normalizes before service_role RPC; no LIVE payments.';
commit;
