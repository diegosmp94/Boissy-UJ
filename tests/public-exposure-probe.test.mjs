import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {INTERNAL_PUBLIC_PATHS,isInternalPathBlocked} from '../scripts/public-exposure-probe.mjs';

test('internal public path probes accept only explicit denial or absence',()=>{
 for(const status of [401,403,404,410])assert.equal(isInternalPathBlocked(status),true);
 for(const status of [0,200,204,206,301,302,307,308,429,500,503])
  assert.equal(isInternalPathBlocked(status),false,status);
});
test('internal public probes use a small, canonical, static path allowlist',()=>{
 assert.equal(INTERNAL_PUBLIC_PATHS.length,4);
 assert.equal(new Set(INTERNAL_PUBLIC_PATHS).size,INTERNAL_PUBLIC_PATHS.length);
 assert.ok(Object.isFrozen(INTERNAL_PUBLIC_PATHS));
 for(const path of INTERNAL_PUBLIC_PATHS){
  assert.match(path,/^[a-zA-Z0-9._/-]+$/);
  assert.ok(!path.startsWith('/')&&!path.includes('..')&&!path.includes('//'));
 }
 assert.ok(INTERNAL_PUBLIC_PATHS.some(x=>x.startsWith('.github/')));
 assert.ok(INTERNAL_PUBLIC_PATHS.some(x=>x.startsWith('supabase/')));
});
test('live probe requests HEAD only and never follows redirects or reads private response bodies',()=>{
 const source=readFileSync(new URL('../scripts/live-pages-smoke.mjs',import.meta.url),'utf8');
 assert.match(source,/for\(const path of INTERNAL_PUBLIC_PATHS\)/);
 assert.match(source,/method:'HEAD',redirect:'manual'/);
 assert.match(source,/isInternalPathBlocked\(response\.status\)/);
 assert.match(source,/privatePathChecks/);
 assert.match(source,/privatePathsBlocked/);
 assert.doesNotMatch(source,/response\.arrayBuffer\(\)|response\.json\(\)/);
});
test('negative-path results cannot silently certify a public deployment',()=>{
 const source=readFileSync(new URL('../scripts/live-pages-smoke.mjs',import.meta.url),'utf8');
 assert.match(source,/if\(!passed\)failed\+\+/);
 assert.match(source,/passed:failed===0/);
 assert.match(source,/privatePathsChecked:privatePathChecks\.length/);
 assert.match(source,/privatePathsBlocked:privatePathChecks\.filter\(x=>x\.blocked\)\.length/);
});
