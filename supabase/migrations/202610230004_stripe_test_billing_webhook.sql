-- Étape 55 — Préparer le webhook Stripe TEST pour Premium ; NE PAS appliquer en production.
-- Dépend de 202610230003_premium_awards_ballots.sql.
-- Aucune session, facture ou autorisation de Premium n'est créée ici.
begin;

-- Liaison établie uniquement par un futur endpoint Checkout serveur, jamais par
-- client_reference_id, metadata utilisateur ni par une page de retour du paiement.
create table if not exists app_private.premium_test_checkout_links (
 checkout_id text primary key check (checkout_id ~ '^cs_test_[a-zA-Z0-9_]{8,180}$'),
 user_id uuid not null references auth.users(id) on delete cascade,
 plan_kind text not null check (plan_kind in ('monthly','annual')),
 price_id text not null check (price_id ~ '^price_[a-zA-Z0-9_]{6,100}$'),
 customer_id text check (customer_id ~ '^cus_[a-zA-Z0-9_]{6,100}$'),
 subscription_id text unique check (subscription_id ~ '^sub_[a-zA-Z0-9_]{6,100}$'),
 closed_at timestamptz,
 last_event_at timestamptz,
 created_at timestamptz not null default now(),
 constraint premium_plan_subscription check(
  plan_kind='monthly' or subscription_id is null
 )
);
create index if not exists premium_test_checkout_by_user
 on app_private.premium_test_checkout_links(user_id,created_at desc);
create index if not exists premium_test_checkout_by_customer
 on app_private.premium_test_checkout_links(customer_id)
 where customer_id is not null;

-- Ne conserver que les identifiants d'événements et l'état traité, aucun payload.
create table if not exists app_private.premium_test_webhook_receipts (
 event_id text primary key check (event_id ~ '^evt_[a-zA-Z0-9_]{6,160}$'),
 event_type text not null check (event_type in (
  'checkout.session.completed','checkout.session.async_payment_succeeded',
  'invoice.paid','invoice.payment_failed','customer.subscription.deleted'
 )),
 processed_at timestamptz not null default now()
);
alter table app_private.premium_test_checkout_links enable row level security;
alter table app_private.premium_test_webhook_receipts enable row level security;
revoke all on app_private.premium_test_checkout_links from public,anon,authenticated;
revoke all on app_private.premium_test_webhook_receipts from public,anon,authenticated;

-- Auth user ID resolved from a verified server-side Supabase Auth session by
-- the future Checkout Edge Function, Stripe session created server-to-server.
-- Only service_role may bind checkout -> member. This RPC does not grant Premium.
create or replace function public.billing_register_test_checkout(
 p_user_id uuid,p_checkout_id text,p_price_id text,p_plan_kind text
) returns boolean
language plpgsql security definer set search_path=''
as $fn$
begin
 if p_user_id is null or p_checkout_id is null or p_price_id is null
   or p_plan_kind is null then
   raise exception 'Checkout registration incomplete' using errcode='22023';
 end if;
 if not exists(select 1 from auth.users u
    where u.id=p_user_id and u.email_confirmed_at is not null) then
   raise exception 'Verified user required' using errcode='42501';
 end if;
 insert into app_private.premium_test_checkout_links
   (checkout_id,user_id,price_id,plan_kind)
 values(p_checkout_id,p_user_id,p_price_id,p_plan_kind)
 on conflict(checkout_id) do nothing;
 if not found then
   raise exception 'Checkout session already registered' using errcode='23505';
 end if;
 return true;
end;
$fn$;

-- Stripe signature was checked on RAW bytes by the Edge Function BEFORE this
-- privileged server-only RPC is invoked. This is an extra trust boundary, not
-- a publicly available billing API. Unknown sessions MUST fail and retry.
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
 v_expire timestamptz;
 v_now timestamptz := clock_timestamp();
begin
 if p_event_id is null or p_event_id !~ '^evt_[a-zA-Z0-9_]{6,160}$'
   or p_event_type is null or p_event_type not in (
     'checkout.session.completed','checkout.session.async_payment_succeeded',
     'invoice.paid','invoice.payment_failed','customer.subscription.deleted'
   ) or p_event_created_at is null or p_event_created_at>v_now+interval '5 minutes'
   or p_event_created_at<v_now-interval '90 days' then
   raise exception 'Invalid Stripe TEST event' using errcode='22023';
 end if;

 -- Serialize duplicate delivery and reordered events per identifier.
 perform pg_catalog.pg_advisory_xact_lock(20261023,pg_catalog.hashtext(p_event_id));
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
   -- HTTP 503 -> Stripe retries, allowing out-of-order checkout/invoice arrival.
   raise exception 'Unknown registered Stripe TEST checkout'
     using errcode='P0001';
 end if;
 if p_customer_id is null or p_customer_id !~ '^cus_[a-zA-Z0-9_]{6,100}$'
   or (v_link.customer_id is not null and v_link.customer_id<>p_customer_id)
   or p_price_id is distinct from v_link.price_id then
   raise exception 'Unexpected Stripe customer or price' using errcode='42501';
 end if;
 if v_link.last_event_at is not null
   and p_event_created_at<v_link.last_event_at
   and p_event_type not in ('customer.subscription.deleted','invoice.paid') then
   -- Out-of-order old invoices must NEVER recreate an expired entitlement.
   insert into app_private.premium_test_webhook_receipts(event_id,event_type)
   values(p_event_id,p_event_type);
   return false;
 end if;
 if v_link.closed_at is not null
   and p_event_type<>'customer.subscription.deleted' then
   insert into app_private.premium_test_webhook_receipts(event_id,event_type)
   values(p_event_id,p_event_type);
   return false;
 end if;

 if p_event_type like 'checkout.session.%' then
   if p_checkout_id<>v_link.checkout_id then
     raise exception 'Wrong Checkout session' using errcode='42501';
   end if;
   if v_link.plan_kind='monthly' then
     if p_subscription_id is null
       or p_subscription_id !~ '^sub_[a-zA-Z0-9_]{6,100}$'
       or (v_link.subscription_id is not null and
         v_link.subscription_id<>p_subscription_id) then
       raise exception 'Subscription binding missing' using errcode='42501';
     end if;
     update app_private.premium_test_checkout_links
       set customer_id=p_customer_id,subscription_id=p_subscription_id
       where checkout_id=v_link.checkout_id;
     -- A subscription being CREATED does not equal a PAID invoice: no grant.
   elsif v_link.plan_kind='annual' then
     if p_subscription_id is not null then
       raise exception 'Annual plan must be non-recurring' using errcode='42501';
     end if;
     if p_paid and p_period_start is not null and p_source_id is not null
       and p_source_id ~ '^cs_test_[a-zA-Z0-9_]{8,180}$' then
       if p_source_id<>v_link.checkout_id then
         raise exception 'Wrong annual payment reference' using errcode='42501';
       end if;
       -- Twelve *calendar* months with NO automatic renewal.
       v_expire:=p_period_start+interval '12 months';
       if p_period_start>v_now+interval '5 minutes'
         or v_expire<=v_now then
         raise exception 'Annual payment outside valid period'
           using errcode='42501';
       end if;
       insert into app_private.award_vote_entitlements
         (user_id,source_kind,source_reference,valid_from,valid_until)
       values(v_link.user_id,'verified_billing_webhook',v_link.checkout_id,
         p_period_start,v_expire)
       on conflict(user_id) do update
         set source_reference=excluded.source_reference,
             valid_from=excluded.valid_from,
             valid_until=excluded.valid_until,
             verified_at=now(),revoked_at=null;
     end if;
     update app_private.premium_test_checkout_links
       set customer_id=p_customer_id where checkout_id=v_link.checkout_id;
   end if;
 elsif p_event_type='invoice.paid' then
   if v_link.plan_kind<>'monthly'
     or p_subscription_id is distinct from v_link.subscription_id
     or not p_paid or p_source_id is null or p_source_id !~ '^in_[a-zA-Z0-9_]{6,160}$'
     or p_period_start is null or p_period_end is null
     or p_period_end<=p_period_start or p_period_end<=v_now
     or p_period_start>v_now+interval '5 minutes' then
     raise exception 'Invalid paid invoice' using errcode='42501';
   end if;
   -- An older paid invoice must never shorten a newer paid entitlement.
   if exists(select 1 from app_private.award_vote_entitlements e
       where e.user_id=v_link.user_id and e.revoked_at is null
         and e.valid_until>=p_period_end) then
     insert into app_private.premium_test_webhook_receipts(event_id,event_type)
       values(p_event_id,p_event_type);
     return false;
   end if;
   insert into app_private.award_vote_entitlements
      (user_id,source_kind,source_reference,valid_from,valid_until)
    values(v_link.user_id,'verified_billing_webhook',p_source_id,
      p_period_start,p_period_end)
   on conflict(user_id) do update
     set source_reference=excluded.source_reference,
         valid_from=excluded.valid_from,
         valid_until=excluded.valid_until,
         verified_at=now(),revoked_at=null;
 elsif p_event_type='customer.subscription.deleted' then
   if v_link.plan_kind<>'monthly'
      or p_subscription_id is distinct from v_link.subscription_id then
     raise exception 'Invalid cancelled subscription' using errcode='42501';
   end if;
   update app_private.premium_test_checkout_links set closed_at=v_now
     where checkout_id=v_link.checkout_id;
   update app_private.award_vote_entitlements e set revoked_at=v_now
     where e.user_id=v_link.user_id and e.revoked_at is null;
 elsif p_event_type='invoice.payment_failed' then
   -- Do NOT cancel already-paid access before paid period ends.
   null;
 end if;
 update app_private.premium_test_checkout_links set
   last_event_at=greatest(coalesce(last_event_at,p_event_created_at),p_event_created_at)
   where checkout_id=v_link.checkout_id;
 insert into app_private.premium_test_webhook_receipts(event_id,event_type)
 values(p_event_id,p_event_type);
 return true;
end;
$fn$;

revoke all on function public.billing_register_test_checkout(uuid,text,text,text)
 from public,anon,authenticated,service_role;
revoke all on function public.billing_apply_verified_test_event(
 text,text,timestamptz,text,text,text,text,text,timestamptz,timestamptz,boolean
) from public,anon,authenticated,service_role;
grant execute on function public.billing_register_test_checkout(uuid,text,text,text)
 to service_role;
grant execute on function public.billing_apply_verified_test_event(
 text,text,timestamptz,text,text,text,text,text,timestamptz,timestamptz,boolean
) to service_role;
comment on function public.billing_apply_verified_test_event(
 text,text,timestamptz,text,text,text,text,text,timestamptz,timestamptz,boolean
) is 'Stripe TEST signed-event private reconciliation. Service role only. Never call from public browser.';
commit;
