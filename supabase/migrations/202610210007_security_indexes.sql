-- Boissy-UJ | Security and referential performance hardening.
-- Apply only after auth, sports, news, events, staff workflow migrations.
-- This migration doesn't create users, posts, bookings or payment objects.
begin;

-- This function is an event trigger, not an RPC. It does not need
-- invocation rights for anonymous or authenticated HTTP users.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- Foreign-key lookup indexes recommended by Supabase's performance advisor.
create index if not exists news_posts_team_id_idx
  on public.news_posts(team_id);
create index if not exists news_posts_author_user_id_idx
  on public.news_posts(author_user_id);
create index if not exists staff_news_audit_team_id_idx
  on public.staff_news_audit(team_id);
create index if not exists staff_news_audit_actor_user_id_idx
  on public.staff_news_audit(actor_user_id);
create index if not exists staff_team_assignments_granted_by_idx
  on public.staff_team_assignments(granted_by);
create index if not exists user_roles_granted_by_idx
  on public.user_roles(granted_by);

-- Defense in depth for public read-only catalogue tables.
revoke insert, update, delete on public.club_teams, public.matches,
  public.news_posts, public.club_events from anon, authenticated;

-- Audit is private even to signed-in users; deliberate deny-all RLS.
revoke all on public.staff_news_audit from anon, authenticated;

commit;
