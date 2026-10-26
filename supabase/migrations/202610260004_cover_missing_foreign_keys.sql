-- P2 database performance: cover nine foreign keys flagged by the Supabase advisor.
-- Additive only. Do not modify grants, RLS, rows, membership, or public visibility.
-- Ordinary CREATE INDEX is intentional: migration runners can execute in a transaction.
-- The nine columns and existing indices were verified on Boissy-UJ on 2026-10-26.
create index if not exists league_standings_audit_actor_user_idx
  on app_private.league_standings_audit (actor_user_id);

create index if not exists match_competition_audit_actor_user_idx
  on app_private.match_competition_audit (actor_user_id);

create index if not exists match_competition_audit_match_idx
  on app_private.match_competition_audit (match_id);

create index if not exists team_player_position_audit_actor_idx
  on app_private.team_player_position_audit (actor_user_id);

create index if not exists team_player_position_audit_player_idx
  on app_private.team_player_position_audit (player_user_id);

create index if not exists team_player_position_audit_team_idx
  on app_private.team_player_position_audit (team_id);

create index if not exists team_player_positions_updated_by_idx
  on app_private.team_player_positions (updated_by);

create index if not exists team_league_standings_season_id_idx
  on public.team_league_standings (season_id);

create index if not exists team_league_standings_updated_by_idx
  on public.team_league_standings (updated_by);
