-- Boissy-UJ | Media Center public v1 : lecture publique uniquement.
-- Exige le module club_teams (migration sportive) et ne concerne aucun abonnement.
begin;

create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.club_teams(id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title text not null check (char_length(btrim(title)) between 4 and 180),
  excerpt text not null default '' check (char_length(excerpt) <= 400),
  body text not null default '' check (char_length(body) <= 20000),
  content_kind text not null default 'article' check (content_kind in ('article','photo','video')),
  visibility text not null default 'public' check (visibility in ('public','premium')),
  status text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  consent_reviewed boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_requires_consent_and_date check (
    status <> 'published' or (consent_reviewed = true and published_at is not null)
  )
);

create index if not exists news_public_feed_idx on public.news_posts (published_at desc)
where status = 'published' and visibility = 'public' and consent_reviewed = true;

alter table public.news_posts enable row level security;
revoke all on public.news_posts from anon, authenticated;
grant select on public.news_posts to anon, authenticated;

create policy news_published_public_view on public.news_posts
for select to anon, authenticated using (
  visibility = 'public'
  and status = 'published'
  and consent_reviewed = true
  and published_at <= now()
);

-- Les publications premium restent invisibles aux comptes publics et seront
-- servies plus tard par une interface privée validant le statut Stripe.
-- Ecriture par futur backend autorisé seulement, après audit et contrôle du droit à l'image.
comment on table public.news_posts is
  'Boissy-UJ : seules les publications publiques, consenties et publiées sont visibles via API anonyme.';

commit;
