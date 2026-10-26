import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../admin-management.mjs',import.meta.url),'utf8');
test('admin can prefill a sourced match only with fresh MFA check',()=>{
 assert.match(js,/publicExternalFixtures\(\{includePast:true,period:'all'\}\)/);
 assert.match(js,/if\(!await guarded\(api,userId\)\)/);
 assert.match(js,/Pré-remplir un nouveau match sans le publier/);
 assert.match(js,/dossier\.value='new'/);
 assert.match(js,/publish\.n\.checked=false/);
 assert.match(js,/fixture\.dateOnly\?'':/);
 assert.match(js,/timeZone:'Europe\/Paris'/);
 assert.match(js,/p_source_kind:'manual'/);
 assert.match(js,/rpcSave:'admin_save_classified_match'/);
 assert.match(js,/p_competition_kind:d.competitionKind/);
 assert.doesNotMatch(js,/rpcSave:'admin_import_fff'|p_source_kind:'fff',/);
});
