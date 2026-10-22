-- P1 quality: covering indexes for foreign-key joins found by Supabase Advisor on 22 Oct 2026.
-- Additive only; preserves RLS, grants, existing records and all auth roles.
-- Do not remove other indexes just because they have zero usage on a new database.
create index if not exists callup_action_audit_player_idx
  on app_private.callup_action_audit (player_user_id);
create index if not exists club_identity_change_log_actor_idx
  on app_private.club_identity_change_log (actor_user_id);
create index if not exists coach_team_assignment_audit_actor_idx
  on app_private.coach_team_assignment_audit (actor_user_id);
create index if not exists coach_team_assignment_audit_coach_idx
  on app_private.coach_team_assignment_audit (coach_user_id);
create index if not exists coach_team_assignment_audit_team_idx
  on app_private.coach_team_assignment_audit (team_id);
create index if not exists role_change_audit_team_idx
  on app_private.role_change_audit (team_id);
create index if not exists club_award_results_award_nominee_idx
  on public.club_award_results (award_id, nominee_id);
create index if not exists role_requests_reviewed_by_idx
  on public.role_requests (reviewed_by);
create index if not exists role_requests_team_id_idx
  on public.role_requests (team_id);
