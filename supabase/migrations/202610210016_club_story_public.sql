-- Boissy-UJ | Club identity, story and governance public catalog.
-- No invented founder, date, person, event or project is seeded.
begin;

create table if not exists public.club_story_sections (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('history','values','organization','projects')),
  heading text not null check (char_length(btrim(heading)) between 4 and 160),
  body text not null check (char_length(btrim(body)) between 10 and 4000),
  published boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.club_story_milestones (
  id uuid primary key default gen_random_uuid(),
  period_label text not null check (char_length(btrim(period_label)) between 4 and 60),
  heading text not null check (char_length(btrim(heading)) between 4 and 140),
  description text not null check (char_length(btrim(description)) between 8 and 1200),
  published boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  created_at timestamptz not null default now()
);

create table if not exists public.club_public_positions (
  id uuid primary key default gen_random_uuid(),
  role_title text not null check (char_length(btrim(role_title)) between 3 and 120),
  role_description text not null default '' check (char_length(role_description)<=1400),
  display_name text check(display_name is null or char_length(btrim(display_name)) between 2 and 110),
  consent_reviewed boolean not null default false,
  published boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  updated_at timestamptz not null default now(),
  constraint public_position_consent check (
    not published or display_name is null or consent_reviewed
  )
);

create index if not exists club_story_sections_order_idx
  on public.club_story_sections(kind,sort_order,id) where published=true;
create index if not exists club_story_milestones_order_idx
  on public.club_story_milestones(sort_order,id) where published=true;
create index if not exists club_public_positions_order_idx
  on public.club_public_positions(sort_order,id) where published=true;

alter table public.club_story_sections enable row level security;
alter table public.club_story_milestones enable row level security;
alter table public.club_public_positions enable row level security;

revoke all on public.club_story_sections,public.club_story_milestones,
  public.club_public_positions from public,anon,authenticated;
grant select on public.club_story_sections,public.club_story_milestones,
  public.club_public_positions to anon,authenticated;

create policy club_story_sections_public_read on public.club_story_sections
  for select to anon,authenticated using(published=true);
create policy club_story_milestones_public_read on public.club_story_milestones
  for select to anon,authenticated using(published=true);
create policy club_public_positions_public_read on public.club_public_positions
  for select to anon,authenticated using(
    published=true and (display_name is null or consent_reviewed=true)
  );

comment on table public.club_story_sections is
  'Only officially published club history, values, governance and projects; no personal drafts.';
comment on table public.club_story_milestones is
  'Public club chronology. Empty until verified dates and milestones are approved.';
comment on table public.club_public_positions is
  'Club governance roles. A personal name requires consent review before publication.';

commit;
