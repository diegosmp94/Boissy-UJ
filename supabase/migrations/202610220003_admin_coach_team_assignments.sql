-- P1 / Étape 34 : Affectations Entraîneur ↔ Équipe sous MFA administrateur.
-- Les rôles sont attribués uniquement via le workflow de demandes existant.
begin;

create table if not exists app_private.coach_team_assignment_audit (
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references auth.users(id) on delete restrict,
 coach_user_id uuid not null references auth.users(id) on delete restrict,
 team_id uuid not null references public.club_teams(id) on delete restrict,
 prior_active boolean,
 next_active boolean not null,
 created_at timestamptz not null default now(),
 constraint coach_assignment_no_self check (actor_user_id <> coach_user_id)
);
alter table app_private.coach_team_assignment_audit enable row level security;
revoke all on app_private.coach_team_assignment_audit from public, anon, authenticated;

create or replace function public.admin_list_team_coaches(p_team_id uuid)
returns table(coach_user_id uuid,display_name text,active boolean)
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or not coalesce((select app_private.is_admin()),false) then
   raise exception 'Administrator MFA AAL2 required' using errcode='42501';
 end if;
 if p_team_id is null or not exists(select 1 from public.club_teams where id=p_team_id) then
   raise exception 'Unknown club team' using errcode='22023';
 end if;
 return query
  select r.user_id,p.display_name,coalesce(a.active,false)
  from public.user_roles r
  join public.profiles p on p.id=r.user_id
  left join public.staff_team_assignments a
   on a.coach_user_id=r.user_id and a.team_id=p_team_id
  where r.role='coach'
  order by p.display_name,r.user_id limit 250;
end;
$fn$;

create or replace function public.admin_set_coach_team_assignment(
 p_team_id uuid, p_coach_user_id uuid, p_active boolean
) returns boolean
language plpgsql security definer set search_path=''
as $fn$
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
 if not exists(select 1 from public.user_roles where user_id=p_coach_user_id and role='coach') then
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
$fn$;

revoke all on function public.admin_list_team_coaches(uuid) from public,anon;
revoke all on function public.admin_set_coach_team_assignment(uuid,uuid,boolean) from public,anon;
grant execute on function public.admin_list_team_coaches(uuid) to authenticated;
grant execute on function public.admin_set_coach_team_assignment(uuid,uuid,boolean) to authenticated;
comment on function public.admin_set_coach_team_assignment(uuid,uuid,boolean)
 is 'MFA admin only; audited coach team scope changes, never grants coach role, forbids self-assignment.';
commit;
