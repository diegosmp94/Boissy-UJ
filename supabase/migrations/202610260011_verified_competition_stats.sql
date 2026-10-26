-- Boissy UJ · Étape 72 · reliable club-confirmed sports metrics.
-- No imported fixtures, standings or user data are inserted.
begin;

-- PUBLIC, SECURITY INVOKER: the invoker remains subject to matches RLS
-- (which admits published matches only). Do not expose unapproved fixtures.
-- Season null is preserved rather than pretending a match belongs to 2026/27.
create or replace view public.team_competition_form_summary
with (security_invoker=true) as
select
 t.id as team_id,
 t.code,
 t.name,
 t.division,
 m.season_id,
 s.label as season_label,
 m.competition_kind,
 count(m.id)::integer as played,
 count(m.id) filter (where
    (m.is_home and m.home_score>m.away_score) or
    (not m.is_home and m.away_score>m.home_score))::integer as wins,
 count(m.id) filter (where m.home_score=m.away_score)::integer as draws,
 count(m.id) filter (where
    (m.is_home and m.home_score<m.away_score) or
    (not m.is_home and m.away_score<m.home_score))::integer as losses,
 coalesce(sum(case when m.is_home then m.home_score else m.away_score end),0)::integer as goals_for,
 coalesce(sum(case when m.is_home then m.away_score else m.home_score end),0)::integer as goals_against
from public.matches m
join public.club_teams t on t.id=m.team_id
left join public.club_seasons s on s.id=m.season_id
where m.published=true and m.match_status='played'
  and m.home_score is not null and m.away_score is not null
  and m.competition_kind in ('league','cup','friendly')
group by t.id,t.code,t.name,t.division,m.season_id,s.label,m.competition_kind;

revoke all on public.team_competition_form_summary from public,anon,authenticated;
grant select on public.team_competition_form_summary to anon,authenticated;

-- A published *whole-league ranking* requires a real, explicitly selected
-- season. It is manually checked by an AAL2 administrator: Boissy's fixtures
-- cannot be used to infer other clubs' rank, sanctions or remaining fixtures.
alter table public.team_league_standings
 drop constraint if exists published_standings_require_season;
alter table public.team_league_standings
 add constraint published_standings_require_season
 check (not published or season_id is not null);

create or replace function app_private.validate_published_league_scope()
returns trigger
language plpgsql security definer set search_path=''
as $fn$
declare v_code text;
begin
 if new.published then
  select code into v_code from public.club_teams where id=new.team_id;
  if v_code='c' then
   raise exception 'Friendly-only Seniors C has no championship table'
     using errcode='23514';
  end if;
 end if;
 return new;
end;
$fn$;

drop trigger if exists published_league_scope_guard on public.team_league_standings;
create trigger published_league_scope_guard
 before insert or update on public.team_league_standings
 for each row execute function app_private.validate_published_league_scope();

revoke all on function app_private.validate_published_league_scope()
 from public,anon,authenticated;
comment on view public.team_competition_form_summary is
 'Season- and competition-scoped club form from published played results only; never a full league standing or FFF certification.';
commit;
