-- Boissy-UJ | Season Management V1 - protected create/update and audit.
-- Requires club_seasons and app_private.is_admin() with MFA AAL2.
-- No seed data, public registration, payment or automatic season creation.
begin;

create table if not exists app_private.season_change_log (
  id bigint generated always as identity primary key,
  season_id uuid not null references public.club_seasons(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('create','edit')),
  before_snapshot jsonb,
  after_snapshot jsonb not null,
  changed_at timestamptz not null default now()
);

create index if not exists season_change_log_season_idx
  on app_private.season_change_log(season_id,changed_at desc);
create index if not exists season_change_log_actor_idx
  on app_private.season_change_log(actor_user_id);
alter table app_private.season_change_log enable row level security;
revoke all on app_private.season_change_log from public, anon, authenticated;

-- One globally active association season at a time.
create unique index if not exists club_seasons_one_active_idx
  on public.club_seasons(state) where state = 'active';

create or replace function public.admin_save_season(
  p_season_id uuid,
  p_label text,
  p_state text,
  p_starts_on date,
  p_ends_on date
) returns uuid
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_existing public.club_seasons%rowtype;
  v_record public.club_seasons%rowtype;
  v_id uuid;
  v_year integer;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if not coalesce((select app_private.is_admin()),false) then
    raise exception 'Administrator MFA required' using errcode='42501';
  end if;

  if p_label is null
    or p_label !~ '^[0-9]{4}/[0-9]{4}$'
    or p_state is null
    or p_state not in ('planned','active','completed')
    or p_starts_on is null
    or p_ends_on is null
    or p_ends_on <= p_starts_on
  then
    raise exception 'Invalid season fields' using errcode='22023';
  end if;

  v_year := split_part(p_label,'/',1)::integer;
  if split_part(p_label,'/',2)::integer <> v_year + 1
    or v_year < 2020 or v_year > 2100
    or extract(year from p_starts_on)::integer <> v_year
    or extract(year from p_ends_on)::integer <> v_year + 1
  then
    raise exception 'Season label or year mismatch' using errcode='22023';
  end if;

  if p_season_id is null then
    v_id := gen_random_uuid();
    insert into public.club_seasons(id,label,state,starts_on,ends_on)
      values(v_id,p_label,p_state,p_starts_on,p_ends_on)
      returning * into v_record;
  else
    select * into v_existing from public.club_seasons
      where id=p_season_id for update;
    if not found then
      raise exception 'Season unavailable' using errcode='22023';
    end if;
    -- Do not relabel a season already attached to existing fixtures.
    if v_existing.label is distinct from p_label
      and exists (select 1 from public.matches where season_id=p_season_id)
    then
      raise exception 'Cannot relabel season with fixtures' using errcode='42501';
    end if;
    update public.club_seasons
      set label=p_label,state=p_state,starts_on=p_starts_on,ends_on=p_ends_on
      where id=p_season_id
      returning * into v_record;
    v_id := p_season_id;
  end if;

  insert into app_private.season_change_log(
    season_id,actor_user_id,action,before_snapshot,after_snapshot
  ) values(
    v_id,v_actor,
    case when p_season_id is null then 'create' else 'edit' end,
    case when p_season_id is null then null else to_jsonb(v_existing) end,
    to_jsonb(v_record)
  );
  return v_id;
end;
$function$;

revoke all on function public.admin_save_season(
  uuid,text,text,date,date
) from public,anon,authenticated;
grant execute on function public.admin_save_season(
  uuid,text,text,date,date
) to authenticated;

comment on function public.admin_save_season(uuid,text,text,date,date)
is 'Admin-only season setup: auth.uid + MFA AAL2, date consistency, audit and no client table writes.';

commit;
