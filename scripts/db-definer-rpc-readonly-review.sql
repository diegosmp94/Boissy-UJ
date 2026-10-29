-- Read-only snapshot for the public SECURITY DEFINER RPC attack surface.
-- PostgreSQL catalog metadata ONLY: no personal rows, JWTs or secret values.
-- Static markers are screening signals, NOT evidence of correct authorization.
with all_public_definers as (
  select p.oid, p.proname,
    pg_get_function_identity_arguments(p.oid) as arguments,
    has_function_privilege('anon',p.oid,'EXECUTE') as anonymous_exec,
    has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_exec,
    coalesce(array_to_string(p.proconfig,','),'') ilike '%search_path=%' as fixed_search_path,
    lower(pg_get_functiondef(p.oid)) as definition
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
),
review as (
  select proname, arguments, fixed_search_path,
    case when proname like 'admin_%' then 'admin'
         when proname like 'staff_%' then 'staff'
         when proname like 'player_%' then 'player'
         when proname like 'member_%' then 'member'
         else 'other' end as family,
    strpos(definition,'auth.uid') > 0 as uid_marker,
    strpos(definition,'app_private.is_admin') > 0 as admin_marker
  from all_public_definers where authenticated_exec
)
select jsonb_build_object(
  'authenticated_definer_count',(select count(*) from review),
  'anonymous_definer_count',(select count(*) from all_public_definers where anonymous_exec),
  'rpc_families',(select coalesce(jsonb_object_agg(family,n),'{}'::jsonb)
                  from (select family,count(*) as n from review group by family) counts),
  'admin_missing_central_gate_marker',(select coalesce(jsonb_agg(proname),'[]'::jsonb)
                                      from review where family='admin' and not admin_marker),
  'without_uid_or_admin_marker',(select coalesce(jsonb_agg(proname),'[]'::jsonb)
                                 from review where not uid_marker and not admin_marker),
  'without_fixed_search_path',(select coalesce(jsonb_agg(proname),'[]'::jsonb)
                               from review where not fixed_search_path),
  'non_admin_review_queue',(select coalesce(jsonb_agg(
      jsonb_build_object('rpc',proname||'('||arguments||')','family',family,
        'uid_marker',uid_marker,'admin_marker',admin_marker,
        'fixed_search_path',fixed_search_path) order by proname
    ),'[]'::jsonb) from review where family <> 'admin')
) as rpc_security_snapshot;
