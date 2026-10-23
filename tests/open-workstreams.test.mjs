import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ACTIVE_WORKSTREAMS,remainingWorkstreams,workstreamCounts} from '../open-workstreams.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const admin=read('admin-readiness.mjs');
test('open workstreams contain no already-completed deliverables',()=>{
 assert.equal(new Set(ACTIVE_WORKSTREAMS.map(w=>w.id)).size,ACTIVE_WORKSTREAMS.length);
 assert.ok(ACTIVE_WORKSTREAMS.length>=10);
 assert.ok(ACTIVE_WORKSTREAMS.every(w=>w.title&&w.next&&w.dependency&&['P1','P2','P3'].includes(w.priority)));
 assert.ok(ACTIVE_WORKSTREAMS.every(w=>!(/socle visuel livré|navigation livrée|diagnostic livré/i).test(w.title)));
 assert.ok(ACTIVE_WORKSTREAMS.some(w=>w.id==='p1-recovery'));
 assert.ok(ACTIVE_WORKSTREAMS.some(w=>w.id==='p1-rls'));
});
test('a working module leaves the active technical chantier list, without ending legal approvals',()=>{
 const all=remainingWorkstreams([]);
 assert.ok(all.some(w=>w.id==='p2-media'));
 assert.ok(all.some(w=>w.id==='p2-reactions'));
 const half=remainingWorkstreams([
  {id:'media',status:'accessible'},
  {id:'media-preflight',status:'unverified'},
  {id:'reactions',status:'accessible'}
 ]);
 assert.ok(half.some(w=>w.id==='p2-media'));
 assert.ok(!half.some(w=>w.id==='p2-reactions'));
 const complete=remainingWorkstreams([
  {id:'media',status:'accessible'},
  {id:'media-preflight',status:'accessible'},
  {id:'reactions',status:'accessible'}
 ]);
 assert.ok(!complete.some(w=>w.id==='p2-media'));
 assert.ok(!complete.some(w=>w.id==='p2-reactions'));
 assert.ok(complete.some(w=>w.id==='p1-rgpd'));
 assert.ok(complete.some(w=>w.id==='p1-rls'));
 assert.ok(complete.some(w=>w.id==='p1-recovery'));
});
test('unknown statuses never clear a workstream and counts equal actual open items',()=>{
 const remaining=remainingWorkstreams([{id:'media',status:'accessible'},{id:'media-preflight',status:'failed'}]);
 assert.ok(remaining.some(x=>x.id==='p2-media'));
 const counts=workstreamCounts(remaining);
 assert.equal(counts.total,remaining.length);
 assert.equal(counts.p1+counts.p2+counts.p3,remaining.length);
});
test('admin panel renders only active workstreams and hides passed probes behind disclosure',()=>{
 assert.match(admin,/remainingWorkstreams\(checks\)/);
 assert.match(admin,/pendingList\.replaceChildren\(\)/);
 assert.match(admin,/for\(const priority of \['P1','P2','P3'\]\)/);
 assert.match(admin,/admin-workstream-item/);
 assert.match(admin,/details=el\('details','admin-readiness-technical'\)/);
 assert.match(admin,/results\.append\(details\)/);
 assert.match(admin,/adminSessionStatus\(api,userId\)/);
 assert.doesNotMatch(admin,/innerHTML|service_role/);
});
