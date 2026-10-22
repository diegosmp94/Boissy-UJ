import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const browser=read('scripts/browser-smoke.mjs');
const privacy=read('scripts/privacy-inventory.mjs');
const tests=read('.github/workflows/tests.yml');
const quality=read('.github/workflows/quality.yml');

test('P1 browser smoke covers home, privacy, legal and existing Senior futsal team URL',()=>{
 for(const fragment of ["name:'mobile-home'","name:'mobile-privacy'","name:'tablet-legal'","name:'desktop-futsal'"])
  assert.ok(browser.includes(fragment),'missing '+fragment);
 assert.match(browser,/width:320,height:760/);
 assert.match(browser,/width:390,height:844/);
 assert.match(browser,/width:768,height:980/);
 assert.match(browser,/width:1366,height:850/);
 assert.match(browser,/boissy-uj-futsal/);
});
test('P1 browser smoke actually uses Chromium DevTools and captures screen images',()=>{
 assert.match(browser,/--headless=new/);
 assert.match(browser,/--remote-debugging-port=0/);
 assert.match(browser,/new WebSocket/);
 assert.match(browser,/Emulation\.setDeviceMetricsOverride/);
 assert.match(browser,/Page\.navigate/);
 assert.match(browser,/Runtime\.evaluate/);
 assert.match(browser,/Page\.captureScreenshot/);
 assert.match(browser,/screenshot|\.png/);
});
test('P1 browser smoke asserts mobile navigation, Escape focus and no horizontal overflow',()=>{
 assert.match(browser,/document\.documentElement\.scrollWidth>availableWidth\+2/);
 assert.match(browser,/document\.querySelector\('#mobile-menu'\)/);
 assert.match(browser,/new KeyboardEvent\('keydown',\{key:'Escape'/);
 assert.match(browser,/document\.activeElement!==toggle/);
 assert.match(browser,/document\.querySelectorAll\('\.chapter'\)\.length!==8/);
 assert.match(browser,/Privacy page incomplete/);
 assert.match(browser,/Legal page incomplete/);
});
test('P1 browser smoke serves only the generated dist build over loopback and never modifies backend',()=>{
 assert.match(browser,/createServer/);
 assert.match(browser,/app\.listen\(0,'127\.0\.0\.1'/);
 assert.match(browser,/const root=resolve\(process\.cwd\(\),'dist'\)/);
 assert.match(browser,/if\(file!==root&&!file\.startsWith\(root\+'\/'\)\)/);
 assert.doesNotMatch(browser,/\.supabase\.co|auth\.admin\.|\.rpc\(|service_role|sk_live_/);
});
test('P1 privacy audit inventories storage and origin usage without inspecting user data',()=>{
 assert.match(privacy,/origin /);
 assert.match(privacy,/document\.cookie/);
 assert.match(privacy,/localStorage/);
 assert.match(privacy,/sessionStorage/);
 assert.match(privacy,/privacy-inventory\.json/);
 assert.match(privacy,/googletagmanager/);
 assert.doesNotMatch(privacy,/service_role|auth\.admin\.|\.rpc\(/);
});
test('P1 browser audit is mandatory in PR tests and reports are retained without user data',()=>{
 assert.match(tests,/npm run smoke:browser/);
 assert.match(tests,/npm run audit:privacy/);
 assert.match(tests,/actions\/upload-artifact@v4/);
 assert.match(quality,/npm run audit:privacy/);
 const scripts=JSON.parse(read('package.json')).scripts;
 assert.equal(scripts['smoke:browser'],'node scripts/browser-smoke.mjs');
 assert.equal(scripts['audit:privacy'],'node scripts/privacy-inventory.mjs');
 assert.match(scripts['quality:release'],/release:check.*audit:privacy.*smoke:browser/);
});

test('P1 public Pages check is separate, read-only and manually triggered',()=>{
 const live=read('scripts/live-pages-smoke.mjs');
 const action=read('.github/workflows/live-pages-smoke.yml');
 assert.match(live,/https:\/\/diegosmp94\.github\.io\/Boissy-UJ\//);
 assert.match(live,/base\.protocol!=='https:'/);
 assert.match(live,/fetch\(url,\{method:'GET'/);
 assert.match(live,/AbortSignal\.timeout\(timeout\)/);
 assert.match(live,/Unexpected cross-site redirect/);
 assert.match(live,/name="robots" content="noindex, nofollow"/);
 assert.doesNotMatch(live,/auth\.sign|service_role|api\.rpc|\.insert\(|\.update\(|\.delete\(/);
 assert.match(action,/workflow_dispatch:/);
 assert.doesNotMatch(action,/pull_request:|schedule:/);
 const pkg=JSON.parse(read('package.json'));
 assert.equal(pkg.scripts['smoke:live'],'node scripts/live-pages-smoke.mjs');
});
test('P1 RGPD automation still requires legal sign-off and physical devices',()=>{
 const docs=read('docs/P1_BROWSER_RGPD_INVENTAIRE.md');
 assert.match(docs,/aucun utilisateur connecté/i);
 assert.match(docs,/iPhone\/Safari/);
 assert.match(docs,/restauration Supabase/i);
 assert.match(docs,/conformité RGPD/i);
 assert.match(docs,/noindex/);
});
