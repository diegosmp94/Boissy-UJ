-- Boissy-UJ step 67 — read-only inventory of every authenticated SECURITY DEFINER RPC.
-- No private rows, auth accounts, function bodies or tokens are returned.
-- Metadata markers are necessary but never sufficient for multi-account homologation.
with endpoints as (
 select p.oid,p.proname as rpc,
   pg_get_function_identity_arguments(p.oid) as arguments,
   p.proconfig,
   lower(pg_get_functiondef(p.oid)) as definition,
   has_function_privilege('anon',p.oid,'EXECUTE') as anonymous_execute,
   has_function_privilege('authenticated',p.oid,'EXECUTE') as member_execute
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef
   and has_function_privilege('authenticated',p.oid,'EXECUTE')
), markers as (
 select rpc,arguments,anonymous_execute,member_execute,
   coalesce(array_to_string(proconfig,',') like '%search_path=%',false) as fixed_search_path,
   definition ~ 'auth[.]uid[[:space:]]*[(][)]' as checks_identity,
   definition like '%app_private.is_admin%' as checks_admin_aal2_helper,
   definition like '%public.user_roles%' as references_server_roles,
   definition like '%staff_team_assignments%' as references_team_scope,
   definition like '%for share of%' as has_shared_row_lock,
   definition like '%for update%' as has_exclusive_row_lock,
   definition like '%pg_advisory_xact_lock%' as has_transaction_lock
 from endpoints
)
select rpc,arguments,anonymous_execute,member_execute,fixed_search_path,
 checks_identity,checks_admin_aal2_helper,references_server_roles,
 references_team_scope,has_shared_row_lock,has_exclusive_row_lock,has_transaction_lock,
 case
   when anonymous_execute then 'REVIEW_ANONYMOUS_EXPOSURE'
   when not fixed_search_path or not checks_identity then 'REVIEW_FUNCTION_SETUP'
   when rpc like 'admin_%' and not checks_admin_aal2_helper then 'REVIEW_ADMIN_MFA'
   when rpc like 'staff_%' and not (checks_admin_aal2_helper and references_server_roles and references_team_scope) then 'REVIEW_TEAM_AUTHORIZATION'
   when rpc in ('player_my_callups','player_respond_callup') and not references_server_roles then 'REVIEW_PLAYER_ROLE'
   when rpc='member_request_role' and not references_server_roles then 'REVIEW_REQUEST_SCOPE'
   else 'REVIEWED_STRUCTURE_ONLY'
 end as static_review
from markers order by rpc,arguments;
