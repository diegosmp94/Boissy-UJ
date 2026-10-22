-- Étape 33 : affiliations administratives Joueur ↔ Équipe, jamais octroi de rôle.
-- Toutes les lectures et écritures sont gardées par app_private.is_admin() (AAL2).
begin;
create table if not exists app_private.team_membership_admin_audit (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null,
  player_user_id uuid not null,
  team_id uuid not null,
  prior_active boolean,
  next_active boolean not null,
  changed_at timestamptz not null default now(),
  constraint team_membership_admin_audit_no_self check(actor_user_id<>player_user_id)
);
alter table app_private.team_membership_admin_audit enable row level security;
revoke all on app_private.team_membership_admin_audit from public, anon, authenticated;

create or replace function public.admin_list_team_players(p_team_id uuid)
returns table(player_user_id uuid,display_name text,active boolean)
language plpgsql stable security definer set search_path=''
as $fn$
begin
  if (select auth.uid()) is null or not coalesce((select app_private.is_admin()),false)
  then raise exception 'Administrator MFA required' using errcode='42501'; end if;
  if p_team_id is null or not exists(select 1 from public.club_teams where id=p_team_id)
  then raise exception 'Unknown team' using errcode='22023'; end if;
  return query
    select r.user_id,p.display_name,coalesce(tm.active,false)
    from public.user_roles r
    join public.profiles p on p.id=r.user_id
    left join app_private.team_player_memberships tm
      on tm.player_user_id=r.user_id and tm.team_id=p_team_id
    where r.role='player'
    order by p.display_name,r.user_id limit 250;
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
revoke all on function public.admin_list_team_players(uuid) from public,anon;
revoke all on function public.admin_set_player_team_membership(uuid,uuid,boolean) from public,anon;
grant execute on function public.admin_list_team_players(uuid) to authenticated;
grant execute on function public.admin_set_player_team_membership(uuid,uuid,boolean) to authenticated;
comment on function public.admin_list_team_players(uuid) is
  'MFA admin only. Minimal profile names of approved players, for team assignment.';
comment on function public.admin_set_player_team_membership(uuid,uuid,boolean) is
  'MFA admin only. Does not grant player roles; audits team membership changes and blocks self-assignment.';
commit;
