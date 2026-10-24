import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../scripts/db-p1-permissions-readonly-audit.sql',import.meta.url),'utf8');
test('P1 audit query reports public-table RLS, definer RPCs and admin MFA guard only through metadata',()=>{
 for(const marker of [
  'pg_class','pg_namespace','pg_proc','relrowsecurity',
  "has_function_privilege('anon'","has_function_privilege('authenticated'",
  'app_private.is_admin','pg_get_functiondef',
  'public_tables','tables_with_rls','anonymous_definer_rpc_exposure',
  'admin_functions_missing_guard_reference','static_mfa_guard_marker_present'
 ])assert.ok(sql.includes(marker),marker);
});
test('P1 reusable metadata audit cannot export personal database rows or mutate production',()=>{
 const statement=sql.replace(/^--.*$/gm,'');
 assert.match(statement,/\bwith exposed as/i);
 assert.match(statement,/\bselect\b[\s\S]*;\s*$/i);
 assert.doesNotMatch(statement,/\b(?:insert\s+into|delete\s+from|update\s+public|alter\s+table|drop\s+table|truncate|copy\s+|create\s+|grant\s+|revoke\s+|do\s+\$\$)\b/i);
 assert.doesNotMatch(statement,/\b(?:auth\.users|raw_user_meta_data|select\s+\*\s+from)\b/i);
});
