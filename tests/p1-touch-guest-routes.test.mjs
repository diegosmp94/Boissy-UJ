import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const css=read('styles.css');
const browser=read('scripts/browser-smoke.mjs');
const auth=read('admin-center.mjs');
test('P1 header and legal links provide minimum 44px targets',()=>{
 assert.match(css,/\.header-account\{[^}]*min-height:44px/);
 assert.match(css,/\.menu-toggle\{[^}]*width:44px;height:44px/);
 assert.match(css,/\.global-legal-footer a\{[^}]*min-height:44px/);
 assert.match(browser,/Insufficient mobile target size/);
});
test('P1 anonymous browser test covers major sport/public routes plus admin guest guard',()=>{
 for(const route of ['#/equipes','#/matchs','#/actualites','#/rejoindre','#/control-center']){
  assert.ok(browser.includes("hash:'"+route+"'"),route);
 }
 assert.match(browser,/Guest obtained administrator navigation/);
 assert.match(browser,/Protected administration guard absent/);
 assert.match(auth,/canOpenAdmin\(verified,supabaseConfig\.adminEnabled\)/);
});
