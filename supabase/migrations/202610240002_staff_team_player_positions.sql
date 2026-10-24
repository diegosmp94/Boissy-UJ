-- Boissy UJ · Positions privées des joueurs affiliés, par équipe.
-- Aucun nom ni photo recopié dans le catalogue public ; coach/admin ne publient rien.
-- À appliquer après recette isolée et revue des droits.
begin;

create table if not exists app_private.team_player_positions(
 team_id uuid not null,
 player_user_id uuid not null,
 position_group text not null check(position_group in ('goalkeeper','defender','midfielder','forward')),
 shirt_number smallint not null check(shirt_number between 1 and 99),
 updated_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id) on delete restrict,
 primary key(team_id,player_user_id),
 foreign key(team_id,player_user_id) references app_private.team_player_memberships(team_id,player_user_id) on delete cascade
);
create unique index if not exists team_player_position_unique_number
 on app_private.team_player_positions(team_id,shirt_number);
alter table app_private.team_player_positions enable row level security;
revoke all on app_private.team_player_positions from public,anon,authenticated;

create table if not exists app_private.team_player_position_audit(
 id bigint generated always as identity primary key,
 actor_user_id uuid not null references auth.users(id) on delete restrict,
 team_id uuid not null references public.club_teams(id) on delete restrict,
 player_user_id uuid not null references auth.users(id) on delete restrict,
 before_position text,
 after_position text not null,
 before_number smallint,
 after_number smallint not null,
 changed_at timestamptz not null default now()
);
alter table app_private.team_player_position_audit enable row level security;
revoke all on app_private.team_player_position_audit from public,anon,authenticated;

-- Exposes ONLY active player memberships of the requested, server-authorized team.
-- Never leaks user lists to anon, supporters, players or unrelated coaches.
create or replace function public.staff_list_affiliated_players(p_team_id uuid)
returns table(
 player_user_id uuid, display_name text, position_group text,
 shirt_number smallint, updated_at timestamptz
)
language plpgsql stable security definer set search_path=''
as $fn$
declare v_actor uuid:=(select auth.uid());
begin
 if v_actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_team_id is null or not exists(select 1 from public.club_teams where id=p_team_id) then
  raise exception 'Unknown team' using errcode='22023';
 end if;
 if not (
  coalesce((select app_private.is_admin()),false)
  or exists (
   select 1 from public.staff_team_assignments a
   join public.user_roles r on r.user_id=a.coach_user_id and r.role='coach'
   where a.coach_user_id=v_actor and a.team_id=p_team_id and a.active=true
  )
 ) then raise exception 'Team scope denied' using errcode='42501'; end if;
 return query
 select m.player_user_id,p.display_name,s.position_group,s.shirt_number,s.updated_at
 from app_private.team_player_memberships m
 join public.user_roles r on r.user_id=m.player_user_id and r.role='player'
 join public.profiles p on p.id=m.player_user_id
 left join app_private.team_player_positions s
   on s.team_id=m.team_id and s.player_user_id=m.player_user_id
 where m.team_id=p_team_id and m.active=true
 order by p.display_name,m.player_user_id
 limit 200;
end;
$fn$;

-- Private assignment only: the public portrait/name approval process is independent.
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
 -- Lock active membership to reject revoked or non-players; no affiliation creation.
 perform 1 from app_private.team_player_memberships m
 join public.user_roles r on r.user_id=m.player_user_id and r.role='player'
 where m.team_id=p_team_id and m.player_user_id=p_player_user_id and m.active=true
 for share of m;
 if not found then raise exception 'Player is not actively affiliated to this team' using errcode='42501'; end if;

 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_team_id::text,17409));
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

revoke execute on function public.staff_list_affiliated_players(uuid) from public,anon,authenticated;
revoke execute on function public.staff_set_affiliated_player_position(uuid,uuid,text,integer,timestamptz)
 from public,anon,authenticated;
grant execute on function public.staff_list_affiliated_players(uuid) to authenticated;
grant execute on function public.staff_set_affiliated_player_position(uuid,uuid,text,integer,timestamptz) to authenticated;
comment on function public.staff_set_affiliated_player_position(uuid,uuid,text,integer,timestamptz) is
 'Only MFA AAL2 admin or approved coach with active scoped team assignment. Reads active affiliated players only; saves private position and unique jersey number, audited. Never publishes player identity.';
commit;
