-- Boissy-UJ | Awards publics : catégories, nominés et résultats vérifiés.
-- Les votes, abonnements et données des membres restent hors périmètre.
-- Aucune catégorie, personne, saison ni résultat fictif inséré.
begin;

create table if not exists public.club_awards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug)<=100),
  title text not null check (char_length(btrim(title)) between 4 and 120),
  description text not null default '' check (char_length(description)<=1600),
  team_code text not null check (team_code in ('a','b','c')),
  season_label text check (season_label is null
    or season_label ~ '^[0-9]{4}/[0-9]{4}$'),
  voting_status text not null default 'coming'
    check (voting_status in ('coming','open','closed','finished')),
  opens_at timestamptz,
  closes_at timestamptz,
  results_published boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint awards_voting_window check (
    (opens_at is null and closes_at is null)
    or (opens_at is not null and closes_at is not null and closes_at > opens_at)
  ),
  constraint awards_results_status check(
    not results_published or (voting_status='finished' and published=true)
  ),
  constraint awards_open_window check (
    voting_status not in ('open','closed','finished')
    or (opens_at is not null and closes_at is not null)
  )
);

create table if not exists public.club_award_nominees (
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references public.club_awards(id) on delete restrict,
  display_label text not null
    check (char_length(btrim(display_label)) between 2 and 100),
  consent_reviewed boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0
    check (sort_order between 0 and 10000),
  created_at timestamptz not null default now(),
  unique(award_id,id),
  constraint nominees_need_consent check (not published or consent_reviewed)
);

create table if not exists public.club_award_results (
  award_id uuid primary key references public.club_awards(id) on delete restrict,
  nominee_id uuid not null,
  published_at timestamptz not null default now(),
  constraint award_result_nominee_same_award foreign key (award_id,nominee_id)
    references public.club_award_nominees(award_id,id) on delete restrict
);

create index if not exists club_awards_public_team_idx on public.club_awards(team_code,voting_status)
  where published=true;
create index if not exists club_award_nominees_award_idx on public.club_award_nominees(award_id,sort_order)
  where published=true and consent_reviewed=true;
create index if not exists club_award_results_nominee_idx on public.club_award_results(nominee_id);

alter table public.club_awards enable row level security;
alter table public.club_award_nominees enable row level security;
alter table public.club_award_results enable row level security;

revoke all on public.club_awards,public.club_award_nominees,public.club_award_results
  from public,anon,authenticated;
grant select on public.club_awards,public.club_award_nominees,public.club_award_results
  to anon,authenticated;

create policy club_awards_public on public.club_awards
  for select to anon,authenticated using (published=true);

create policy club_award_nominees_public on public.club_award_nominees
  for select to anon,authenticated using (
    published=true and consent_reviewed=true
    and exists(
      select 1 from public.club_awards a
      where a.id=award_id and a.published=true
    )
  );

-- Winner results are invisible until both explicit publication and finished status.
create policy club_award_results_public on public.club_award_results
  for select to anon,authenticated using (
    exists(
      select 1 from public.club_awards a
      where a.id=award_id and a.published=true
        and a.results_published=true and a.voting_status='finished'
    ) and exists(
      select 1 from public.club_award_nominees n
      where n.id=nominee_id and n.award_id=club_award_results.award_id
        and n.published=true and n.consent_reviewed=true
    )
  );

comment on table public.club_awards is
  'Awards Boissy-UJ: public approved categories only, no ballot or payments.';
comment on table public.club_award_nominees is
  'Published labels only after image/name consent review; no personal details or photos.';
comment on table public.club_award_results is
  'One verified winner per award, visible only after closed voting and result publication.';

commit;
