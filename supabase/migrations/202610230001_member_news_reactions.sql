-- Boissy-UJ | Reactions simples aux actualites publiques.
-- Aucun commentaire, messagerie, compteur nominatif ou donnee de paiement.
-- Prerequis : news_posts, auth Supabase. Nouvelle table vide au deploiement.
begin;

create table if not exists public.news_reactions (
  post_id uuid not null references public.news_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id,user_id)
);
create index if not exists news_reactions_by_user_idx
  on public.news_reactions(user_id,post_id);

alter table public.news_reactions enable row level security;
revoke all on table public.news_reactions from public,anon,authenticated;
-- Aucune lecture publique des identifiants de comptes. Pas d'UPDATE.
grant select (post_id,user_id),insert (post_id,user_id),delete
  on table public.news_reactions to authenticated;

create policy news_reactions_select_own on public.news_reactions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy news_reactions_add_own_published on public.news_reactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.news_posts p
      where p.id = post_id
        and p.status = 'published'
        and p.visibility = 'public'
        and p.consent_reviewed = true
        and p.published_at <= now()
    )
  );

create policy news_reactions_delete_own on public.news_reactions
  for delete to authenticated
  using (user_id = (select auth.uid()));

comment on table public.news_reactions is
  'Une reaction volontaire par compte et actualite publique. Seul le titulaire peut lire, ajouter ou retirer sa reaction ; suppression en cascade.';

commit;
