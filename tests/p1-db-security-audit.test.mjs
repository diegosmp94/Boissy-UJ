import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../scripts/db-security-audit.sql',import.meta.url),'utf8');
const doc=readFileSync(new URL('../docs/P1_HOMOLOGATION_PHASE2.md',import.meta.url),'utf8');

test('security report checks anon and signed-in RPCs plus RLS without querying members',()=>{
 assert.match(sql,/has_function_privilege\('anon'/);
 assert.match(sql,/has_function_privilege\('authenticated'/);
 assert.match(sql,/relrowsecurity/);
 assert.match(sql,/authenticated_definer_without_uid_check/);
 assert.match(sql,/admin_definer_without_central_gate/);
 assert.match(sql,/jsonb_build_object/);
 assert.doesNotMatch(sql,/\b(drop|truncate|insert|delete|update|alter|grant|revoke)\s+(?:table|into|from|on|function)/i);
 assert.doesNotMatch(sql,/select\s+\*\s+from\s+(?:auth\.users|public\.profiles)/i);
});
test('homologation report leaves legal, physical and restore milestones explicitly open',()=>{
 for(const piece of ['NON HOMOLOGUÉ','iPhone Safari','VoiceOver','restauration','MFA','multi-identités','noindex','À faire']){
  assert.ok(doc.includes(piece),piece);
 }
});
