-- Step 93: READ-ONLY recovery metadata. Source and isolated restore target.
-- NO person ids, emails, names, object paths, tokens, bucket names or secrets.
-- This checks structured metadata and counts, NOT successful binary restoration.
with catalog_tables as (
 select n.nspname,c.relname,c.relrowsecurity,c.oid
 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','app_private') and c.relkind='r'
),
columns as (
 select t.nspname,t.relname,a.attnum,a.attname,
  pg_catalog.format_type(a.atttypid,a.atttypmod) as type_name,
  a.attnotnull
 from catalog_tables t join pg_catalog.pg_attribute a on a.attrelid=t.oid
 where a.attnum>0 and not a.attisdropped
),
sensitive_rpcs as (
 select n.nspname,p.proname,p.oid,
  p.prosecdef,has_function_privilege('anon',p.oid,'EXECUTE') as anon_executable
 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','app_private') and p.prosecdef
),
private_policies as (
 select schemaname,tablename,policyname,cmd,roles::text,coalesce(qual,'') as qual,
 coalesce(with_check,'') as with_check
 from pg_catalog.pg_policies where schemaname in ('public','app_private')
),
private_counts as (
 select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.profiles) as profiles,
  (select count(*) from storage.objects) as storage_objects,
  (select count(*) from public.news_media_assets) as news_media_assets,
  (select count(*) from app_private.award_ballots) as awards_ballots,
  (select count(*) from app_private.privacy_rights_requests) as privacy_requests,
  (select count(*) from app_private.privacy_request_steps) as privacy_steps
)
select jsonb_build_object(
 'version',1,
 'public_and_private_table_count',(select count(*) from catalog_tables),
 'catalog_schema_sha256',(select encode(extensions.digest(
  coalesce(string_agg(nspname||'.'||relname||'.'||attname||':'||type_name||
   ':'||attnotnull,'|' order by nspname,relname,attnum),'')::bytea,'sha256'),'hex')
  from columns),
 'policy_sha256',(select encode(extensions.digest(
  coalesce(string_agg(schemaname||'.'||tablename||'.'||policyname||':'||
   cmd||':'||roles||':'||qual||':'||with_check,'|' order by
   schemaname,tablename,policyname),'')::bytea,'sha256'),'hex')
  from private_policies),
 'no_rls_count',(select count(*) from catalog_tables where not relrowsecurity),
 'privileged_anon_rpc_count',(select count(*) from sensitive_rpcs where anon_executable),
 'auth_users',counts.auth_users,
 'profiles',counts.profiles,
 'storage_objects_metadata',counts.storage_objects,
 'news_media_assets',counts.news_media_assets,
 'awards_ballots',counts.awards_ballots,
 'privacy_requests',counts.privacy_requests,
 'privacy_steps',counts.privacy_steps
) as step93_recovery_metadata from private_counts counts;
