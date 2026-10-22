-- Homologation security snapshot (READ ONLY): execute in Supabase SQL editor.
-- This report never exports user records, private audit rows, JWTs or keys.
-- A positive source-code pattern is NOT a proof that every parameter path is secure.
with funcs as (
  select p.oid, p.proname, p.prosecdef,
    has_function_privilege('anon',p.oid,'EXECUTE') anon_exec,
    has_function_privilege('authenticated',p.oid,'EXECUTE') user_exec,
    pg_get_functiondef(p.oid) as definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
),
tables as (
  select c.relname,c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r'
)
select jsonb_build_object(
  'public_tables', (select count(*) from tables),
  'public_tables_without_rls', (select coalesce(jsonb_agg(relname), '[]'::jsonb) from tables where not relrowsecurity),
  'anon_executable_definer', (select coalesce(jsonb_agg(proname), '[]'::jsonb) from funcs where prosecdef and anon_exec),
  'authenticated_definer_count', (select count(*) from funcs where prosecdef and user_exec),
  'authenticated_definer_without_uid_check', (select coalesce(jsonb_agg(proname), '[]'::jsonb) from funcs where prosecdef and user_exec and definition not ilike '%auth.uid()%'),
  'admin_definer_without_central_gate', (select coalesce(jsonb_agg(proname), '[]'::jsonb) from funcs where prosecdef and user_exec and proname like 'admin_%' and definition not ilike '%app_private.is_admin()%')
) as security_snapshot;
