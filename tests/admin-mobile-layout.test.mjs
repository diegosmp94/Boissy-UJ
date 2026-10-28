import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const css=read('admin-console.css');
const app=read('app.js');
const smoke=read('scripts/browser-smoke.mjs');
test('admin route mounts directly in #main, outside page-shell and below fixed header on mobile',()=>{
 assert.match(app,/function controlCenter\(\)\{return adminCenterMarkup\(\);\}/);
 assert.match(css,/#main:has\(> \.real-admin-root\)\s*\{[\s\S]*?padding-top:76px/);
 assert.match(css,/@media\(max-width:760px\)\s*\{[\s\S]*?#main:has\(> \.real-admin-root\)\s*\{\s*padding-top:65px/);
 assert.match(css,/#main > \.real-admin-root\s*\{[\s\S]*?min-width:0/);
});
test('mobile access denial is compact and avoids the huge empty 65vh area',()=>{
 assert.match(css,/\.real-admin-root:has\(> \.admin-empty\)\s*\{\s*min-height:0/);
 assert.match(css,/\.real-admin-root > \.admin-empty/);
 assert.match(css,/\.real-admin-root > \.admin-console-back/);
 assert.match(css,/padding-bottom:calc\(86px \+ env\(safe-area-inset-bottom,0px\)\)/);
});
test('signed-in admin layout stays responsive with form fields, nested cards and safe touch targets',()=>{
 assert.match(css,/\.real-admin-layout\s*\{\s*display:grid;\s*grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.real-admin-sidebar,\.real-admin-pane/);
 assert.match(css,/\.real-admin-root :where\(input:not\(\[type=checkbox\]\),textarea,select\)/);
 assert.match(css,/font-size:16px/);
 assert.match(css,/\.real-admin-root > \.admin-console-back\s*\{[\s\S]*?min-height:44px/);
 assert.match(css,/@media\(max-width:360px\)/);
});
test('browser smoke checks the admin panel is not covered by the mobile header',()=>{
 assert.match(smoke,/mobile-admin-guest/);
 assert.match(smoke,/mobile-admin-compact/);
 assert.match(smoke,/Admin content hidden behind fixed header/);
 assert.match(smoke,/Guest obtained administrator navigation/);
});
test('display fixes do not alter login roles, grant privileges or bypass MFA',()=>{
 const control=read('admin-center.mjs');
 assert.match(control,/!canOpenAdmin\(verified,supabaseConfig\.adminEnabled\)/);
 assert.match(control,/!canOpenAdmin\(postProbeStatus,supabaseConfig\.adminEnabled\)/);
 assert.match(control,/const check=await adminSessionStatus\(api,verified\.userId\)/);
 assert.doesNotMatch(css,/service_role|admin\.setUser|sk_live_/i);
});
