-- Stage 54 — READ ONLY, no personal data or votes returned.
-- Does NOT replace an executed authenticated staging recipe.
with objects as (
 select
   to_regclass('app_private.award_vote_entitlements') as entitlements,
   to_regclass('app_private.award_ballots') as ballots,
   to_regprocedure('public.member_cast_award_vote(uuid,uuid)') as cast_fn,
   to_regprocedure('public.member_my_award_vote(uuid)') as own_fn,
   to_regprocedure('public.member_withdraw_award_vote(uuid)') as withdraw_fn
)
select jsonb_build_object(
 'entitlements_exists',entitlements is not null,
 'ballots_exists',ballots is not null,
 'entitlements_rls',
   coalesce((select c.relrowsecurity from pg_class c where c.oid=entitlements),false),
 'ballots_rls',
   coalesce((select c.relrowsecurity from pg_class c where c.oid=ballots),false),
 'direct_anonymous_entitlement_read',
   case when entitlements is null then false
     else has_table_privilege('anon',entitlements,'SELECT') end,
 'direct_authenticated_entitlement_write',
   case when entitlements is null then false
     else has_table_privilege('authenticated',entitlements,'INSERT,UPDATE,DELETE') end,
 'direct_authenticated_ballot_read',
   case when ballots is null then false
     else has_table_privilege('authenticated',ballots,'SELECT') end,
 'direct_authenticated_ballot_write',
   case when ballots is null then false
     else has_table_privilege('authenticated',ballots,'INSERT,UPDATE,DELETE') end,
 'cast_rpc_exists',cast_fn is not null,
 'my_vote_rpc_exists',own_fn is not null,
 'withdraw_rpc_exists',withdraw_fn is not null,
 'anonymous_rpc_executable',
   (case when cast_fn is null then false else has_function_privilege('anon',cast_fn,'EXECUTE') end)
   or (case when own_fn is null then false else has_function_privilege('anon',own_fn,'EXECUTE') end)
   or (case when withdraw_fn is null then false else has_function_privilege('anon',withdraw_fn,'EXECUTE') end)
) as awards_voting_contract
from objects;