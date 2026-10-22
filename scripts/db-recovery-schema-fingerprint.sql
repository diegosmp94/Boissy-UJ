-- READ ONLY: execute separately on the source and on the isolated recovery target.
-- Keep output in the private approval file, not in the public repository.
-- These checks validate structure, not storage objects or external auth configuration.
with tables as (
 select c.relname,c.relrowsecurity
 from pg_catalog.pg_class c
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r'
), policies as (
 select count(*) as total from pg_catalog.pg_policy p
 join pg_catalog.pg_class c on c.oid=p.polrelid
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public'
), functions as (
 select count(*) as total from pg_catalog.pg_proc p
 join pg_catalog.pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','app_private')
)
select jsonb_build_object(
  'public_table_count',(select count(*) from tables),
  'public_tables_without_rls',(select coalesce(jsonb_agg(relname),'[]'::jsonb) from tables where not relrowsecurity),
  'public_rls_policy_count',(select total from policies),
  'club_function_count',(select total from functions),
  'installed_extensions',(select jsonb_agg(extname order by extname) from pg_catalog.pg_extension)
) as recovery_schema_fingerprint;
