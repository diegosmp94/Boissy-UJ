-- Boissy-UJ : module sportif public v1
-- Donnees publiques SEULEMENT; aucune licence, coordonnee ni information
-- personnelle de joueur dans ce module.
begin;

create table if not exists public.club_teams (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('a','b','c','veterans')),
  name text not null check (char_length(btrim(name)) between 2 and 70),
  division text not null check (char_length(division) between 2 and 70),
  source_kind text not null check (source_kind in ('fff','manual')),
  sort_order smallint not null unique check (sort_order between 1 and 4),
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.club_teams(id) on delete restrict,
  opponent_name text not null check (char_length(btrim(opponent_name)) between 2 and 120),
  scheduled_at timestamptz,
  venue text check (venue is null or char_length(venue) <= 160),
  is_home boolean not null default true,
  home_score smallint check (home_score between 0 and 99),
  away_score smallint check (away_score between 0 and 99),
  match_status text not null default 'scheduled'
    check (match_status in ('scheduled','played','postponed','cancelled')),
  source_kind text not null default 'manual'
    check (source_kind in ('fff','manual')),
  source_reference text check (source_reference is null or char_length(source_reference) <= 300),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint played_scores_required check (
    (match_status = 'played' and home_score is not null and away_score is not null)
    or (match_status <> 'played' and home_score is null and away_score is null)
  ),
  constraint published_match_requires_date check (
    published = false or scheduled_at is not null
  ),
  constraint fff_source_needs_reference check (
    source_kind = 'manual' or nullif(btrim(source_reference), '') is not null
  )
);

create index if not exists matches_published_date_idx on public.matches (scheduled_at)
where published = true;
create index if not exists matches_published_team_idx on public.matches (team_id, scheduled_at)
where published = true;

insert into public.club_teams(code,name,division,source_kind,sort_order) values
  ('a','Seniors A','Départemental 3','fff',1),
  ('b','Seniors B','Départemental 4','fff',2),
  ('c','Seniors C','Matchs amicaux','manual',3),
  ('veterans','Vétérans','Départemental 3','fff',4)
on conflict (code) do update
set name = excluded.name,
    division = excluded.division,
    source_kind = excluded.source_kind,
    sort_order = excluded.sort_order;

alter table public.club_teams enable row level security;
alter table public.matches enable row level security;

revoke all on public.club_teams, public.matches from anon, authenticated;
grant select on public.club_teams, public.matches to anon, authenticated;

create policy club_teams_public_view on public.club_teams
for select to anon, authenticated using (true);

create policy matches_published_public_view on public.matches
for select to anon, authenticated using (published = true);

-- Aucun INSERT/UPDATE/DELETE pour les visiteurs ni les comptes ordinaires.
-- Le futur Sports Manager effectuera les ecritures par une couche serveur
-- verifiant les roles et enregistrant un audit.
comment on table public.club_teams is
  'Equipes Boissy-UJ publiques : trois equipes FFF et Seniors C amicaux.';
comment on table public.matches is
  'Calendrier et resultats publics, divulgation controlee par published. Aucun score fictif.';
commit;
