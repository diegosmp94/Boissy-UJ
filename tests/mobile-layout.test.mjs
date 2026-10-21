import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const mobile=css.slice(css.indexOf('/* BOISSY-UJ MOBILE HOTFIX: iPhone chapters flow v1 */'));

test('mobile layout explicitly allows content taller than the phone screen',()=>{
  assert.ok(mobile.startsWith('/* BOISSY-UJ MOBILE HOTFIX:'));
  assert.match(mobile,/\.chapter\s*\{[^}]*min-height:\s*100svh;[^}]*height:\s*auto;/s);
  assert.match(mobile,/\.chapters\s*\{\s*scroll-snap-type:\s*none;/);
});
test('headings scale down without horizontal text clipping',()=>{
  assert.match(mobile,/\.chapter\.chapter-identity \.hero-content h1\s*\{[^}]*font-size:\s*clamp\(27px,\s*8vw,\s*38px\)/s);
  assert.match(mobile,/overflow-wrap:\s*anywhere/);
  assert.match(mobile,/\.chapter \.section-heading h2/);
});
test('chapter arrows are in flow instead of overlapping CTAs or teams',()=>{
  assert.match(mobile,/\.chapter \.chapter-next\s*\{[^}]*position:\s*relative;[^}]*bottom:\s*auto;[^}]*transform:\s*none;/s);
  assert.match(js,/const arrow = next => .*data-next=/);
});
test('team cards remain responsive and mobile nav keeps bottom safe area',()=>{
  assert.match(mobile,/\.teams-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(mobile,/safe-area-inset-bottom/);
  assert.match(css,/\.bottom-nav\s*\{[^}]*env\(safe-area-inset-bottom\)/s);
});
test('reduced motion disables chapter snapping',()=>{
  assert.match(mobile,/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.chapters\s*\{\s*scroll-snap-type:\s*none;/s);
});
