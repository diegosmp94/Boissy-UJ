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
        and p.content_kind = 'article'
        and p.status = 'published'
        and p.visibility = 'public'
        and p.consent_reviewed = true
        and p.published_at <= now()
    )
  );

create policy news_reactions_delete_own on public.news_reactions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Serialize reaction INSERT with unpublication: no stale client may add
-- a reaction while an editor changes the article to draft/archived/private.
create or replace function app_private.verify_news_reaction_target()
returns trigger
language plpgsql security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or new.user_id is distinct from (select auth.uid()) then
  raise exception 'Reaction owner required' using errcode='42501';
 end if;
 perform 1 from public.news_posts p
 where p.id=new.post_id and p.content_kind='article'
   and p.status='published' and p.visibility='public'
   and p.consent_reviewed=true and p.published_at<=now()
 for share of p;
 if not found then
  raise exception 'Article is no longer published for reactions'
   using errcode='42501';
 end if;
 return new;
end;
$fn$;

drop trigger if exists news_reactions_target_guard on public.news_reactions;
create trigger news_reactions_target_guard
 before insert on public.news_reactions
 for each row execute function app_private.verify_news_reaction_target();

-- An article taken offline must not preserve personal like records.
-- A new insert holds FOR SHARE on the same post and therefore cannot race
-- a concurrently committed unpublication.
create or replace function app_private.clear_unpublished_news_reactions()
returns trigger
language plpgsql security definer set search_path=''
as $fn$
begin
 if old.status='published' and old.visibility='public'
    and (new.status is distinct from 'published'
      or new.visibility is distinct from 'public'
      or new.consent_reviewed is distinct from true
      or new.content_kind is distinct from 'article') then
  delete from public.news_reactions where post_id=new.id;
 end if;
 return new;
end;
$fn$;

drop trigger if exists news_reactions_unpublish_guard on public.news_posts;
create trigger news_reactions_unpublish_guard
 after update of status,visibility,consent_reviewed,content_kind on public.news_posts
 for each row execute function app_private.clear_unpublished_news_reactions();

revoke all on function app_private.verify_news_reaction_target()
 from public,anon,authenticated;
revoke all on function app_private.clear_unpublished_news_reactions()
 from public,anon,authenticated;

comment on table public.news_reactions is
  'Une reaction volontaire par compte et actualite publique. Seul le titulaire peut lire, ajouter ou retirer sa reaction ; suppression en cascade.';

commit;
