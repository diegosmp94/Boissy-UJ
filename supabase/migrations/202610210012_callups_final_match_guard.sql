-- Boissy-UJ | Guard against callups for played/cancelled matches.
-- Overrides only the previously deployed authenticated scoped RPC.
begin;
create or replace function public.staff_set_callup(
  p_match_id uuid,p_player_user_id uuid,p_invite boolean
) returns boolean
language plpgsql security definer set search_path=''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_team uuid;
  v_admin boolean;
  v_scope boolean;
  v_old_response text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if p_match_id is null or p_player_user_id is null or p_invite is null then
    raise exception 'Missing callup information' using errcode='22023';
  end if;

  select m.team_id into v_team from public.matches m
    where m.id=p_match_id
      and m.match_status not in ('played','cancelled');
  if not found then
    raise exception 'Match not found' using errcode='22023';
  end if;

  v_admin := coalesce((select app_private.is_admin()),false);
  v_scope := exists(
    select 1 from public.user_roles r
    join public.staff_team_assignments a on a.coach_user_id=r.user_id
    where r.user_id=v_actor and r.role='coach'
      and a.team_id=v_team and a.active=true
  );
  if not (v_admin or v_scope) then
    raise exception 'Team scope denied' using errcode='42501';
  end if;

  if not exists(
    select 1 from app_private.team_player_memberships tm
    join public.user_roles r on r.user_id=tm.player_user_id
    where tm.player_user_id=p_player_user_id and tm.team_id=v_team
      and tm.active=true and r.role='player'
  ) then
    raise exception 'Player is not an active team member' using errcode='42501';
  end if;

  select response into v_old_response from app_private.match_callups
    where match_id=p_match_id and player_user_id=p_player_user_id for update;

  if p_invite then
    insert into app_private.match_callups(match_id,player_user_id,response,responded_at,updated_at)
      values (p_match_id,p_player_user_id,'invited',null,now())
      on conflict(match_id,player_user_id)
      do update set response='invited',responded_at=null,updated_at=now();
  else
    if v_old_response is null then
      raise exception 'Callup not found' using errcode='22023';
    end if;
    update app_private.match_callups
      set response='cancelled',responded_at=null,updated_at=now()
      where match_id=p_match_id and player_user_id=p_player_user_id;
  end if;

  insert into app_private.callup_action_audit
    (match_id,player_user_id,actor_user_id,action)
    values(p_match_id,p_player_user_id,v_actor,
      case when not p_invite then 'cancel'
           when v_old_response is null then 'invite'
           else 'reinvite' end);
  return true;
end;
$fn$;

revoke all on function public.staff_set_callup(uuid,uuid,boolean)
  from public,anon,authenticated;
grant execute on function public.staff_set_callup(uuid,uuid,boolean)
  to authenticated;
commit;
