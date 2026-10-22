import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../supabase/migrations/202610220006_foreign_key_query_indexes.sql', import.meta.url),'utf8');

test('P1 database quality: all 9 Supabase foreign key advisor findings have covering indexes', () => {
 const indexes=[
  ['app_private.callup_action_audit','player_user_id'],
  ['app_private.club_identity_change_log','actor_user_id'],
  ['app_private.coach_team_assignment_audit','actor_user_id'],
  ['app_private.coach_team_assignment_audit','coach_user_id'],
  ['app_private.coach_team_assignment_audit','team_id'],
  ['app_private.role_change_audit','team_id'],
  ['public.club_award_results','award_id, nominee_id'],
  ['public.role_requests','reviewed_by'],
  ['public.role_requests','team_id']
 ];
 assert.equal((migration.match(/create index if not exists/gi)||[]).length, indexes.length);
 for(const [table,columns] of indexes){
   const escaped=table.replaceAll('.','\\.');
   const pattern=new RegExp('create index if not exists [a-z_]+\\\\s+on '+escaped+' \\\\('+columns+'\\\\)','i');
   assert.match(migration,pattern,table+' missing index on '+columns);
 }
});

test('P1 index migration is additive and does not alter data, policies, roles or users', () => {
 const executable=migration.replace(/--[^\\n]*/g,'');
 assert.doesNotMatch(executable,/\\b(drop|truncate|delete|update|insert|alter|revoke|grant)\\b/i);
 assert.doesNotMatch(executable,/auth\\.users|public\\.user_roles|service_role/i);
});
