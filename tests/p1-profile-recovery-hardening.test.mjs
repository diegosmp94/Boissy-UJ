import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const update=read('supabase/migrations/202610220007_profile_column_level_write_guard.sql');
const insert=read('supabase/migrations/202610220008_profile_column_level_insert_guard.sql');
const recovery=read('scripts/db-recovery-verification.sql');
const playbook=read('docs/P1_RECOVERY_PLAYBOOK.md');
const phase3=read('docs/P1_HOMOLOGATION_PHASE3.md');

test('profile UPDATE privileges allow only display_name, leaving RLS and audit RPC intact',()=>{
 assert.match(update,/revoke update on table public\.profiles from authenticated/i);
 assert.match(update,/grant update \(display_name\) on table public\.profiles to authenticated/i);
 assert.doesNotMatch(update,/grant update\s+on table public\.profiles/i);
 assert.doesNotMatch(update,/drop\s+policy|disable row level security/i);
});
test('profile INSERT privileges permit only id and display_name, with database defaults for timestamps',()=>{
 assert.match(insert,/revoke insert on table public\.profiles from authenticated/i);
 assert.match(insert,/grant insert \(id,display_name\) on table public\.profiles to authenticated/i);
 assert.doesNotMatch(insert,/grant insert\s+on table public\.profiles/i);
 assert.doesNotMatch(insert,/drop\s+table|truncate|delete from/i);
});
test('recovery audit is read-only, checks schema, RLS, privileged RPCs and effective member privileges',()=>{
 for(const phrase of [
  'public_schema_fingerprint','public_rls_policy_fingerprint','rls_disabled_tables',
  'privileged_anon_rpcs','user_roles_authenticated_can_write',
  'profiles_can_update_identity_or_timestamps','profiles_can_insert_timestamps',
  'profiles_can_update_display_name','profiles_can_insert_id_and_display_name'
 ])assert.ok(recovery.includes(phrase),phrase);
 assert.match(recovery,/pg_policies/);
 assert.match(recovery,/has_column_privilege/);
 assert.doesNotMatch(recovery,/\b(?:insert|delete|update|drop|truncate|alter|grant|revoke)\s+(?:into|from|on|table|function|public\.)/i);
});
test('restore requires a separate target and retains user data outside GitHub',()=>{
 assert.match(playbook,/ISOLATED_RESTORE_DATABASE_URL/);
 assert.match(playbook,/SOURCE_DATABASE_URL/);
 assert.match(playbook,/sha256sum/);
 assert.match(playbook,/--single-transaction/);
 assert.match(playbook,/Storage/);
 assert.match(playbook,/NON EFFECTUÉE/);
 assert.match(phase3,/noindex/);
 assert.match(phase3,/Free/);
});
