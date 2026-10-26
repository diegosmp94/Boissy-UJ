import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const migration=read('supabase/migrations/202610260001_release_inactive_team_jersey.sql');

test('disaffiliation and deletion both release stale numbers and preserve an audit',()=>{
 for(const part of [
  'create table if not exists app_private.team_player_position_release_audit',
  'previous_shirt_number smallint not null',
  "reason text not null check(reason in ('membership_deactivated','membership_deleted'))",
  'alter table app_private.team_player_position_release_audit enable row level security',
  'revoke all on table app_private.team_player_position_release_audit from public,anon,authenticated',
  'create or replace function app_private.release_position_on_membership_exit()',
  "TG_OP='UPDATE'",
  'OLD.active is distinct from true or NEW.active is distinct from false',
  'perform pg_catalog.pg_advisory_xact_lock',
  'pg_catalog.hashtextextended(OLD.team_id::text,17409)',
  'from app_private.team_player_positions',
  'for update',
  'insert into app_private.team_player_position_release_audit',
  'delete from app_private.team_player_positions',
  'before update of active or delete on app_private.team_player_memberships',
  'where m.active=false',
  'return NEW',
  'return OLD',
  'set search_path=\'\''
 ]) assert.ok(migration.includes(part),'missing backend guarantee: '+part);
 assert.doesNotMatch(migration,/grant (?:execute|select|insert|update|delete) .* to (?:anon|authenticated|public)/i);
 assert.doesNotMatch(migration,/insert into public\.team_public_people|update public\.team_public_people/i);
});

test('membership revocation remains strictly MFA admin and player roles require approval',()=>{
 const old=read('supabase/migrations/202610220002_admin_player_team_memberships.sql');
 const edit=read('supabase/migrations/202610240002_staff_team_player_positions.sql');
 assert.match(old,/app_private\.is_admin\(\)/);
 assert.match(old,/Self-assignment prohibited/);
 assert.match(old,/An approved player role is required/);
 assert.match(edit,/a\.coach_user_id=v_actor and a\.team_id=p_team_id and a\.active=true/);
 assert.match(edit,/m\.team_id=p_team_id and m\.player_user_id=p_player_user_id and m\.active=true/);
 assert.match(edit,/create unique index if not exists team_player_position_unique_number/);
});

test('the remediation is scoped to private roster tables, no publication or fake member creation',()=>{
 assert.doesNotMatch(migration,/(?:insert into|update|alter table) public\.(?:profiles|team_public_people|user_roles)/i);
 assert.doesNotMatch(migration,/auth\.users\s+values|insert into public\.club_teams/i);
 assert.match(migration,/revoke execute on function app_private\.release_position_on_membership_exit\(\)/);
 assert.match(migration,/with stale as \(/);
 assert.match(migration,/commit;/);
});
