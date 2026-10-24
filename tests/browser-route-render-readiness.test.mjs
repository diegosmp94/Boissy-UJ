import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isReadyPublicRouteSnapshot} from '../scripts/browser-smoke-readiness.mjs';

const source=readFileSync(new URL('../scripts/browser-smoke.mjs',import.meta.url),'utf8');
const complete={path:'#/control-center',dom:'complete',mainCount:1,mainChars:385};

test('navigation hash alone is not sufficient to accept an unrendered SPA route',()=>{
 assert.equal(isReadyPublicRouteSnapshot(complete,'#/control-center'),true);
 for(const invalid of [
  {...complete,path:'#/matchs'}, {...complete,mainChars:0},
  {...complete,mainChars:60},{...complete,mainCount:0},
  {...complete,mainCount:2},{...complete,dom:'loading'},
  {...complete,mainChars:NaN},{...complete,mainChars:100.5},
  null
 ]){
  assert.equal(isReadyPublicRouteSnapshot(invalid,'#/control-center'),false);
 }
 assert.equal(isReadyPublicRouteSnapshot(complete,'not-a-route'),false);
});

test('readiness loop uses the actual #main node, consecutive frames, and fails closed on timeout',()=>{
 assert.match(source,/isReadyPublicRouteSnapshot\(value,match\)\?consecutive\+1:0/);
 assert.match(source,/if\(consecutive>=3\)return/);
 assert.match(source,/catch\{consecutive=0;\}/);
 assert.match(source,/for\(let i=0;i<160;i\+\+\)/);
 assert.match(source,/document\.querySelector\('#main'\)/);
 assert.match(source,/document\.querySelectorAll\('#main'\)\.length/);
 assert.match(source,/main\?\.textContent\?\.trim\(\)\.length\|\|0/);
 assert.match(source,/throw new Error\('Timed out waiting for stable public route content '/);
 assert.doesNotMatch(source,/if\(value\?\.path===match&&value\.dom!=='loading'&&value\.main>60\)return/);
});

test('same scenario assertions remain active, including guest admin auth and accessibility',()=>{
 for(const marker of [
  'Missing main content','Protected administration guard absent',
  'Guest obtained administrator navigation','Account authentication mount absent',
  'Horizontal page overflow','Small touch target in primary mobile navigation'
 ]){
  assert.ok(source.includes(marker),marker);
 }
 assert.match(source,/if\(result\.errors\.length\)throw new Error/);
});
