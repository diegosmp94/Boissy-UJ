-- P1 database recovery verification (read-only metadata + aggregate counts).
-- Run ONCE on production before a controlled export and ONCE on an isolated restore.
-- Compare the two JSON results. NEVER publish raw backups, JWTs, identifiers or emails.
-- Only role-privileged operators should run this query (the auth.users count is aggregate).
with public_tables as (
  select c.oid,c.relname,c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r'
),
public_columns as (
  select t.relname,a.attname,a.attnum,a.attnotnull,
         pg_catalog.format_type(a.atttypid,a.atttypmod) as column_type
  from public_tables t join pg_attribute a on a.attrelid=t.oid
  where a.attnum>0 and not a.attisdropped
),
policies as (
  select schemaname,tablename,policyname,cmd,roles::text,coalesce(qual,'') as qual,
         coalesce(with_check,'') as with_check
  from pg_policies where schemaname='public'
),
privileged_rpcs as (
  select p.proname,has_function_privilege('anon',p.oid,'EXECUTE') as anon_exec
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
)
select jsonb_build_object(
 'public_table_count',(select count(*) from public_tables),
 'public_schema_fingerprint',(
  select md5(string_agg(relname||'.'||attname||':'||column_type||':'||attnotnull,
     '|' order by relname,attnum)) from public_columns
 ),
 'rls_disabled_tables',(
  select coalesce(jsonb_agg(relname order by relname),'[]'::jsonb)
  from public_tables where not relrowsecurity
 ),
 'public_rls_policy_fingerprint',(
  select md5(coalesce(string_agg(
   tablename||'.'||policyname||':'||cmd||':'||roles||':'||qual||':'||with_check,
   '|' order by tablename,policyname),'')) from policies
 ),
 'privileged_anon_rpcs',(
  select coalesce(jsonb_agg(proname order by proname),'[]'::jsonb)
  from privileged_rpcs where anon_exec
 ),
 'user_roles_authenticated_can_write',(
  has_table_privilege('authenticated','public.user_roles','INSERT')
  or has_table_privilege('authenticated','public.user_roles','UPDATE')
  or has_table_privilege('authenticated','public.user_roles','DELETE')
 ),
 'user_roles_anon_can_write',(
  has_table_privilege('anon','public.user_roles','INSERT')
  or has_table_privilege('anon','public.user_roles','UPDATE')
  or has_table_privilege('anon','public.user_roles','DELETE')
 ),
 'role_requests_authenticated_can_write_directly',(
  has_table_privilege('authenticated','public.role_requests','INSERT')
  or has_table_privilege('authenticated','public.role_requests','UPDATE')
  or has_table_privilege('authenticated','public.role_requests','DELETE')
 ),
  'profiles_can_update_identity_or_timestamps',(
  has_column_privilege('authenticated','public.profiles','id','UPDATE')
  or has_column_privilege('authenticated','public.profiles','created_at','UPDATE')
  or has_column_privilege('authenticated','public.profiles','updated_at','UPDATE')
 ),
 'profiles_can_insert_timestamps',(
  has_column_privilege('authenticated','public.profiles','created_at','INSERT')
  or has_column_privilege('authenticated','public.profiles','updated_at','INSERT')
 ),
 'profiles_can_update_display_name',
   has_column_privilege('authenticated','public.profiles','display_name','UPDATE'),
 'profiles_can_insert_id_and_display_name',(
   has_column_privilege('authenticated','public.profiles','id','INSERT')
   and has_column_privilege('authenticated','public.profiles','display_name','INSERT')
 ),
 'auth_user_count',(select count(*) from auth.users),
 'profile_count',(select count(*) from public.profiles),
 'role_count',(select count(*) from public.user_roles),
 'club_team_count',(select count(*) from public.club_teams),
 'pending_or_reviewed_role_requests_count',(select count(*) from public.role_requests)
) as recovery_verification;
