import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const app=read('app.js'),html=read('index.html');
test('interactive Thursday showcase is intentionally removed from public routes',()=>{
 assert.doesNotMatch(app,/function presentation\(\)|'\/presentation':presentation|mountPresentation\(/);
 assert.doesNotMatch(html,/href="#\/presentation"/);
});
test('all ordinary club pages remain available and read real published data',()=>{
 for(const route of ["'/equipes':teamPage","'/matchs':matches","'/actualites':news","'/mon-espace':account"]){
  assert.ok(app.includes(route));
 }
 assert.match(read('auth-config.mjs'),/adminEnabled:\s*true/);
});
test('real admin route is protected by verified auth and MFA, not a public demo',()=>{
 const src=read('admin-center.mjs');
 assert.match(src,/adminSessionStatus\(api\)/);
 assert.match(src,/canOpenAdmin\(verified,supabaseConfig.adminEnabled\)/);
 assert.doesNotMatch(src,/MODE PRÉVISUALISATION|mountTeamWorkspace\(/);
});
