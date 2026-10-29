import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../scripts/db-definer-rpc-readonly-review.sql',import.meta.url),'utf8');

test('privileged RPC audit enumerates admin, staff, player and member endpoints through catalogs',()=>{
 for(const marker of [
  'pg_proc','pg_namespace','pg_get_functiondef','pg_get_function_identity_arguments',
  "has_function_privilege('anon'","has_function_privilege('authenticated'",
  'prosecdef','fixed_search_path','uid_marker','admin_marker',
  'admin_missing_central_gate_marker','without_uid_or_admin_marker',
  'without_fixed_search_path','non_admin_review_queue',
  "'admin'","'staff'","'member'","'player'",
  'rpc_security_snapshot'
 ])assert.ok(sql.includes(marker),'Missing marker: '+marker);
});

test('privileged RPC audit only reads metadata and never alters permissions or user records',()=>{
 const executable=sql.replace(/^--.*$/gm,'');
 assert.match(executable,/^\s*with\s+all_public_definers\s+as/i);
 assert.match(executable,/select\s+jsonb_build_object\s*\(/i);
 assert.match(executable,/as rpc_security_snapshot;\s*$/);
 assert.doesNotMatch(executable,/\b(?:create\s+|alter\s+|drop\s+|grant\s+|revoke\s+|insert\s+into\s+|update\s+|delete\s+from\s+|truncate\s+|copy\s+|call\s+|do\s+\$\$|set\s+role)\b/i);
 assert.doesNotMatch(executable,/\b(?:from|join)\s+(?:auth\.users|public\.profiles|app_private\.)/i);
 assert.doesNotMatch(executable,/raw_user_meta_data|service_role|access_token|refresh_token/i);
});
