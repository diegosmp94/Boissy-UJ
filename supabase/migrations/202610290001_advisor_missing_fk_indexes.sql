-- Boissy-UJ / Performance Advisor 2026-10-29: seven uncovered foreign keys.
-- Verified against pg_index + pg_attribute on production 2026-10-29.
-- Additive only: no changes to RLS, role grants, tables, rows, functions, or payments.
-- The tables are currently small (16–96 kB each); ordinary CREATE INDEX is
-- compatible with transactional migrations. Abort rather than wait on locks.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create index if not exists admin_awards_audit_actor_id_idx
  on app_private.admin_awards_audit (actor_id);

-- Existing primary key (award_id, user_id) does not cover user_id as leading column.
create index if not exists award_ballots_user_id_idx
  on app_private.award_ballots (user_id);

create index if not exists news_media_change_audit_actor_user_id_idx
  on app_private.news_media_change_audit (actor_user_id);

create index if not exists news_media_purge_jobs_requested_by_idx
  on app_private.news_media_purge_jobs (requested_by);

create index if not exists news_media_revocation_audit_actor_user_id_idx
  on app_private.news_media_revocation_audit (actor_user_id);

create index if not exists privacy_retention_register_approved_by_idx
  on app_private.privacy_retention_register (approved_by);

create index if not exists role_requests_self_approved_by_idx
  on public.role_requests (self_approved_by);

commit;
