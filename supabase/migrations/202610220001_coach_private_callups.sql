-- Étape 32 : listes minimales de rencontres et joueurs, par équipe réellement attribuée.
-- Aucun nom/contact des joueurs n'est rendu public ; aucun droit direct à app_private.
begin;
create or replace function public.staff_list_squad_fixtures(p_team_id uuid)
returns table(match_id uuid,opponent_name text,scheduled_at timestamptz,match_status text,published boolean)
language plpgsql stable security definer set search_path=''
as $fn$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_team_id is null
    or not (
      coalesce((select app_private.is_admin()),false)
      or exists(
        select 1 from public.staff_team_assignments a
        join public.user_roles r on r.user_id=a.coach_user_id and r.role='coach'
        where a.coach_user_id=v_actor and a.team_id=p_team_id and a.active=true
      )
    )
  then raise exception 'Team scope denied' using errcode='42501'; end if;
  return query
    select m.id,m.opponent_name,m.scheduled_at,m.match_status,m.published
    from public.matches m
    where m.team_id=p_team_id and m.match_status in ('scheduled','postponed')
    order by m.scheduled_at desc nulls last,m.id
    limit 100;
end;
$fn$;

create or replace function public.staff_list_match_roster(p_match_id uuid)
returns table(player_user_id uuid,display_name text,callup_response text)
language plpgsql stable security definer set search_path=''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_team_id uuid;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select m.team_id into v_team_id
  from public.matches m where m.id=p_match_id and m.match_status in ('scheduled','postponed');
  if v_team_id is null then raise exception 'Match not available for callups' using errcode='22023'; end if;
  if not (
    coalesce((select app_private.is_admin()),false)
    or exists (
      select 1 from public.staff_team_assignments a
      join public.user_roles r on r.user_id=a.coach_user_id and r.role='coach'
      where a.coach_user_id=v_actor and a.team_id=v_team_id and a.active=true
    )
  ) then raise exception 'Team scope denied' using errcode='42501'; end if;
  return query
    select tm.player_user_id,p.display_name,c.response
    from app_private.team_player_memberships tm
    join public.user_roles r on r.user_id=tm.player_user_id and r.role='player'
    join public.profiles p on p.id=tm.player_user_id
    left join app_private.match_callups c
      on c.player_user_id=tm.player_user_id and c.match_id=p_match_id
    where tm.team_id=v_team_id and tm.active=true
    order by p.display_name,tm.player_user_id
    limit 150;
end;
$fn$;
revoke all on function public.staff_list_squad_fixtures(uuid) from public,anon;
revoke all on function public.staff_list_match_roster(uuid) from public,anon;
grant execute on function public.staff_list_squad_fixtures(uuid) to authenticated;
grant execute on function public.staff_list_match_roster(uuid) to authenticated;
comment on function public.staff_list_match_roster(uuid) is
 'Minimal roster and callup states for a scoped coach or MFA AAL2 admin. No emails, licence numbers, contacts, or direct audit exposure.';
commit;
