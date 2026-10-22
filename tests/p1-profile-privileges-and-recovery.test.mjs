import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const insert=read('supabase/migrations/202610220008_profile_column_level_insert_guard.sql');
const update=read('supabase/migrations/202610220007_profile_column_level_write_guard.sql');
const recovery=read('scripts/db-recovery-verification.sql');
const runbook=read('docs/P1_RECOVERY_PLAYBOOK.md');
const gitignore=read('.gitignore');

test('authenticated member can update display_name only, without changing creation metadata',()=>{
 assert.match(update,/revoke update on table public\.profiles from authenticated;/);
 assert.match(update,/grant update \(display_name\) on table public\.profiles to authenticated;/);
 assert.doesNotMatch(update,/\b(?:drop|truncate|delete|alter)\s+(?:table|from)/i);
});
test('authenticated member can insert only id and display_name for an owned profile',()=>{
 assert.match(insert,/revoke insert on table public\.profiles from authenticated;/);
 assert.match(insert,/grant insert \(id,display_name\) on table public\.profiles to authenticated;/);
 assert.doesNotMatch(insert,/\b(?:drop|truncate|delete)\s+(?:table|from)/i);
});
test('restore verification is read-only, excludes row identities and checks privilege guards',()=>{
 for(const term of ['pg_policies','relrowsecurity','has_column_privilege','has_table_privilege',
  'profiles_can_update_identity_or_timestamps','profiles_can_insert_timestamps',
  'privileged_anon_rpcs','public_schema_fingerprint','public_rls_policy_fingerprint',
  'role_requests_authenticated_can_write_directly','user_roles_authenticated_can_write']){
  assert.ok(recovery.includes(term),term);
 }
 assert.doesNotMatch(recovery,/\b(?:delete\s+from|insert\s+into|update\s+public\.|drop\s+table|alter\s+table|grant\s+(?:all|update|insert)|revoke\s+(?:all|update|insert))/i);
 assert.doesNotMatch(recovery,/auth\.users\s+(?:u\s+)?where|select\s+(?:email|id|user_id|raw_user_meta_data)\s+from\s+auth\.users/i);
});
test('backup and restore plan requires a separate, authorized database and no credentials in git',()=>{
 for(const term of ['NON EFFECTUÉE','SOURCE_DATABASE_URL','RECOVERY_DATABASE_URL',
   'sha256sum','supabase db dump','psql --single-transaction','Storage','Auth']){
  assert.ok(runbook.includes(term),term);
 }
 assert.match(gitignore,/recovery-private\//);
 assert.match(gitignore,/\.env\.\*/);
 assert.match(gitignore,/\*\.dump/);
 assert.doesNotMatch(gitignore,/\n\*\.sql\s*$/m);
});
