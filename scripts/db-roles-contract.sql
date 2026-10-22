-- P1 HOMOLOGATION — READ-ONLY authorization contract.
-- Run as project SQL auditor in Supabase. No member data, tokens, row content, secrets,
-- or personally identifying information are selected.
with profile_acl as (
  select
    has_table_privilege('authenticated','public.profiles','UPDATE') as table_update,
    has_column_privilege('authenticated','public.profiles','display_name','UPDATE') as display_name_update,
    has_column_privilege('authenticated','public.profiles','id','UPDATE') as id_update,
    has_column_privilege('authenticated','public.profiles','created_at','UPDATE') as created_at_update,
    has_column_privilege('authenticated','public.profiles','updated_at','UPDATE') as updated_at_update
), published_tables as (
  select c.relname, c.relrowsecurity
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r'
), privileged_rpc as (
  select p.proname,p.oid,p.prosecdef,pg_get_functiondef(p.oid) as source
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
), admin_gate as (
  select pg_get_functiondef(p.oid) as source
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private' and p.proname='is_admin'
)
select jsonb_build_object(
  'profile_update_table_wide_denied', not (select table_update from profile_acl),
  'profile_display_name_edit_allowed', (select display_name_update from profile_acl),
  'profile_id_edit_denied', not (select id_update from profile_acl),
  'profile_created_at_edit_denied', not (select created_at_update from profile_acl),
  'profile_updated_at_edit_denied', not (select updated_at_update from profile_acl),
  'rls_missing_tables', (select coalesce(jsonb_agg(relname),'[]'::jsonb) from published_tables where not relrowsecurity),
  'anonymous_security_definer_rpc', (select coalesce(jsonb_agg(proname),'[]'::jsonb) from privileged_rpc where has_function_privilege('anon',oid,'EXECUTE')),
  'authenticated_privileged_rpc_count', (select count(*) from privileged_rpc where has_function_privilege('authenticated',oid,'EXECUTE')),
  'admin_gate_checks_aal2', coalesce((select source ilike '%aal2%' from admin_gate),false),
  'admin_gate_checks_role', coalesce((select source ilike '%role%admin%' from admin_gate),false)
) as p1_authorization_contract;
