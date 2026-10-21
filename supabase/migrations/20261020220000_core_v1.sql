-- Boissy-UJ core schema v1. Additive foundation; no Stripe LIVE or user data.
create table public.club_teams (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check (code in ('a','b','c','veterans')),
 name text not null,
 division text not null,
 source_kind text not null check (source_kind in ('fff','manual')),
 sort_order integer not null,
 created_at timestamptz not null default now()
);
create table public.user_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text check (char_length(display_name) <= 80),
 favorite_team_id uuid references public.club_teams(id) on delete set null,
 created_at timestamptz not null default now()
);
create table public.club_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 granted_at timestamptz not null default now()
);
create table public.matches (
 id uuid primary key default gen_random_uuid(),
 team_id uuid not null references public.club_teams(id),
 opponent_name text not null check (char_length(opponent_name) <= 120),
 scheduled_at timestamptz,
 venue text,
 is_home boolean not null default true,
 home_score integer check (home_score >= 0),
 away_score integer check (away_score >= 0),
 match_status text not null default 'scheduled' check (match_status in ('scheduled','played','postponed','cancelled')),
 source_kind text not null default 'manual' check (source_kind in ('fff','manual')),
 published boolean not null default false,
 created_at timestamptz not null default now()
);
create index matches_public_schedule_idx on public.matches (team_id, scheduled_at) where published = true;
create table public.news_posts (
 id uuid primary key default gen_random_uuid(),
 team_id uuid references public.club_teams(id) on delete set null,
 slug text not null unique,
 title text not null,
 excerpt text not null default '',
 body text not null default '',
 status text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
 consent_reviewed boolean not null default false,
 published_at timestamptz,
 created_at timestamptz not null default now(),
 constraint published_requires_review check (status <> 'published' or consent_reviewed = true)
);
create table public.club_events (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 description text not null default '',
 starts_at timestamptz,
 capacity integer check (capacity is null or capacity > 0),
 access_kind text not null default 'public' check (access_kind in ('public','premium')),
 ticket_kind text not null default 'free' check (ticket_kind in ('free','paid')),
 ticket_price_cents integer not null default 0 check (ticket_price_cents >= 0),
 published boolean not null default false,
 created_at timestamptz not null default now(),
 constraint free_event_no_fee check (ticket_kind <> 'free' or ticket_price_cents = 0)
);
create table public.donation_campaigns (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 description text not null default '',
 target_cents bigint check (target_cents is null or target_cents > 0),
 close_policy text not null default 'on_target' check (close_policy in ('on_target','scheduled_or_manual')),
 status text not null default 'draft' check (status in ('draft','active','paused','closed')),
 published boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.club_audit_log (
 id bigint generated always as identity primary key,
 actor_user_id uuid references auth.users(id) on delete set null,
 action text not null,
 entity_type text not null,
 entity_id text,
 created_at timestamptz not null default now()
);
insert into public.club_teams(code,name,division,source_kind,sort_order) values
('a','Seniors A','Départemental 3','fff',1),
('b','Seniors B','Départemental 4','fff',2),
('c','Seniors C','Matchs amicaux','manual',3),
('veterans','Vétérans','Départemental 3','fff',4);
alter table public.club_teams enable row level security;
alter table public.user_profiles enable row level security;
alter table public.club_admins enable row level security;
alter table public.matches enable row level security;
alter table public.news_posts enable row level security;
alter table public.club_events enable row level security;
alter table public.donation_campaigns enable row level security;
alter table public.club_audit_log enable row level security;
-- Refuse accidental client access to privileged tables even if default grants are permissive.
revoke all on public.club_admins, public.club_audit_log from anon, authenticated;
revoke all on public.club_teams, public.matches, public.news_posts, public.club_events, public.donation_campaigns from anon, authenticated;
revoke all on public.user_profiles from anon, authenticated;
grant select on public.club_teams, public.matches, public.news_posts, public.club_events, public.donation_campaigns to anon, authenticated;
grant select, insert, update on public.user_profiles to authenticated;
create policy club_teams_public_read on public.club_teams for select to anon, authenticated using (true);
create policy matches_published_read on public.matches for select to anon, authenticated using (published = true);
create policy news_published_read on public.news_posts for select to anon, authenticated using (status = 'published' and consent_reviewed = true and published_at <= now());
create policy events_published_read on public.club_events for select to anon, authenticated using (published = true);
create policy campaigns_published_read on public.donation_campaigns for select to anon, authenticated using (published = true and status = 'active');
create policy profiles_self_read on public.user_profiles for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_self_create on public.user_profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy profiles_self_update on public.user_profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
comment on table public.club_admins is 'Privileged membership: service role only until admin workflow and audit policies are implemented.';
comment on table public.club_audit_log is 'Server-managed audit log. No client access.';
