-- Stage 85: member-controlled Stripe TEST renewal (isolated staging only).
-- Requires 82, 83, 84. Never deploy financial functions to primary project.
-- Does not create or collect payments; subscription remains paid through
-- its verified, existing billing period after a renewal is scheduled to stop.
begin;

alter table app_private.premium_test_checkout_links
 add column if not exists cancel_at_period_end boolean not null default false;
alter table app_private.premium_test_checkout_links
 add column if not exists cancellation_requested_at timestamptz;
alter table app_private.premium_test_checkout_links
 add column if not exists cancellation_effective_at timestamptz;
alter table app_private.premium_test_checkout_links
 add constraint premium_test_cancel_consistent
 check ((cancel_at_period_end=false and cancellation_requested_at is null
  and cancellation_effective_at is null)
 or (cancel_at_period_end=true and cancellation_requested_at is not null
  and cancellation_effective_at>cancellation_requested_at));

-- Multiple overlapping monthly checkouts must not be silently treated as
-- one. A cancellation request is refused, with a contact-support fallback.
create or replace function public.billing_get_member_test_renewal_target(
 p_user_id uuid
) returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare
 v_target app_private.premium_test_checkout_links%rowtype;
 v_count integer;
begin
 if p_user_id is null or not exists(
  select 1 from auth.users u where u.id=p_user_id
   and u.email_confirmed_at is not null
 ) then raise exception 'Confirmed member required' using errcode='42501'; end if;
 select count(distinct l.checkout_id) into v_count
 from app_private.premium_test_checkout_links l
 join app_private.premium_test_grant_sources s on s.checkout_id=l.checkout_id
 join app_private.premium_access_grants g on g.source_reference=s.source_reference
 join app_private.premium_test_charge_proofs p on p.source_reference=g.source_reference
 where l.user_id=p_user_id and l.plan_kind='monthly'
  and l.subscription_id is not null and l.customer_id is not null
  and l.closed_at is null and g.revoked_at is null
  and g.valid_from<=now() and now()<g.valid_until;
 if v_count<>1 then
  raise exception 'No unique active monthly TEST subscription'
   using errcode='42501';
 end if;
 select l.* into v_target
 from app_private.premium_test_checkout_links l
 join app_private.premium_test_grant_sources s on s.checkout_id=l.checkout_id
 join app_private.premium_access_grants g on g.source_reference=s.source_reference
 join app_private.premium_test_charge_proofs p on p.source_reference=g.source_reference
 where l.user_id=p_user_id and l.plan_kind='monthly'
  and l.subscription_id is not null and l.customer_id is not null
  and l.closed_at is null and g.revoked_at is null
  and g.valid_from<=now() and now()<g.valid_until
 order by g.valid_until desc limit 1;
 return jsonb_build_object(
  'subscription_id',v_target.subscription_id,
  'customer_id',v_target.customer_id,
  'price_id',v_target.price_id,
  'scheduled',v_target.cancel_at_period_end);
end;
$fn$;

-- Called only AFTER official Stripe subscriptions.update confirmed
-- cancel_at_period_end=true for the exact bound subscription/customer.
-- Return state is the server truth; a client cannot set these fields.
create or replace function public.billing_confirm_member_test_cancellation(
 p_user_id uuid,p_subscription_id text,p_effective_at timestamptz
) returns boolean language plpgsql security definer set search_path=''
as $fn$
declare v_link app_private.premium_test_checkout_links%rowtype;
begin
 if p_user_id is null or p_subscription_id is null
   or p_subscription_id !~ '^sub_[a-zA-Z0-9_]{6,100}$'
   or p_effective_at is null or p_effective_at<=clock_timestamp()
   or p_effective_at>clock_timestamp()+interval '45 days' then
  raise exception 'Invalid Stripe TEST scheduled cancellation'
   using errcode='22023';
 end if;
 select * into v_link from app_private.premium_test_checkout_links
  where user_id=p_user_id and subscription_id=p_subscription_id
   and plan_kind='monthly' and closed_at is null for update;
 if v_link.checkout_id is null then
  raise exception 'Subscription not owned by verified member'
   using errcode='42501';
 end if;
 if not exists(
  select 1 from app_private.premium_test_grant_sources s
  join app_private.premium_access_grants g on g.source_reference=s.source_reference
  join app_private.premium_test_charge_proofs p on p.source_reference=g.source_reference
  where s.checkout_id=v_link.checkout_id and g.user_id=p_user_id
    and g.revoked_at is null and g.valid_from<=now() and now()<g.valid_until
 ) then
  raise exception 'No active verified TEST Premium payment'
   using errcode='42501';
 end if;
 update app_private.premium_test_checkout_links
  set cancel_at_period_end=true,
    cancellation_requested_at=coalesce(cancellation_requested_at,clock_timestamp()),
    cancellation_effective_at=p_effective_at
  where checkout_id=v_link.checkout_id;
 return true;
end;
$fn$;

-- Owned, identity-verified display; no raw Stripe ids, no payment credentials.
-- An active annual grant never auto-renews; a cancelled monthly grant remains
-- valid until paid expiry, so cancellation doesn't revoke paid access.
create or replace function public.member_my_premium_renewal()
returns jsonb language plpgsql stable security definer set search_path=''
as $fn$
declare
 v_user uuid:=(select auth.uid());
 v_count integer;
 v_monthly app_private.premium_test_checkout_links%rowtype;
 v_paid_end timestamptz;
 v_annual_end timestamptz;
begin
 if v_user is null then
  raise exception 'Authentication required' using errcode='28000';
 end if;
 if not exists(select 1 from auth.users u
   where u.id=v_user and u.email_confirmed_at is not null) then
  return jsonb_build_object('renewal','unverified','can_cancel',false,
    'monthly_paid_until',null,'annual_paid_until',null);
 end if;
 select max(g.valid_until) into v_annual_end
 from app_private.premium_access_grants g
 join app_private.premium_test_charge_proofs p
   on p.source_reference=g.source_reference
 where g.user_id=v_user and g.plan_kind='annual'
   and g.revoked_at is null and g.valid_from<=now() and now()<g.valid_until;
 select count(distinct l.checkout_id),max(g.valid_until)
   into v_count,v_paid_end
 from app_private.premium_test_checkout_links l
 join app_private.premium_test_grant_sources s on s.checkout_id=l.checkout_id
 join app_private.premium_access_grants g on g.source_reference=s.source_reference
 join app_private.premium_test_charge_proofs p on p.source_reference=g.source_reference
 where l.user_id=v_user and l.plan_kind='monthly'
   and l.closed_at is null and l.subscription_id is not null
   and l.customer_id is not null and g.revoked_at is null
   and g.valid_from<=now() and now()<g.valid_until;
 if v_count=0 then
  return jsonb_build_object(
   'renewal',case when v_annual_end is not null then 'annual_no_renewal'
    else 'none' end,
   'can_cancel',false,'monthly_paid_until',null,
   'annual_paid_until',v_annual_end);
 end if;
 if v_count>1 then
  return jsonb_build_object('renewal','multiple_monthly',
   'can_cancel',false,'monthly_paid_until',v_paid_end,
   'annual_paid_until',v_annual_end);
 end if;
 select l.* into v_monthly
 from app_private.premium_test_checkout_links l
 join app_private.premium_test_grant_sources s on s.checkout_id=l.checkout_id
 join app_private.premium_access_grants g on g.source_reference=s.source_reference
 join app_private.premium_test_charge_proofs p on p.source_reference=g.source_reference
 where l.user_id=v_user and l.plan_kind='monthly' and l.closed_at is null
  and l.subscription_id is not null and l.customer_id is not null
  and g.revoked_at is null and g.valid_from<=now() and now()<g.valid_until
 order by g.valid_until desc limit 1;
 return jsonb_build_object(
  'renewal',case when v_monthly.cancel_at_period_end
   then 'cancel_scheduled' else 'renews' end,
  'can_cancel',not v_monthly.cancel_at_period_end,
  'monthly_paid_until',v_paid_end,
  'annual_paid_until',v_annual_end);
end;
$fn$;

revoke all on function public.billing_get_member_test_renewal_target(uuid)
 from public,anon,authenticated,service_role;
revoke all on function public.billing_confirm_member_test_cancellation(
 uuid,text,timestamptz) from public,anon,authenticated,service_role;
revoke all on function public.member_my_premium_renewal()
 from public,anon,authenticated,service_role;
grant execute on function public.billing_get_member_test_renewal_target(uuid)
 to service_role;
grant execute on function public.billing_confirm_member_test_cancellation(
 uuid,text,timestamptz) to service_role;
grant execute on function public.member_my_premium_renewal()
 to authenticated;
commit;
