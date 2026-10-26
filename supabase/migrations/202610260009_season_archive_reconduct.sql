-- Boissy UJ · Step 70 · season lifecycle without any fabricated fixtures.
-- Technical only: no season/user/match is automatically inserted by this migration.
begin;

alter table public.club_seasons
  drop constraint if exists club_seasons_state_check;
alter table public.club_seasons
  add constraint club_seasons_state_check
  check (state in ('planned','active','completed','archived'));

alter table app_private.season_change_log
  drop constraint if exists season_change_log_action_check;
alter table app_private.season_change_log
  add constraint season_change_log_action_check
  check (action in ('create','edit','complete','archive','reconduct'));

-- Every write involving an archived season is blocked, including attempted
-- reassignment of an archived match to a newer season. Lock the season row
-- so an archive and a concurrent match/standing write cannot cross.
create or replace function app_private.reject_archived_season_write()
returns trigger
language plpgsql security definer set search_path=''
as $fn$
declare
 v_old_id uuid;
 v_new_id uuid;
 v_state text;
begin
 if tg_op <> 'INSERT' then v_old_id := old.season_id; end if;
 if tg_op <> 'DELETE' then v_new_id := new.season_id; end if;
 if v_old_id is not null then
  select s.state into v_state
    from public.club_seasons s where s.id=v_old_id for share of s;
  if v_state='archived' then
    raise exception 'Archived season content is immutable' using errcode='42501';
  end if;
 end if;
 if v_new_id is not null and v_new_id is distinct from v_old_id then
  select s.state into v_state
    from public.club_seasons s where s.id=v_new_id for share of s;
  if v_state='archived' then
    raise exception 'Archived season does not accept content' using errcode='42501';
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$fn$;

drop trigger if exists matches_season_archive_guard on public.matches;
create trigger matches_season_archive_guard
before insert or update or delete on public.matches
for each row execute function app_private.reject_archived_season_write();

drop trigger if exists standings_season_archive_guard on public.team_league_standings;
create trigger standings_season_archive_guard
before insert or update or delete on public.team_league_standings
for each row execute function app_private.reject_archived_season_write();

revoke all on function app_private.reject_archived_season_write() from public,anon,authenticated;

create or replace function public.admin_save_season(
 p_season_id uuid,p_label text,p_state text,p_starts_on date,p_ends_on date
) returns uuid
language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid := (select auth.uid());
 v_existing public.club_seasons%rowtype;
 v_record public.club_seasons%rowtype;
 v_id uuid;
 v_year integer;
 v_action text;
begin
 if v_actor is null then
  raise exception 'Authentication required' using errcode='28000';
 end if;
 if not coalesce((select app_private.is_admin()),false) then
  raise exception 'Administrator MFA required' using errcode='42501';
 end if;
 if p_label is null or p_label !~ '^[0-9]{4}/[0-9]{4}$'
    or p_state is null
    or p_state not in ('planned','active','completed','archived')
    or p_starts_on is null or p_ends_on is null
    or p_ends_on<=p_starts_on then
  raise exception 'Invalid season fields' using errcode='22023';
 end if;
 v_year := split_part(p_label,'/',1)::integer;
 if split_part(p_label,'/',2)::integer<>v_year+1
    or v_year<2020 or v_year>2100
    or extract(year from p_starts_on)::integer<>v_year
    or extract(year from p_ends_on)::integer<>v_year+1 then
  raise exception 'Season label or year mismatch' using errcode='22023';
 end if;

 if p_season_id is null then
  -- All transitions start from a planned season, never an instant archive.
  if p_state<>'planned' then
   raise exception 'A new season must start as planned' using errcode='22023';
  end if;
  v_id:=gen_random_uuid();
  insert into public.club_seasons(id,label,state,starts_on,ends_on)
    values(v_id,p_label,p_state,p_starts_on,p_ends_on)
    returning * into v_record;
  v_action:='create';
 else
  select * into v_existing from public.club_seasons
    where id=p_season_id for update;
  if not found then
   raise exception 'Season unavailable' using errcode='22023';
  end if;
  if not (
    (v_existing.state='planned' and p_state in ('planned','active'))
    or (v_existing.state='active' and p_state in ('active','completed'))
    or (v_existing.state='completed' and p_state in ('completed','archived'))
    or (v_existing.state='archived' and p_state='archived')
  ) then
   raise exception 'Invalid season lifecycle transition' using errcode='42501';
  end if;
  if v_existing.state in ('completed','archived') and
    (p_label is distinct from v_existing.label or
     p_starts_on is distinct from v_existing.starts_on or
     p_ends_on is distinct from v_existing.ends_on) then
   raise exception 'Completed season identity and dates are immutable'
     using errcode='42501';
  end if;
  if v_existing.label is distinct from p_label
    and exists(select 1 from public.matches where season_id=p_season_id) then
   raise exception 'Cannot relabel season with fixtures' using errcode='42501';
  end if;
  -- No archive with outstanding scheduled or postponed fixtures.
  if p_state in ('completed','archived') and
     v_existing.state is distinct from p_state and
     exists(select 1 from public.matches
       where season_id=p_season_id
         and match_status in ('scheduled','postponed')) then
   raise exception 'Resolve remaining fixtures before closing the season'
     using errcode='42501';
  end if;
  update public.club_seasons
     set label=p_label,state=p_state,starts_on=p_starts_on,ends_on=p_ends_on
     where id=p_season_id returning * into v_record;
  v_id:=p_season_id;
  v_action:=case
    when v_existing.state<>'archived' and p_state='archived' then 'archive'
    when v_existing.state<>'completed' and p_state='completed' then 'complete'
    else 'edit' end;
 end if;
 insert into app_private.season_change_log(
  season_id,actor_user_id,action,before_snapshot,after_snapshot
 ) values (
  v_id,v_actor,v_action,
  case when p_season_id is null then null else to_jsonb(v_existing) end,
  to_jsonb(v_record)
 );
 return v_id;
end;
$fn$;

-- One-off, explicitly requested next season: carry only *dates and label*.
-- Never duplicate participants, match schedules, scores, standings or news.
create or replace function public.admin_reconduct_season(p_source_season_id uuid)
returns uuid
language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid := (select auth.uid());
 v_source public.club_seasons%rowtype;
 v_year integer;
 v_new_id uuid;
 v_new_record public.club_seasons%rowtype;
 v_new_label text;
 v_start date;
 v_end date;
begin
 if v_actor is null then
  raise exception 'Authentication required' using errcode='28000';
 end if;
 if not coalesce((select app_private.is_admin()),false) then
  raise exception 'Administrator MFA required' using errcode='42501';
 end if;
 if p_source_season_id is null then
  raise exception 'Source season required' using errcode='22023';
 end if;
 select * into v_source from public.club_seasons
   where id=p_source_season_id for update;
 if not found or v_source.state not in ('completed','archived')
    or v_source.starts_on is null or v_source.ends_on is null then
  raise exception 'Reconduct only a completed or archived dated season'
    using errcode='42501';
 end if;
 v_year:=split_part(v_source.label,'/',1)::integer+1;
 if v_year>2100 then
  raise exception 'Next season year exceeds permitted range'
    using errcode='22023';
 end if;
 v_new_label:=v_year::text||'/'||(v_year+1)::text;
 v_start:=(v_source.starts_on+interval '1 year')::date;
 v_end:=(v_source.ends_on+interval '1 year')::date;
 if extract(year from v_start)::integer<>v_year or
    extract(year from v_end)::integer<>v_year+1 or
    v_end<=v_start then
  raise exception 'Next season dates require manual review' using errcode='22023';
 end if;
 if exists(select 1 from public.club_seasons where label=v_new_label) then
  raise exception 'Next season already exists' using errcode='23505';
 end if;
 insert into public.club_seasons(label,state,starts_on,ends_on)
   values(v_new_label,'planned',v_start,v_end)
   returning * into v_new_record;
 v_new_id:=v_new_record.id;
 insert into app_private.season_change_log(
  season_id,actor_user_id,action,before_snapshot,after_snapshot
 ) values(
  v_new_id,v_actor,'reconduct',
  pg_catalog.jsonb_build_object('source_season_id',v_source.id,'source_label',v_source.label),
  to_jsonb(v_new_record)
 );
 return v_new_id;
end;
$fn$;

revoke all on function public.admin_save_season(uuid,text,text,date,date)
 from public,anon,authenticated;
grant execute on function public.admin_save_season(uuid,text,text,date,date)
 to authenticated;

revoke all on function public.admin_reconduct_season(uuid)
 from public,anon,authenticated;
grant execute on function public.admin_reconduct_season(uuid)
 to authenticated;

comment on function public.admin_reconduct_season(uuid) is
 'MFA AAL2 admin only: prepare one next planned season with shifted dates only; no fixtures or rosters cloned.';
commit;
