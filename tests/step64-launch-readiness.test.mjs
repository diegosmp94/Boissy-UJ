import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessBoissyFullLaunch} from '../scripts/production-readiness-report.mjs';
import {ACTIVE_WORKSTREAMS} from '../open-workstreams.mjs';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const proof={
 scope:'anonymous public HTTP only',passed:true,mainRevisionVerified:true,
 publicAssetsChecked:11,publicAssetsPassed:11,
 checks:Array.from({length:11},(_,i)=>({check:String(i),passed:true}))
};
test('step64 accepts a genuine HTTP release proof without claiming full compliance',()=>{
 const report=assessBoissyFullLaunch(proof);
 assert.equal(report.publicHttpVerified,true);
 assert.equal(report.fullProductCertified,false);
 assert.equal(report.status,'not-homologated');
 assert.equal(report.openWorkstreams,ACTIVE_WORKSTREAMS.length);
 assert.equal(report.openPriorities.p1,6);
 assert.equal(report.openPriorities.p2,6);
 assert.equal(report.openPriorities.p3,2);
 assert.equal(report.actualMemberFlowsCertified,false);
 assert.equal(report.legalApprovalCertified,false);
 assert.equal(report.iPhoneAndroidPhysicalDevicesCertified,false);
 assert.equal(report.dataRestoreCertified,false);
 assert.deepEqual(report.pending.map(x=>x.id),ACTIVE_WORKSTREAMS.map(x=>x.id));
 assert.equal(Object.isFrozen(report),true);
});
test('step64 never converts incomplete/stale/falsified public HTTP checks to ready',()=>{
 for(const evidence of [
  null,{}, {...proof,scope:'internal'},
  {...proof,passed:false},
  {...proof,mainRevisionVerified:false},
  {...proof,publicAssetsChecked:10},
  {...proof,publicAssetsPassed:10},
  {...proof,checks:proof.checks.slice(1)},
  {...proof,checks:[...proof.checks.slice(0,10),{check:'robots.txt',passed:false}]}
 ]){
  const state=assessBoissyFullLaunch(evidence);
  assert.equal(state.publicHttpVerified,false);
  assert.equal(state.fullProductCertified,false);
  assert.equal(state.status,'not-homologated');
 }
 assert.throws(()=>assessBoissyFullLaunch(null,[null]),/inventory/);
});
test('step64 no active open workstreams would only unlock human review, not automated signoff',()=>{
 const state=assessBoissyFullLaunch(proof,[]);
 assert.equal(state.openWorkstreams,0);
 assert.equal(state.status,'requires-human-signoff');
 assert.equal(state.fullProductCertified,false);
});
test('step64 CLI retains no PII, no secrets, no false certification or production modifications',()=>{
 const checker=read('scripts/production-readiness-report.mjs');
 const workflow=read('.github/workflows/pages-public.yml');
 const manual=read('.github/workflows/live-pages-smoke.yml');
 const app=read('scripts/browser-smoke.mjs');
 assert.match(checker,/production-readiness\.json/);
 assert.match(checker,/No-Go|NO-GO/i);
 assert.match(checker,/fullProductCertified:false/);
 assert.doesNotMatch(checker,/service_role|sk_live_|\.insert\(|\.update\(|\.delete\(|document\.cookie/);
 assert.match(workflow,/npm run release:acceptance/);
 assert.match(workflow,/smoke-artifacts\/production-readiness\.json/);
 assert.match(manual,/npm run release:acceptance/);
 assert.match(read('package.json'),/"release:acceptance"/);
 assert.match(app,/BROWSER PASS critical mobile SPA navigation, focus and no horizontal overflow/);
 assert.match(app,/document\.activeElement===main/);
 assert.match(app,/\.trust-auth-notice a\[href="#\/confidentialite"\]/);
 assert.match(app,/\.bottom-nav a\[href="#\/matchs"\]/);
});
