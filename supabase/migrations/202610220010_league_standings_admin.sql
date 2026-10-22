-- Boissy UJ: manually curated league table, unique per club team (latest matchday).
-- A public snapshot is NOT a FFF-official table. Admin AAL2 is the only writer.
begin;

create table if not exists public.team_league_standings (
  team_id uuid primary key references public.club_teams(id) on delete restrict,
  season_id uuid references public.club_seasons(id) on delete restrict,
  matchday integer not null default 0 check (matchday between 0 and 80),
  entries jsonb not null default '[]'::jsonb
    check (jsonb_typeof(entries)='array' and jsonb_array_length(entries)<=24),
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint league_published_needs_entries check (not published or jsonb_array_length(entries)>=2)
);
alter table public.team_league_standings enable row level security;
revoke all on public.team_league_standings from public,anon,authenticated;
grant select (team_id,season_id,matchday,entries,published,updated_at)
 on public.team_league_standings to anon,authenticated;
drop policy if exists team_league_standings_public on public.team_league_standings;
create policy team_league_standings_public on public.team_league_standings
 for select to anon,authenticated using (published=true);

create table if not exists app_private.league_standings_audit (
 id bigint generated always as identity primary key,
 team_id uuid not null references public.club_teams(id) on delete restrict,
 actor_user_id uuid references auth.users(id) on delete set null,
 before_snapshot jsonb,
 after_snapshot jsonb not null,
 changed_at timestamptz not null default now()
);
create index if not exists league_standings_audit_team_idx
 on app_private.league_standings_audit(team_id,changed_at desc);
alter table app_private.league_standings_audit enable row level security;
revoke all on app_private.league_standings_audit from public,anon,authenticated;

create or replace function public.admin_list_league_standings()
returns setof public.team_league_standings
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or not coalesce((select app_private.is_admin()),false) then
   raise exception 'Administrator MFA AAL2 required' using errcode='42501';
 end if;
 return query select s.* from public.team_league_standings s order by s.updated_at desc,s.team_id;
end;
$fn$;

create or replace function public.admin_save_league_standings(
 p_team_id uuid,p_season_id uuid,p_matchday integer,p_entries jsonb,p_publish boolean
) returns uuid
language plpgsql security definer set search_path=''
as $fn$
declare
 v_actor uuid := (select auth.uid());
 v_old public.team_league_standings%rowtype;
 v_next public.team_league_standings%rowtype;
 v_item jsonb;
 v_name text;
 v_seen text[] := array[]::text[];
 v_position integer;
 v_count integer;
 v_n integer;
 v_w integer;
 v_d integer;
 v_l integer;
 v_gf integer;
 v_ga integer;
 v_adj integer;
begin
 if v_actor is null or not coalesce((select app_private.is_admin()),false) then
   raise exception 'Administrator MFA AAL2 required' using errcode='42501';
 end if;
 if p_team_id is null or not exists(select 1 from public.club_teams where id=p_team_id)
   or (p_season_id is not null and not exists(select 1 from public.club_seasons where id=p_season_id))
   or p_matchday is null or p_matchday not between 0 and 80
   or p_publish is null or p_entries is null or jsonb_typeof(p_entries)<>'array' then
   raise exception 'Invalid league table fields' using errcode='22023';
 end if;
 v_count := jsonb_array_length(p_entries);
 if v_count>24 or (p_publish and v_count<2) then
   raise exception 'Standings size invalid' using errcode='22023';
 end if;
 for v_item in select value from jsonb_array_elements(p_entries) loop
   if jsonb_typeof(v_item)<>'object'
     or (select count(*) from jsonb_object_keys(v_item))<>9
     or not (v_item ?& array['position','name','played','wins','draws','losses','goals_for','goals_against','points_adjustment'])
     or jsonb_typeof(v_item->'name')<>'string'
     or exists(select 1 from jsonb_each(v_item) z where z.key<>'name' and jsonb_typeof(z.value)<>'number')
     or exists(select 1 from jsonb_each(v_item) z where z.key<>'name' and z.value::text !~ '^-?[0-9]+$')
   then raise exception 'Invalid standings row schema' using errcode='22023'; end if;
   v_name := btrim(v_item->>'name');
   if length(v_name) not between 2 and 100 or v_name ~ '[[:cntrl:]]'
       or lower(v_name)=any(v_seen) then
     raise exception 'Invalid or duplicate club name' using errcode='22023';
   end if;
   v_seen:=array_append(v_seen,lower(v_name));
   v_position:=(v_item->>'position')::integer;
   v_n:=(v_item->>'played')::integer;
   v_w:=(v_item->>'wins')::integer;
   v_d:=(v_item->>'draws')::integer;
   v_l:=(v_item->>'losses')::integer;
   v_gf:=(v_item->>'goals_for')::integer;
   v_ga:=(v_item->>'goals_against')::integer;
   v_adj:=(v_item->>'points_adjustment')::integer;
   if v_position<1 or v_position>v_count
     or v_n not between 0 and 80 or v_w not between 0 and 80
     or v_d not between 0 and 80 or v_l not between 0 and 80
     or v_gf not between 0 and 500 or v_ga not between 0 and 500
     or v_adj not between -40 and 40 or v_n<>v_w+v_d+v_l then
     raise exception 'Invalid standings arithmetic or rank' using errcode='22023';
   end if;
   if (select count(*) from jsonb_array_elements(p_entries) x
      where x.value->>'position'=v_item->>'position')<>1 then
     raise exception 'Duplicated standings position' using errcode='22023';
   end if;
 end loop;

 select * into v_old from public.team_league_standings
  where team_id=p_team_id for update;
 insert into public.team_league_standings(team_id,season_id,matchday,entries,published,updated_at,updated_by)
 values(p_team_id,p_season_id,p_matchday,p_entries,p_publish,now(),v_actor)
 on conflict (team_id) do update
  set season_id=excluded.season_id,matchday=excluded.matchday,
      entries=excluded.entries,published=excluded.published,
      updated_at=excluded.updated_at,updated_by=excluded.updated_by
 returning * into v_next;

 insert into app_private.league_standings_audit(team_id,actor_user_id,before_snapshot,after_snapshot)
 values(p_team_id,v_actor,
   case when v_old.team_id is null then null else to_jsonb(v_old) end,
   to_jsonb(v_next));
 return p_team_id;
end;
$fn$;
revoke all on function public.admin_list_league_standings() from public,anon,authenticated;
revoke all on function public.admin_save_league_standings(uuid,uuid,integer,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.admin_list_league_standings() to authenticated;
grant execute on function public.admin_save_league_standings(uuid,uuid,integer,jsonb,boolean) to authenticated;
comment on table public.team_league_standings is
 'Latest admin-entered league rankings by Boissy UJ team, published only after MFA approval; not official FFF.';
commit;
