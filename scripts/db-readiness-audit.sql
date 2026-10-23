-- Boissy-UJ / étape 50 : état sécurité et publication en lecture seule.
-- Aucune donnée personnelle, aucun jeton ni modification de la base.
-- Un diagnostic de schéma ne remplace pas les tests multi-comptes.
with public_tables as (
 select c.relname,c.relrowsecurity
 from pg_catalog.pg_class c
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r'
), definer_rpcs as (
 select p.oid,p.proname
 from pg_catalog.pg_proc p
 join pg_catalog.pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef
), results as (
 select jsonb_build_object(
  'public_tables_without_rls',
   (select coalesce(jsonb_agg(relname),'[]'::jsonb) from public_tables where not relrowsecurity),
  'anonymous_security_definer_rpcs',
   (select coalesce(jsonb_agg(proname),'[]'::jsonb) from definer_rpcs
     where has_function_privilege('anon',oid,'EXECUTE')),
  'admin_aal2_guard_present',
   coalesce((select pg_get_functiondef(p.oid) ilike '%aal2%'
     from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
     where n.nspname='app_private' and p.proname='is_admin' limit 1),false),
  'five_teams_registered',(select count(*)=5 from public.club_teams),
  'club_match_record_count',(select count(*) from public.matches),
  'club_news_record_count',(select count(*) from public.news_posts),
  'coach_admin_rpc_present',to_regprocedure('public.admin_list_team_coaches(uuid)') is not null,
  'free_events_admin_rpc_present',to_regprocedure('public.admin_list_free_events()') is not null,
  'news_reaction_table_present',to_regclass('public.news_reactions') is not null,
  'media_metadata_table_present',to_regclass('public.news_media_assets') is not null,
  'media_admin_rpc_present',to_regprocedure('public.admin_list_news_media()') is not null,
  'media_file_check_rpc_present',to_regprocedure('public.admin_check_news_media_file(text,text)') is not null,
  'approved_media_bucket_present',(select exists(
    select 1 from storage.buckets where id='boissy-uj-approved'))
 ) as contract
)
select contract as diagnostic_de_schema_non_homologation from results;
