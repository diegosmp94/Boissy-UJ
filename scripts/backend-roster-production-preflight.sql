-- Boissy UJ: zero-write backend readiness checks for a production SQL Editor.
-- Does not read personal rows, create identities, mutate state or exercise test writes.
-- Status BLOCKED means the full multi-account acceptance is not executable on prod.
with checks as (
 select '01_five_teams' as check_id,
  (select count(*)=5 from public.club_teams) as passed,
  'Expected five configured club teams' as detail
 union all select '02_jersey_unique_index',
  exists(select 1 from pg_indexes
   where schemaname='app_private' and tablename='team_player_positions'
    and indexname='team_player_position_unique_number'
    and indexdef ilike '%unique%'),
  'Per-team unique jersey index is present'
 union all select '03_release_trigger_active',
  exists(select 1 from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='app_private'
     and c.relname='team_player_memberships'
     and t.tgname='team_membership_release_jersey'
     and t.tgenabled='O' and not t.tgisinternal),
  'Leaving the team activates the private jersey release trigger'
 union all select '04_release_audit_rls',
  exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='app_private'
   and c.relname='team_player_position_release_audit' and c.relrowsecurity),
  'Release audit is protected with RLS'
 union all select '05_private_positions_rls',
  exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='app_private'
   and c.relname='team_player_positions' and c.relrowsecurity),
  'Private jersey assignments have RLS enabled'
 union all select '06_no_anonymous_rpc',
  not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public'
    and p.proname in ('admin_set_player_team_membership','staff_set_affiliated_player_position',
     'staff_list_affiliated_players','admin_save_team_public_person')
    and has_function_privilege('anon',p.oid,'execute')),
  'Neither anonymous nor PUBLIC may call these sensitive RPCs'
 union all select '07_authenticated_rpc_available',
  (select count(*)=4 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
    and p.proname in ('admin_set_player_team_membership','staff_set_affiliated_player_position',
     'staff_list_affiliated_players','admin_save_team_public_person')
    and has_function_privilege('authenticated',p.oid,'execute')),
  'Four authenticated RPC endpoints retain their deliberate grants'
 union all select '08_definer_empty_search_path',
  (select count(*)=4 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public'
    and p.proname in ('admin_set_player_team_membership','staff_set_affiliated_player_position',
     'staff_list_affiliated_players','admin_save_team_public_person')
    and p.prosecdef
    and exists(select 1 from unnest(p.proconfig) cfg where cfg in ('search_path=', 'search_path=""'))),
  'All four audited definer RPCs use an empty SQL search path'
 union all select '09_jersey_team_lock_before_membership',
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='staff_set_affiliated_player_position'
    and strpos(lower(pg_get_functiondef(p.oid)),'pg_advisory_xact_lock')>0
    and strpos(lower(pg_get_functiondef(p.oid)),'from app_private.team_player_memberships m')
       >strpos(lower(pg_get_functiondef(p.oid)),'pg_advisory_xact_lock')),
  'Staff writer takes the canonical team lock before membership lock'
 union all select '10_admin_team_lock_before_membership',
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='admin_set_player_team_membership'
    and strpos(lower(pg_get_functiondef(p.oid)),'pg_advisory_xact_lock')>0
    and strpos(lower(pg_get_functiondef(p.oid)),'from app_private.team_player_memberships tm')
      >strpos(lower(pg_get_functiondef(p.oid)),'pg_advisory_xact_lock')),
  'Admin membership writer uses the same team-first order'
 union all select '11_coach_scope_revalidated',
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='staff_set_affiliated_player_position'
     and strpos(pg_get_functiondef(p.oid),'Team scope revoked before write')>0
     and strpos(lower(pg_get_functiondef(p.oid)),'for share of a, r')>0),
  'Coach role/team assignment is rechecked and locked before private write'
 union all select '12_no_inactive_jersey',
  not exists(select 1 from app_private.team_player_positions p
   left join app_private.team_player_memberships m
    on m.team_id=p.team_id and m.player_user_id=p.player_user_id
   where m.active is distinct from true),
  'Inactive or missing player memberships do not hold a jersey number'
)
select check_id,case when passed then 'PASS' else 'FAIL' end as status,detail
from checks
union all
select '13_live_permission_matrix','BLOCKED',
 'Requires seven authorized non-production accounts, two distinct team fixtures and MFA'
union all
select '14_live_concurrent_writes','BLOCKED',
 'Requires an isolated test database to prove concurrent revoke/assign and unique number behavior'
order by check_id;
