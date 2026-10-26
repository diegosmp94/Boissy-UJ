-- Boissy UJ / Étape 68 — cancel obsolete pending grants atomically.
-- A targeted role/team revocation does NOT remove other approved roles.
-- Only the existing AAL2 admin RPCs can write these private decisions.
begin;

CREATE OR REPLACE FUNCTION public.admin_revoke_member_role(p_user_id uuid, p_role text, p_team_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_exists boolean;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if not coalesce((select app_private.is_admin()),false) then
    raise exception 'Admin MFA AAL2 required' using errcode='42501';
  end if;
  if p_user_id is null or p_user_id=v_actor then
    raise exception 'Cannot revoke your own role' using errcode='42501';
  end if;
  if p_role is null or p_role not in ('player','coach','admin')
    or (p_team_id is not null and p_role<>'coach') then
    raise exception 'Invalid role or team' using errcode='22023';
  end if;

  -- A withdrawal invalidates still-pending requests for the same role.
  -- Request rows are locked before roles/affiliations, consistent with approval.
  -- If no active role/assignment exists below, the transaction rolls back.
  update public.role_requests set status='cancelled'
    where user_id=p_user_id and requested_role=p_role and status='pending'
      and (p_team_id is null or team_id=p_team_id);

  if p_role='coach' and p_team_id is not null then
    update public.staff_team_assignments set active=false
      where coach_user_id=p_user_id and team_id=p_team_id and active=true;
    if not found then
      raise exception 'Active team assignment not found' using errcode='22023';
    end if;
  else
    if p_role='admin' then
      -- Serialized check prevents two admins revoking one another simultaneously.
      perform pg_catalog.pg_advisory_xact_lock(20261021,314);
      if (select count(*) from public.user_roles where role='admin')<=1 then
        raise exception 'Last administrator cannot be revoked' using errcode='42501';
      end if;
    end if;
    delete from public.user_roles where user_id=p_user_id and role=p_role;
    if not found then
      raise exception 'Active role not found' using errcode='22023';
    end if;
    if p_role='coach' then
      update public.staff_team_assignments set active=false
        where coach_user_id=p_user_id and active=true;
    elsif p_role='player' then
      update app_private.team_player_memberships set active=false
        where player_user_id=p_user_id and active=true;
      update app_private.match_callups set
        response='cancelled',responded_at=null,updated_at=now()
        where player_user_id=p_user_id and response<>'cancelled';
    end if;
  end if;

  insert into app_private.role_change_audit
    (subject_user_id,actor_user_id,role,team_id,action)
    values(p_user_id,v_actor,p_role,p_team_id,
      case when p_team_id is not null then 'revoke_team' else 'revoke_role' end);
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_coach_team_assignment(p_team_id uuid, p_coach_user_id uuid, p_active boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_actor uuid := (select auth.uid());
 v_old_active boolean;
 v_found boolean;
begin
 if v_actor is null or not coalesce((select app_private.is_admin()),false) then
   raise exception 'Administrator MFA AAL2 required' using errcode='42501';
 end if;
 if p_team_id is null or p_coach_user_id is null or p_active is null then
   raise exception 'Invalid coach assignment' using errcode='22023';
 end if;
 if p_coach_user_id=v_actor then
   raise exception 'Self-assignment is forbidden' using errcode='42501';
 end if;
 if not exists(select 1 from public.club_teams where id=p_team_id) then
   raise exception 'Unknown club team' using errcode='22023';
 end if;
 -- Cancel pending grants for this coach/team BEFORE any role/assignment
 -- locks to respect request -> role -> assignment order of the approval RPC.
 if not p_active then
   update public.role_requests set status='cancelled'
     where user_id=p_coach_user_id and requested_role='coach'
       and team_id=p_team_id and status='pending';
 end if;
 -- Hold the target coach role stable through the assignment write.
 perform 1 from public.user_roles r
   where r.user_id=p_coach_user_id and r.role='coach'
   for share of r;
 if not found then
   raise exception 'Approved coach role is required' using errcode='42501';
 end if;

 -- Serialize simultaneous admin decisions for this specific member and team.
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(p_team_id::text||':'||p_coach_user_id::text,0)
 );
 select a.active into v_old_active from public.staff_team_assignments a
  where a.coach_user_id=p_coach_user_id and a.team_id=p_team_id for update;
 v_found:=found;
 if v_found and v_old_active=p_active then
   raise exception 'Assignment already has this state' using errcode='22023';
 end if;
 if not v_found and not p_active then
   raise exception 'No active assignment to revoke' using errcode='22023';
 end if;
 if p_active then
   insert into public.staff_team_assignments(coach_user_id,team_id,active,granted_by,granted_at)
   values(p_coach_user_id,p_team_id,true,v_actor,now())
   on conflict (coach_user_id,team_id) do update
    set active=true,granted_by=excluded.granted_by,granted_at=excluded.granted_at;
 else
   update public.staff_team_assignments set active=false
    where coach_user_id=p_coach_user_id and team_id=p_team_id;
 end if;
 insert into app_private.coach_team_assignment_audit(
  actor_user_id,coach_user_id,team_id,prior_active,next_active
 ) values(v_actor,p_coach_user_id,p_team_id,v_old_active,p_active);
 return true;
end;
$function$;

revoke all on function public.admin_revoke_member_role(uuid,text,uuid)
 from public,anon,authenticated;
grant execute on function public.admin_revoke_member_role(uuid,text,uuid)
 to authenticated;
revoke all on function public.admin_set_coach_team_assignment(uuid,uuid,boolean)
 from public,anon,authenticated;
grant execute on function public.admin_set_coach_team_assignment(uuid,uuid,boolean)
 to authenticated;
commit;
