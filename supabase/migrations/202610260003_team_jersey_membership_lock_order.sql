-- Canonical per-team lock order: advisory team lock -> membership row lock.
-- Patches two existing functions; no table mutation, identity seeding or publication.
begin;
create or replace function public.staff_set_affiliated_player_position(
 p_team_id uuid,p_player_user_id uuid,p_position_group text,
 p_shirt_number integer,p_expected_updated_at timestamptz default null
) returns boolean
language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid:=(select auth.uid());
 v_old app_private.team_player_positions%rowtype;
 v_exists boolean;
begin
 if v_actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_team_id is null or p_player_user_id is null
   or p_position_group is null
   or p_position_group not in ('goalkeeper','defender','midfielder','forward')
   or p_shirt_number is null or p_shirt_number not between 1 and 99 then
   raise exception 'Invalid team position or shirt number' using errcode='22023';
 end if;
 if not (
  coalesce((select app_private.is_admin()),false)
  or exists (
   select 1 from public.staff_team_assignments a
   join public.user_roles r on r.user_id=a.coach_user_id and r.role='coach'
   where a.coach_user_id=v_actor and a.team_id=p_team_id and a.active=true
  )
 ) then raise exception 'Team scope denied' using errcode='42501'; end if;
 -- Serialize team mutations BEFORE locking membership rows; the exit trigger
 -- uses this exact advisory key when it releases a jersey.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_team_id::text,17409));
 -- Lock active membership to reject revoked or non-players; no affiliation creation.
 perform 1 from app_private.team_player_memberships m
 join public.user_roles r on r.user_id=m.player_user_id and r.role='player'
 where m.team_id=p_team_id and m.player_user_id=p_player_user_id and m.active=true
 for share of m;
 if not found then raise exception 'Player is not actively affiliated to this team' using errcode='42501'; end if;


 select * into v_old from app_private.team_player_positions s
 where s.team_id=p_team_id and s.player_user_id=p_player_user_id for update;
 v_exists:=found;
 if v_exists and (p_expected_updated_at is null
    or p_expected_updated_at is distinct from v_old.updated_at) then
   raise exception 'Assignment changed: reload' using errcode='40001';
 end if;
 if not v_exists and p_expected_updated_at is not null then
   raise exception 'Assignment changed: reload' using errcode='40001';
 end if;
 if v_exists and v_old.position_group=p_position_group and v_old.shirt_number=p_shirt_number then
   return true;
 end if;
 -- Recheck grants and hold the coach's active team grant stable until commit.
 -- This closes the gap between the initial check and queued jersey writes.
 if not coalesce((select app_private.is_admin()),false) then
  perform 1 from public.staff_team_assignments a
  join public.user_roles r on r.user_id=a.coach_user_id and r.role='coach'
  where a.coach_user_id=v_actor and a.team_id=p_team_id and a.active=true
  for share of a,r;
  if not found then
   raise exception 'Team scope revoked before write' using errcode='42501';
  end if;
 end if;
 -- Unique(team,number) rejects simultaneous duplicate numbers (23505).
 insert into app_private.team_player_positions(
  team_id,player_user_id,position_group,shirt_number,updated_at,updated_by
 ) values(p_team_id,p_player_user_id,p_position_group,p_shirt_number,
          pg_catalog.clock_timestamp(),v_actor)
 on conflict(team_id,player_user_id) do update
 set position_group=excluded.position_group,shirt_number=excluded.shirt_number,
  updated_at=greatest(excluded.updated_at,app_private.team_player_positions.updated_at+interval '1 microsecond'),
  updated_by=excluded.updated_by;

 insert into app_private.team_player_position_audit
   (actor_user_id,team_id,player_user_id,before_position,after_position,before_number,after_number)
 values(v_actor,p_team_id,p_player_user_id,
   case when v_exists then v_old.position_group else null end,p_position_group,
   case when v_exists then v_old.shirt_number else null end,p_shirt_number);
 return true;
end;
$fn$;
create or replace function public.admin_set_player_team_membership(
  p_team_id uuid,p_player_user_id uuid,p_active boolean
) returns boolean
language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid := (select auth.uid());
 v_old_active boolean;
begin
 if v_actor is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Administrator MFA required' using errcode='42501'; end if;
 if p_team_id is null or p_player_user_id is null or p_active is null
 then raise exception 'Invalid assignment' using errcode='22023'; end if;
 if v_actor=p_player_user_id then
   raise exception 'Self-assignment prohibited' using errcode='42501';
 end if;
 if not exists(select 1 from public.club_teams t where t.id=p_team_id) then
   raise exception 'Unknown team' using errcode='22023';
 end if;
 if not exists(
    select 1 from public.user_roles r
    where r.user_id=p_player_user_id and r.role='player'
 ) then raise exception 'An approved player role is required' using errcode='42501'; end if;
 -- Take the same team-level lock BEFORE touching the membership row.
 -- The BEFORE UPDATE exit trigger is then reentrant on this lock; avoids
 -- deadlocks with staff_set_affiliated_player_position.
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(p_team_id::text,17409)
 );
 select tm.active into v_old_active
 from app_private.team_player_memberships tm
 where tm.team_id=p_team_id and tm.player_user_id=p_player_user_id
 for update;
 if found and v_old_active=p_active then
   raise exception 'Membership already has this state' using errcode='22023';
 end if;
 if not found and not p_active then
   raise exception 'No active membership to revoke' using errcode='22023';
 end if;
 insert into app_private.team_player_memberships(team_id,player_user_id,active)
 values(p_team_id,p_player_user_id,p_active)
 on conflict(team_id,player_user_id) do update set active=excluded.active;
 insert into app_private.team_membership_admin_audit(
  actor_user_id,player_user_id,team_id,prior_active,next_active
 ) values(v_actor,p_player_user_id,p_team_id,v_old_active,p_active);
 return true;
end;
$fn$;
revoke all on function public.staff_set_affiliated_player_position(uuid,uuid,text,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.staff_set_affiliated_player_position(uuid,uuid,text,integer,timestamptz) to authenticated;
revoke all on function public.admin_set_player_team_membership(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_set_player_team_membership(uuid,uuid,boolean) to authenticated;
commit;
