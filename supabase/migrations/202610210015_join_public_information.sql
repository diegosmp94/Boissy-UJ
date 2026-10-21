-- Boissy-UJ | Public recruitment and practical information catalogue.
-- No applications, private member data or unverified contact details inserted.
begin;

create table if not exists public.club_join_opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 4 and 120),
  description text not null check (char_length(btrim(description)) between 10 and 3000),
  audience text not null check(audience in ('player','coach','volunteer','partner')),
  team_code text check(team_code in ('a','b','c','veterans')),
  stage text not null default 'planned' check(stage in ('planned','open','closed')),
  published boolean not null default false,
  sort_order integer not null default 0 check(sort_order between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint join_team_relevance check (
    team_code is null or audience in ('player','coach')
  )
);
create index if not exists join_opportunities_published_idx
  on public.club_join_opportunities(audience,sort_order,id) where published=true;

create table if not exists public.club_public_notices (
  id uuid primary key default gen_random_uuid(),
  topic text not null check(topic in ('faq','training','matchday','venue','membership','general')),
  heading text not null check(char_length(btrim(heading)) between 4 and 180),
  body text not null check(char_length(btrim(body)) between 8 and 3500),
  published boolean not null default false,
  sort_order integer not null default 0 check(sort_order between 0 and 10000),
  updated_at timestamptz not null default now()
);
create index if not exists public_notices_topic_idx
  on public.club_public_notices(topic,sort_order,id) where published=true;

create table if not exists public.club_contact_channels (
  id uuid primary key default gen_random_uuid(),
  label text not null check(char_length(btrim(label)) between 3 and 90),
  channel_type text not null check(channel_type in ('email','website','phone')),
  channel_value text not null check (char_length(btrim(channel_value)) between 5 and 300),
  audience text not null default 'general'
    check(audience in ('general','player','coach','volunteer','partner')),
  published boolean not null default false,
  sort_order integer not null default 0 check(sort_order between 0 and 10000),
  updated_at timestamptz not null default now(),
  constraint contact_format check (
    (channel_type='email' and channel_value ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
    or (channel_type='website' and channel_value ~* '^https://[^[:space:]]+\.[^[:space:]]+$')
    or (channel_type='phone' and channel_value ~ '^\+[0-9]{8,15}$')
  )
);
create index if not exists public_contacts_audience_idx
  on public.club_contact_channels(audience,sort_order,id) where published=true;

alter table public.club_join_opportunities enable row level security;
alter table public.club_public_notices enable row level security;
alter table public.club_contact_channels enable row level security;

revoke all on public.club_join_opportunities,public.club_public_notices,
  public.club_contact_channels from public,anon,authenticated;
grant select on public.club_join_opportunities,public.club_public_notices,
  public.club_contact_channels to anon,authenticated;

create policy public_join_opportunities_read on public.club_join_opportunities
  for select to anon,authenticated using(published=true);
create policy public_notices_read on public.club_public_notices
  for select to anon,authenticated using(published=true);
create policy public_contacts_read on public.club_contact_channels
  for select to anon,authenticated using(published=true);

comment on table public.club_join_opportunities is
  'Club-published recruitment notices; no direct registration or intake of personal data.';
comment on table public.club_public_notices is
  'Club-verified practical information and FAQs; private drafts are inaccessible.';
comment on table public.club_contact_channels is
  'Only officially authorized public contact details; no records seeded.';

commit;
