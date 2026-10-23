import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 PUBLIC_CATALOG_TIMEOUT_MS,boundedPublicRequest
} from '../public-catalog-timeout.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('public catalog requests have a bounded finite deadline',async()=>{
 assert.equal(PUBLIC_CATALOG_TIMEOUT_MS,12000);
 const root=new AbortController();
 const deadline=boundedPublicRequest(root.signal,18);
 assert.equal(deadline.signal.aborted,false);
 await new Promise(r=>setTimeout(r,40));
 assert.equal(deadline.signal.aborted,true);
 deadline.dispose();
});
test('navigating away still cancels pending request and cleanly disposes timeout',()=>{
 const route=new AbortController();
 const pending=boundedPublicRequest(route.signal,1000);
 route.abort();
 assert.equal(pending.signal.aborted,true);
 pending.dispose();
 const already=new AbortController();
 already.abort();
 const preAborted=boundedPublicRequest(already.signal,1000);
 assert.equal(preAborted.signal.aborted,true);
 preAborted.dispose();
 assert.throws(()=>boundedPublicRequest(null),/route AbortSignal/);
 for(const val of [0,-10,1.2,100000])
  assert.throws(()=>boundedPublicRequest(new AbortController().signal,val),/finite/);
});
test('public catalogs display their existing truthful unavailable state on timeout rather than a permanent spinner',()=>{
 const setups=[
  ['sport-center.mjs','La source du calendrier n’est pas encore disponible'],
  ['events-center.mjs','populate(root,[],false)'],
  ['media-center.mjs','showFeed(root,[],false'],
  ['awards-center.mjs','Le catalogue Awards est momentanément indisponible']
 ];
 for(const [file,fallback] of setups){
  const code=read(file);
  assert.ok(code.includes("import {boundedPublicRequest} from './public-catalog-timeout.mjs';"),file);
  assert.match(code,/const deadline=boundedPublicRequest\((?:abort|ctrl)\.signal\)/);
  assert.match(code,/finally\{deadline\.dispose\(\);\}/);
  assert.ok(code.includes(fallback),file);
  assert.match(code,/if\s*\(?\s*(?:abort|ctrl)\.signal\.aborted/);
 }
 assert.match(read('sport-center.mjs'),/deadline\.signal/);
 assert.match(read('events-center.mjs'),/signal:deadline\.signal/);
 assert.match(read('media-center.mjs'),/signal:deadline\.signal/);
 assert.match(read('awards-center.mjs'),/fetchPublishedAwards\(deadline\.signal\)/);
});
