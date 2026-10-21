-- Boissy-UJ | restrict public news column exposure.
-- Any article remains subject to the public-only published RLS policy.
-- Keep filter columns for existing PostgREST query compatibility.
begin;

revoke select on public.news_posts from public, anon, authenticated;

grant select (
  id,team_id,slug,title,excerpt,body,content_kind,
  visibility,status,consent_reviewed,published_at
) on public.news_posts to anon, authenticated;

-- Do not expose author_user_id or internal creation/update timestamps to
-- unauthenticated or ordinary signed-in clients. The secure RPC remains
-- able to write and audit under checked identity and team scope.
commit;
