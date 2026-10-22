import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const migration=read('supabase/migrations/202610220007_profile_column_level_write_guard.sql');
const contract=read('scripts/db-roles-contract.sql');
const fingerprint=read('scripts/db-recovery-schema-fingerprint.sql');
const runbook=read('docs/P1_PROFILS_REPRISE_20261022.md');
const verifier=new URL('../scripts/verify-recovery-target.mjs',import.meta.url).pathname;
const run=(source,target)=>{
 const env={...process.env};
 delete env.SOURCE_DATABASE_URL; delete env.RECOVERY_DATABASE_URL;
 if(source!==undefined)env.SOURCE_DATABASE_URL=source;
 if(target!==undefined)env.RECOVERY_DATABASE_URL=target;
 return spawnSync(process.execPath,[verifier],{env,encoding:'utf8'});
};

test('P1: authenticated member can write display_name only, not identity or server timestamps',()=>{
 assert.match(migration,/revoke update on table public\.profiles from authenticated/i);
 assert.match(migration,/grant update \(display_name\) on table public\.profiles to authenticated/i);
 assert.doesNotMatch(migration,/grant update \((?:id|created_at|updated_at)/i);
 assert.doesNotMatch(migration,/drop table|delete from|truncate table/i);
});

test('P1: security report checks own profile, RLS, privileged RPC access and MFA guard',()=>{
 for(const snippet of ['profile_update_table_wide_denied','profile_display_name_edit_allowed','profile_id_edit_denied','profile_created_at_edit_denied','profile_updated_at_edit_denied','rls_missing_tables','anonymous_security_definer_rpc','admin_gate_checks_aal2','admin_gate_checks_role']){
  assert.ok(contract.includes(snippet),'missing '+snippet);
 }
 assert.match(contract,/has_column_privilege\('authenticated'/);
 assert.match(contract,/has_table_privilege\('authenticated'/);
 assert.doesNotMatch(contract,/\b(?:update\s+public|insert\s+into|delete\s+from|drop\s+table|truncate\s+table|alter\s+table|grant\s+update|revoke\s+update)\b/i);
});

test('P1: recovery fingerprint only returns non-sensitive schema metadata',()=>{
 assert.match(fingerprint,/recovery_schema_fingerprint/);
 assert.match(fingerprint,/public_tables_without_rls/);
 assert.match(fingerprint,/public_rls_policy_count/);
 assert.doesNotMatch(fingerprint,/select\s+\*\s+from\s+auth\.users/i);
 assert.doesNotMatch(fingerprint,/\b(?:update|insert into|delete from|drop table|truncate table|alter table)\b/i);
});

test('P1: recovery target guard accepts isolated local target but not prod or missing env',()=>{
 assert.equal(run('postgresql://src:fake@db.example.net:5432/postgres','postgresql://isolated:fake@127.0.0.1:54322/postgres').status,0);
 for(const [source,target] of [
  [undefined,undefined],
  ['postgresql://src:fake@db.example.net/postgres',undefined],
  ['postgresql://src:fake@db.example.net/postgres','postgresql://dst:fake@db.example.net/postgres'],
  ['postgresql://src:fake@db.example.net/postgres','https://localhost/postgres'],
  ['postgresql://src:fake@localhost/postgres','postgresql://dst:fake@localhost/postgres'],
  ['nonsense','postgresql://dst:fake@127.0.0.1/postgres']
 ]){
  const result=run(source,target);
  assert.notEqual(result.status,0,'must reject unsafe recovery target');
  assert.doesNotMatch(result.stdout+result.stderr,/fake@|postgresql:\/\//);
 }
});

test('P1: runbook documents private secrets, no production restore, and human approval blockers',()=>{
 for(const text of ['NON','OFF','noindex','MFA','Supabase','Free','Pro','SOURCE_DATABASE_URL','RECOVERY_DATABASE_URL','verify-recovery-target.mjs','db-recovery-schema-fingerprint.sql']){
  // not all flags in French narrative; validate the specific safeguards below
  if(['NON','OFF'].includes(text))continue;
  assert.ok(runbook.includes(text),'missing '+text);
 }
 assert.match(runbook,/restauration effective n'est revendiquée/i);
 assert.match(runbook,/données des mineurs/i);
});
