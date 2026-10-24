-- Boissy-UJ / P1: READ-ONLY production security inventory (no PII).
-- Run only with a duly authorised read-only SQL session or SQL editor.
-- A green aggregate NEVER certifies row isolation of seven real accounts.
-- Database names, IDs and source content are not exported.
with exposed as (
 select c.oid,c.relname,c.relrowsecurity
 from pg_class c
 join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind in ('r','p')
), definer as (
 select p.oid,p.proname,p.prosecdef,
   has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
   has_function_privilege('authenticated',p.oid,'EXECUTE') as auth_execute,
   position('app_private.is_admin' in pg_get_functiondef(p.oid))>0 as mentions_admin_guard
 from pg_proc p
 join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef
), mfa_guard as (
 select exists(
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private' and p.proname='is_admin'
    and pg_get_functiondef(p.oid) like '%aal2%'
    and pg_get_functiondef(p.oid) like '%auth.uid%'
    and pg_get_functiondef(p.oid) like '%user_roles%'
 ) as mfa_and_role_present
)
select
 (select count(*) from exposed) as public_tables,
 (select count(*) from exposed where relrowsecurity) as tables_with_rls,
 (select count(*) from definer where anon_execute) as anonymous_definer_rpc_exposure,
 (select count(*) from definer where auth_execute) as authenticated_definer_rpc_warnings,
 (select count(*) from definer where proname like 'admin_%' and auth_execute) as auth_admin_rpc_count,
 (select count(*) from definer where proname like 'admin_%'
    and auth_execute and not mentions_admin_guard) as admin_functions_missing_guard_reference,
 (select mfa_and_role_present from mfa_guard) as static_mfa_guard_marker_present;
