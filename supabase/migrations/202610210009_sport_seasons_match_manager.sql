-- Boissy-UJ | Sports Manager: season registry, scoped match publishing and audit.
-- Source of truth: validated four club teams; no fixture/result seeded.
-- This migration does not enable public signups or Stripe.
begin;

create table if not exists public.club_seasons (
  id uuid primary key default gen_random_uuid(),
  label text not null unique check (label ~ '^[0-9]{4}/[0-9]{4}$'),
  state text not null default 'planned'
    check (state in ('planned','active','completed')),
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  constraint club_season_dates check (
    starts_on is null or ends_on is null or ends_on > starts_on
  )
);

alter table public.matches
  add column if not exists season_id uuid references public.club_seasons(id) on delete restrict;
create index if not exists matches_season_id_idx on public.matches(season_id);

alter table public.club_seasons enable row level security;
revoke all on public.club_seasons from anon, authenticated;
grant select on public.club_seasons to anon, authenticated;
create policy club_seasons_public_read on public.club_seasons
  for select to anon, authenticated using (true);

-- Change log resides in a schema outside the PostgREST public API.
create table if not exists app_private.match_change_log (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  team_id uuid not null references public.club_teams(id) on delete restrict,
  action text not null check (action in ('create_draft','create_publish',
    'edit_draft','edit_publish','unpublish')),
  before_snapshot jsonb,
  after_snapshot jsonb not null,
  changed_at timestamptz not null default now()
);
create index if not exists match_change_log_match_idx
  on app_private.match_change_log(match_id, changed_at desc);
create index if not exists match_change_log_actor_idx
  on app_private.match_change_log(actor_user_id);
create index if not exists match_change_log_team_idx
  on app_private.match_change_log(team_id);
alter table app_private.match_change_log enable row level security;
revoke all on app_private.match_change_log from public, anon, authenticated;

-- The privileged RPC never trusts any role or user supplied in parameters.
-- It checks auth.uid(), active coach scope or admin+MFA from app_private.is_admin().
create or replace function public.staff_save_match(
  p_match_id uuid,
  p_team_id uuid,
  p_season_id uuid,
  p_opponent_name text,
  p_scheduled_at timestamptz,
  p_venue text,
  p_is_home boolean,
  p_match_status text,
  p_home_score smallint,
  p_away_score smallint,
  p_source_kind text,
  p_source_reference text,
  p_publish boolean
) returns uuid
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_admin boolean := false;
  v_team_code text;
  v_can_edit boolean := false;
  v_match_id uuid;
  v_before public.matches%rowtype;
  v_after public.matches%rowtype;
  v_action text;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_admin := (select app_private.is_admin());
  select code into v_team_code from public.club_teams
    where id = p_team_id;
  if not found then
    raise exception 'Team unavailable' using errcode = '22023';
  end if;
  v_can_edit := exists (
    select 1 from public.user_roles r
    inner join public.staff_team_assignments a
      on a.coach_user_id = r.user_id
    where r.user_id = v_actor
      and r.role = 'coach'
      and a.team_id = p_team_id
      and a.active = true
  );
  if not (v_admin or v_can_edit) then
    raise exception 'Team scope denied' using errcode = '42501';
  end if;

  if p_opponent_name is null or length(btrim(p_opponent_name)) not between 2 and 120
    or p_scheduled_at is null
    or p_is_home is null or p_publish is null
    or p_match_status is null
    or p_match_status not in ('scheduled','played','postponed','cancelled')
    or p_source_kind is null or p_source_kind not in ('manual','fff')
    or (p_venue is not null and length(p_venue) > 160)
  then
    raise exception 'Invalid match fields' using errcode = '22023';
  end if;

  if (p_match_status = 'played' and
    (p_home_score is null or p_away_score is null
     or p_home_score not between 0 and 99
     or p_away_score not between 0 and 99))
    or (p_match_status <> 'played' and
      (p_home_score is not null or p_away_score is not null))
  then
    raise exception 'Score and status mismatch' using errcode = '22023';
  end if;

  if (p_source_kind = 'fff'
    and (v_team_code = 'c'
      or p_source_reference is null
      or length(btrim(p_source_reference)) not between 1 and 300))
    or (p_source_reference is not null and
      length(p_source_reference) > 300)
  then
    raise exception 'Invalid verified-source reference' using errcode = '22023';
  end if;

  if p_season_id is not null and not exists (
    select 1 from public.club_seasons where id = p_season_id
  ) then
    raise exception 'Season not found' using errcode = '22023';
  end if;

  if p_match_id is null then
    v_match_id := gen_random_uuid();
    insert into public.matches(
      id,team_id,season_id,opponent_name,scheduled_at,venue,is_home,
      home_score,away_score,match_status,source_kind,source_reference,published
    ) values (
      v_match_id,p_team_id,p_season_id,btrim(p_opponent_name),
      p_scheduled_at,nullif(btrim(p_venue),''),
      p_is_home,p_home_score,p_away_score,p_match_status,
      p_source_kind,nullif(btrim(p_source_reference),''),p_publish
    ) returning * into v_after;
    v_action := case when p_publish then 'create_publish' else 'create_draft' end;
  else
    select * into v_before
      from public.matches where id = p_match_id for update;
    if not found then
      raise exception 'Match unavailable' using errcode = '22023';
    end if;
    -- Coaches may not seize or move a fixture from another team.
    if not v_admin and v_before.team_id is distinct from p_team_id then
      raise exception 'Cannot transfer match between teams' using errcode = '42501';
    end if;
    update public.matches set
      team_id = p_team_id,
      season_id = p_season_id,
      opponent_name = btrim(p_opponent_name),
      scheduled_at = p_scheduled_at,
      venue = nullif(btrim(p_venue),''),
      is_home = p_is_home,
      home_score = p_home_score,
      away_score = p_away_score,
      match_status = p_match_status,
      source_kind = p_source_kind,
      source_reference = nullif(btrim(p_source_reference),''),
      published = p_publish,
      updated_at = now()
    where id = p_match_id returning * into v_after;
    v_match_id := p_match_id;
    v_action := case when not p_publish and v_before.published
      then 'unpublish'
      when p_publish then 'edit_publish' else 'edit_draft' end;
  end if;

  insert into app_private.match_change_log(
    match_id,actor_user_id,team_id,action,before_snapshot,after_snapshot
  ) values (
    v_match_id,v_actor,p_team_id,v_action,
    case when p_match_id is null then null else to_jsonb(v_before) end,
    to_jsonb(v_after)
  );
  return v_match_id;
end;
$function$;

revoke all on function public.staff_save_match(
  uuid,uuid,uuid,text,timestamptz,text,boolean,text,smallint,smallint,text,text,boolean
) from public,anon,authenticated;
grant execute on function public.staff_save_match(
  uuid,uuid,uuid,text,timestamptz,text,boolean,text,smallint,smallint,text,text,boolean
) to authenticated;

comment on function public.staff_save_match(
  uuid,uuid,uuid,text,timestamptz,text,boolean,text,smallint,smallint,text,text,boolean
) is 'Team-scoped match editor with mandatory authentication and audited writes; admin requires AAL2 MFA.';

commit;
