-- Boissy UJ | Etape 82 : lecture serveur des droits Premium.
-- Aucun paiement, compte Premium ou activation n'est cree par la migration.
-- Tableau prive multi-attributions, prete pour l'integration Stripe TEST 83.
begin;

create table if not exists app_private.premium_access_grants (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 source_kind text not null default 'verified_stripe_test'
   check (source_kind='verified_stripe_test'),
 source_reference text not null unique
   check (
    (plan_kind='monthly' and source_reference ~ '^in_[a-zA-Z0-9_]{6,180}$')
    or (plan_kind='annual' and source_reference ~ '^cs_test_[a-zA-Z0-9_]{6,180}$')
   ),
 plan_kind text not null check (plan_kind in ('monthly','annual')),
 valid_from timestamptz not null,
 valid_until timestamptz not null,
 verified_at timestamptz not null default now(),
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 check (valid_until>valid_from),
 check (revoked_at is null or revoked_at>=verified_at)
);
create index if not exists premium_access_grants_user_dates
 on app_private.premium_access_grants(user_id,valid_until desc,valid_from desc);
alter table app_private.premium_access_grants enable row level security;
revoke all on app_private.premium_access_grants from public,anon,authenticated;
-- Restricted trusted server only; no browser policy or service credentials in JS.
grant select,insert,update on app_private.premium_access_grants to service_role;

-- Internal reusable authorization check for later Premium-only server RPCs.
-- The caller identity comes from auth.uid(), not an argument or browser role.
create or replace function app_private.member_has_active_premium()
returns boolean language sql stable security definer set search_path=''
as $fn$
 select (select auth.uid()) is not null
 and exists (
  select 1 from auth.users u where u.id=(select auth.uid())
   and u.email_confirmed_at is not null
 )
 and exists (
  select 1 from app_private.premium_access_grants g
  where g.user_id=(select auth.uid())
   and g.source_kind='verified_stripe_test'
   and g.verified_at<=now()
   and g.revoked_at is null
   and g.valid_from<=now() and now()<g.valid_until
 );
$fn$;
revoke all on function app_private.member_has_active_premium()
 from public,anon,authenticated;

-- Only a member may read their own subscription state. Never expose any
-- checkout/invoice/customer identifiers, any other member, or raw billing rows.
create or replace function public.member_my_premium_status()
returns jsonb
language plpgsql stable security definer set search_path=''
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
 select * into v_active from app_private.premium_access_grants g
  where g.user_id=v_user
   and g.source_kind='verified_stripe_test' and g.verified_at<=v_now
   and g.revoked_at is null and g.valid_from<=v_now and v_now<g.valid_until
  order by g.valid_until desc,g.created_at desc,g.id
  limit 1;
 if v_active.id is not null then
  return jsonb_build_object('state','active','active',true,
   'plan',v_active.plan_kind,'valid_until',v_active.valid_until);
 end if;
 select * into v_latest from app_private.premium_access_grants g
  where g.user_id=v_user and g.verified_at<=v_now
  order by g.verified_at desc,g.id desc limit 1;
 if v_latest.id is null then
  return jsonb_build_object('state','none','active',false,
   'plan',null,'valid_until',null);
 end if;
 return jsonb_build_object(
   'state',case when v_latest.revoked_at is not null then 'revoked'
      when v_latest.valid_from>v_now then 'upcoming' else 'expired' end,
   'active',false,
   'plan',v_latest.plan_kind,
   'valid_until',v_latest.valid_until
 );
end;
$fn$;
revoke all on function public.member_my_premium_status()
 from public,anon,authenticated;
grant execute on function public.member_my_premium_status() to authenticated;

comment on table app_private.premium_access_grants is
 'Server-verified Stripe TEST billing records only; no client grants, no live billing, multiple independent source references.';
comment on function public.member_my_premium_status() is
 'Returns only the authenticated member Premium state; expiry/revocation computed against server clock, no billing IDs.';
commit;
