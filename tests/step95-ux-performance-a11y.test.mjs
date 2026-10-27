import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findLocalStylesheets,buildPublicCssBundle,
 PUBLIC_CSS_BUNDLE} from '../scripts/css-bundle.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('index.html');
const all=findLocalStylesheets(html);
const sources=new Map(all.map(p=>[p,read(p)]));
const app=read('app.js');
const css=read('styles.css');
const builder=read('scripts/build-preview.mjs');
const validator=read('scripts/audit-preview.mjs');
const browser=read('scripts/browser-smoke.mjs');

test('step95: existing ordered CSS requests are consolidated to one local, same-origin stylesheet',()=>{
 assert.ok(all.length>=20);
 assert.equal(all[0],'styles.css');
 assert.equal(new Set(all).size,all.length);
 const optimized=buildPublicCssBundle(html,sources);
 assert.equal(optimized.names.length,all.length);
 assert.equal(optimized.names[0],all[0]);
 assert.equal(optimized.names.at(-1),all.at(-1));
 assert.equal([...optimized.html.matchAll(/rel="stylesheet"/g)].length,1);
 assert.match(optimized.html,/href="\.\/site-bundle\.css"/);
 assert.equal(optimized.css.includes('/* SOURCE '+all[0]+' */'),true);
 assert.equal(optimized.css.includes('/* SOURCE '+all.at(-1)+' */'),true);
 for(const p of all){
  assert.ok(optimized.css.includes('/* SOURCE '+p+' */'),p);
  assert.ok(optimized.css.includes(sources.get(p)),p);
 }
 assert.equal(optimized.html.includes('name="robots" content="noindex, nofollow"'),true);
 assert.equal(optimized.html.includes('Content-Security-Policy'),true);
 assert.equal(PUBLIC_CSS_BUNDLE,'site-bundle.css');
});
test('step95: bundle refuses duplicate styles, remote styles and injected stylesheet paths',()=>{
 const repeated=html.replace('<link rel="stylesheet" href="./styles.css" />',
  '<link rel="stylesheet" href="./styles.css" />\n<link rel="stylesheet" href="./styles.css" />');
 assert.throws(()=>findLocalStylesheets(repeated));
 assert.throws(()=>findLocalStylesheets(html.replace(
  '<link rel="stylesheet" href="./styles.css" />',
  '<link rel="stylesheet" href="https://example.invalid/malware.css" />')));
 assert.throws(()=>findLocalStylesheets(html.replace(
  '<link rel="stylesheet" href="./styles.css" />',
  '<link rel="stylesheet" href="./../secret.css" />')));
 assert.throws(()=>buildPublicCssBundle(html,new Map()));
 assert.throws(()=>buildPublicCssBundle(html,new Map([...sources,
  ['extra.css','bad']])));
 assert.throws(()=>buildPublicCssBundle(html,new Map([...sources].map(
  ([p,contents])=>[p,p==='styles.css'?'@import url("evil.css");':contents]))));
});
test('step95: release builder and auditor require static bundle and preserve original source directory',()=>{
 assert.match(builder,/buildPublicCssBundle\(originalHtml,cssSources\)/);
 assert.match(builder,/writeFile\(join\(dist,PUBLIC_CSS_BUNDLE\),optimized\.css\)/);
 assert.match(builder,/writeFile\(join\(dist,'index\.html'\),optimized\.html\)/);
 assert.match(validator,/Pages build must load exactly one local CSS bundle/);
 assert.match(validator,/Missing CSS source ordering and coverage in bundle/);
 assert.doesNotMatch(builder,/fetch\(|https?:\/\/|sk_live_|service_role|\.env/);
});
test('step95: mobile inputs avoid auto-zoom and keyboard focus is visible',()=>{
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/font-size:16px/);
 assert.match(css,/:focus-visible/);
 assert.match(css,/outline:3px solid #f0c56e/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/scroll-snap-type:none!important/);
 assert.match(css,/@media\(forced-colors:active\)/);
 assert.match(html,/tabindex="-1"/);
 assert.match(browser,/Skip link did not focus main/);
});
test('step95: images below fold are lazily decoded with explicit dimensions, hero prioritized',()=>{
 assert.match(app,/class="hero-crest"[^>]*fetchpriority="high" decoding="async"/);
 assert.match(app,/class="team-symbol" aria-hidden="true"><img[^>]*loading="lazy" decoding="async" width="96" height="96"/);
 assert.match(app,/class="join-watermark"[^>]*loading="lazy" decoding="async" width="320" height="320"/);
 assert.match(app,/if\(reduced\|\|seen\)intro\.remove\(\)/);
 assert.match(app,/if\(hasRenderedRoute\)main\.focus\(\{preventScroll:true\}\)/);
});
