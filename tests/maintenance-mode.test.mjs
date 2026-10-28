import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SITE_MAINTENANCE} from '../site-maintenance-config.mjs';
import {maintenanceSourceForAction} from '../scripts/set-maintenance-mode.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('maintenance: version-controlled switch is a strict boolean',()=>{
 assert.equal(typeof SITE_MAINTENANCE.enabled,'boolean');
 assert.ok(Object.isFrozen(SITE_MAINTENANCE));
 assert.match(read('site-maintenance-config.mjs'),/^export const SITE_MAINTENANCE=Object\.freeze\(\{enabled:(true|false)\}\);\n$/);
});
test('maintenance: manual toggler handles both states and rejects injected content',()=>{
 const off=maintenanceSourceForAction(read('site-maintenance-config.mjs'),'desactiver');
 const on=maintenanceSourceForAction(off,'activer');
 assert.equal(on,'export const SITE_MAINTENANCE=Object.freeze({enabled:true});\n');
 assert.equal(maintenanceSourceForAction(on,'activer'),on);
 assert.equal(maintenanceSourceForAction(on,'desactiver'),off);
 for(const action of ['',null,'force','true','false'])
  assert.throws(()=>maintenanceSourceForAction(on,action),/Expected/);
 assert.throws(()=>maintenanceSourceForAction(on+'// malicious','activer'),/unexpected/);
});
test('maintenance: public boot checks mode before importing application',()=>{
 const html=read('index.html'),boot=read('site-entry.mjs');
 assert.match(html,/src="\.\/site-entry\.mjs"/);
 assert.doesNotMatch(html,/src="\.\/app\.js"/);
 assert.match(boot,/site-maintenance-config\.mjs\?check=/);
 assert.match(boot,/window\.location\.replace\(destination\.href\)/);
 assert.match(boot,/await import\('\.\/app\.js'\)/);
 assert.ok(boot.indexOf('if(SITE_MAINTENANCE.enabled)')<boot.indexOf("await import('./app.js')"));
});
test('maintenance: standalone page is accessible and collects no data',()=>{
 const html=read('maintenance.html');
 for(const s of ['Site en maintenance','lang="fr"','id="main"','viewport','prefers-reduced-motion','assets/ecusson-boissy-uj.webp','name="robots" content="noindex, nofollow"',"default-src 'none'"])assert.ok(html.includes(s),s);
 assert.doesNotMatch(html,/<script\b|<form\b|https?:\/\//i);
 assert.match(html,/href="\.\/"/);
});
test('maintenance: manual GitHub control republishes Pages',()=>{
 const yaml=read('.github/workflows/maintenance-mode.yml');
 assert.match(yaml,/workflow_dispatch:/);
 assert.match(yaml,/- activer\s+- desactiver/);
 assert.match(yaml,/contents: write/);
 assert.match(yaml,/actions: write/);
 assert.match(yaml,/git push origin HEAD:main/);
 assert.match(yaml,/gh workflow run pages-public\.yml --ref main/);
 for(const file of ['.github/workflows/pages-public.yml','.github/workflows/tests.yml']){
  const source=read(file);
  assert.match(source,/npm run smoke:maintenance/);
  assert.match(source,/npm run smoke:browser/);
 }
});
