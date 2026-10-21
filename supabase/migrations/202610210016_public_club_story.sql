-- Boissy-UJ | Verified public club portrait and historical milestones.
-- No invented history, governance names or founding dates are seeded.
begin;

create table if not exists public.club_story_sections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=90),
  category text not null check (
    category in ('history','identity','values','governance','projects')
  ),
  heading text not null check (char_length(btrim(heading)) between 4 and 160),
  body text not null check (char_length(btrim(body)) between 10 and 4000),
  published boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint story_publication_review check (
    not published or reviewed_at is not null
  )
);

create table if not exists public.club_story_milestones (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 4 and 160),
  description text not null check (char_length(btrim(description)) between 10 and 2500),
  occurred_on date not null,
  date_precision text not null default 'year'
    check(date_precision in ('year','month','day')),
  published boolean not null default false,
  reviewed_at timestamptz,
  sort_order integer not null default 0 check(sort_order between 0 and 10000),
  constraint milestone_review check (
    not published or reviewed_at is not null
  )
);

create index if not exists club_story_sections_visible_idx
  on public.club_story_sections(category,sort_order,id) where published=true;
create index if not exists club_story_milestones_visible_idx
  on public.club_story_milestones(occurred_on,sort_order,id) where published=true;

alter table public.club_story_sections enable row level security;
alter table public.club_story_milestones enable row level security;
revoke all on public.club_story_sections,public.club_story_milestones
  from public,anon,authenticated;
grant select on public.club_story_sections,public.club_story_milestones
  to anon,authenticated;

create policy club_story_sections_public_read on public.club_story_sections
  for select to anon,authenticated using(published=true and reviewed_at is not null);
create policy club_story_milestones_public_read on public.club_story_milestones
  for select to anon,authenticated using(published=true and reviewed_at is not null);

comment on table public.club_story_sections is
  'Club-authored and reviewed institutional sections. No seed or public writing.';
comment on table public.club_story_milestones is
  'Verified chronology only; no fictitious event, person or founding date.';

commit;
