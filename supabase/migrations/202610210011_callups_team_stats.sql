-- Boissy-UJ | Convocations privées et bilan collectif depuis les vrais résultats.
-- Aucune donnée personnelle nominative / aucune convocation insérée.
begin;

-- Vue publique SECURITY INVOKER : applique la RLS sur matches.
-- Seules les rencontres publiées et terminées entrent dans le bilan.
create or replace view public.team_form_summary
with (security_invoker=true) as
select t.id as team_id, t.code, t.name, t.division,
       count(m.id)::integer as played,
       count(m.id) filter (where
         (m.is_home and m.home_score > m.away_score) or
         (not m.is_home and m.away_score > m.home_score))::integer as wins,
       count(m.id) filter (where m.home_score = m.away_score)::integer as draws,
       count(m.id) filter (where
         (m.is_home and m.home_score < m.away_score) or
         (not m.is_home and m.away_score < m.home_score))::integer as losses,
       coalesce(sum(case when m.is_home then m.home_score else m.away_score end),0)::integer as goals_for,
       coalesce(sum(case when m.is_home then m.away_score else m.home_score end),0)::integer as goals_against
from public.club_teams t
left join public.matches m on m.team_id=t.id
  and m.match_status='played' and m.published=true
group by t.id,t.code,t.name,t.division;

revoke all on public.team_form_summary from public,anon,authenticated;
grant select on public.team_form_summary to anon,authenticated;

-- Identité minimisée : UUID Auth, équipe, présence active. Aucun nom,
-- téléphone, date de naissance ni information médicale enregistrés.
create table if not exists app_private.team_player_memberships (
  team_id uuid not null references public.club_teams(id) on delete restrict,
  player_user_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key(team_id,player_user_id)
);

create table if not exists app_private.match_callups (
  match_id uuid not null references public.matches(id) on delete restrict,
  player_user_id uuid not null references auth.users(id) on delete cascade,
  response text not null default 'invited'
    check(response in ('invited','confirmed','declined','unsure','cancelled')),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(match_id,player_user_id)
);

create table if not exists app_private.callup_action_audit (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches(id) on delete restrict,
  player_user_id uuid not null references auth.users(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check(action in ('invite','reinvite','cancel','confirm','decline','unsure')),
  created_at timestamptz not null default now()
);

create index if not exists team_memberships_player_idx on
  app_private.team_player_memberships(player_user_id) where active=true;
create index if not exists callups_player_idx on
  app_private.match_callups(player_user_id,updated_at desc);
create index if not exists callup_audit_match_idx on
  app_private.callup_action_audit(match_id,created_at desc);
create index if not exists callup_audit_actor_idx on
  app_private.callup_action_audit(actor_user_id);

alter table app_private.team_player_memberships enable row level security;
alter table app_private.match_callups enable row level security;
alter table app_private.callup_action_audit enable row level security;
revoke all on app_private.team_player_memberships,
  app_private.match_callups,app_private.callup_action_audit
  from public,anon,authenticated;

-- Création/annulation : coach autorisé sur l'équipe ou admin MFA AAL2.
-- Un joueur invité doit être déjà affecté à l'équipe et avoir le rôle player.
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

  select m.team_id into v_team from public.matches m where m.id=p_match_id;
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

-- Réponse : seul le destinataire de la convocation peut confirmer/refuser.
create or replace function public.player_respond_callup(
  p_match_id uuid,p_response text
) returns boolean
language plpgsql security definer set search_path=''
as $fn$
declare
  v_actor uuid := (select auth.uid());
  v_prior text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if p_response is null or p_response not in ('confirmed','declined','unsure') then
    raise exception 'Invalid response' using errcode='22023';
  end if;
  select c.response into v_prior from app_private.match_callups c
    join public.matches m on m.id=c.match_id
    where c.match_id=p_match_id and c.player_user_id=v_actor
      and m.match_status not in ('cancelled','played')
    for update of c;
  if not found or v_prior='cancelled' then
    raise exception 'No active invitation' using errcode='42501';
  end if;
  update app_private.match_callups
    set response=p_response,responded_at=now(),updated_at=now()
    where match_id=p_match_id and player_user_id=v_actor;
  insert into app_private.callup_action_audit
    (match_id,player_user_id,actor_user_id,action)
    values(p_match_id,v_actor,v_actor,
      case p_response when 'confirmed' then 'confirm'
           when 'declined' then 'decline' else 'unsure' end);
  return true;
end;
$fn$;

-- Retourne UNIQUEMENT les propres invitations du compte connecté.
create or replace function public.player_my_callups()
returns table(match_id uuid,team_name text,opponent_name text,
              scheduled_at timestamptz,response text)
language sql stable security definer set search_path=''
as $fn$
  select c.match_id,t.name,m.opponent_name,m.scheduled_at,c.response
  from app_private.match_callups c
  join public.matches m on m.id=c.match_id
  join public.club_teams t on t.id=m.team_id
  where c.player_user_id=(select auth.uid())
    and c.response <> 'cancelled'
  order by m.scheduled_at asc;
$fn$;

revoke all on function public.staff_set_callup(uuid,uuid,boolean)
  from public,anon,authenticated;
grant execute on function public.staff_set_callup(uuid,uuid,boolean)
  to authenticated;

revoke all on function public.player_respond_callup(uuid,text)
  from public,anon,authenticated;
grant execute on function public.player_respond_callup(uuid,text)
  to authenticated;

revoke all on function public.player_my_callups()
  from public,anon,authenticated;
grant execute on function public.player_my_callups()
  to authenticated;

comment on table app_private.match_callups is
  'Private invite response records. No names or contact details. Access through scoped authenticated RPC only.';
commit;
