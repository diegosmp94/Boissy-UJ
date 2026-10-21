-- Étape 27: lecture des brouillons/rencontres/rédaction et saisons réservée admin MFA.
-- Aucune écriture directe aux navigateurs, pas de modification des RLS existantes.
begin;
create or replace function public.admin_list_management_matches()
returns setof public.matches
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Administrator MFA required' using errcode='42501'; end if;
 return query select m.* from public.matches m order by m.scheduled_at desc nulls last,m.id limit 250;
end;
$fn$;
create or replace function public.admin_list_management_news()
returns setof public.news_posts
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Administrator MFA required' using errcode='42501'; end if;
 return query select p.* from public.news_posts p
   where p.content_kind='article' and p.visibility='public'
   order by p.updated_at desc,p.id limit 200;
end;
$fn$;
create or replace function public.admin_list_management_seasons()
returns setof public.club_seasons
language plpgsql stable security definer set search_path=''
as $fn$
begin
 if (select auth.uid()) is null or not coalesce((select app_private.is_admin()),false)
 then raise exception 'Administrator MFA required' using errcode='42501'; end if;
 return query select s.* from public.club_seasons s order by s.label desc,s.id limit 100;
end;
$fn$;
revoke all on function public.admin_list_management_matches() from public,anon;
revoke all on function public.admin_list_management_news() from public,anon;
revoke all on function public.admin_list_management_seasons() from public,anon;
grant execute on function public.admin_list_management_matches() to authenticated;
grant execute on function public.admin_list_management_news() to authenticated;
grant execute on function public.admin_list_management_seasons() to authenticated;
comment on function public.admin_list_management_matches() is 'Private match drafts; admin plus verified MFA AAL2 via app_private.is_admin.';
comment on function public.admin_list_management_news() is 'Private editorial drafts; admin plus verified MFA AAL2 via app_private.is_admin.';
comment on function public.admin_list_management_seasons() is 'Admin seasons management; admin plus verified MFA AAL2 via app_private.is_admin.';
commit;
