import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateAuthInput} from '../auth-flow.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610220009_profile_display_name_hygiene.sql');
const ui=read('auth.mjs');
const identity={email:'member@example.org',password:'SafePassword123#'};
test('signup display-name size matches server-side 2–80 rule',()=>{
 assert.equal(validateAuthInput('register',{...identity,displayName:'AB'}).valid,true);
 assert.equal(validateAuthInput('register',{...identity,displayName:'É'.repeat(80)}).valid,true);
 for(const displayName of ['a','x'.repeat(81),'Émile\nDupont','Bob\u007fJones']){
  assert.equal(validateAuthInput('register',{...identity,displayName}).valid,false,JSON.stringify(displayName));
 }
 assert.match(ui,/name\.querySelector\('input'\)\.maxLength=80/);
});
test('SQL profile constraint rejects empty, overlong and control-character names',()=>{
 assert.match(sql,/add constraint boissy_profile_display_name_hygiene/);
 assert.match(sql,/char_length\(pg_catalog\.btrim\(display_name\)\) between 2 and 80/);
 assert.match(sql,/display_name !~ '\[\[:cntrl:\]\]'/);
 assert.match(sql,/validate constraint boissy_profile_display_name_hygiene/);
 assert.doesNotMatch(sql,/drop table|delete from|truncate table|disable row level security/i);
});
