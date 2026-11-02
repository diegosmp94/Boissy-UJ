import test from 'node:test';
import assert from 'node:assert/strict';
import {assessBoissyFullLaunch} from '../scripts/production-readiness-report.mjs';

const essential=[
 'index.html','app.js','styles.css','club-teams.mjs','auth.mjs',
 'sport-center.mjs','media-center.mjs','home-next-match.mjs',
 'premium-front.css','site-maintenance-config.mjs','site-entry.mjs',
 'maintenance.html','release.json','robots.txt'
];
function evidence(checks=essential.map(check=>({check,passed:true}))){
 return {
  scope:'anonymous public HTTP only',
  passed:true,
  mainRevisionVerified:true,
  commitExpected:'a'.repeat(40),
  publicAssetsChecked:checks.length,
  publicAssetsPassed:checks.length,
  checks
 };
}
function assess(input){
 return assessBoissyFullLaunch(input,[]);
}
test('release evidence: all unique essential checks permit human review only',()=>{
 const result=assess(evidence());
 assert.equal(result.publicHttpVerified,true);
 assert.equal(result.status,'requires-human-signoff');
 assert.equal(result.fullProductCertified,false);
});
test('release evidence: duplicate asset cannot replace a missing required check',()=>{
 const checks=essential.map(check=>({check,passed:true}));
 checks[checks.length-1]={check:'index.html',passed:true};
 assert.equal(assess(evidence(checks)).publicHttpVerified,false);
});
test('release evidence: unrelated successful check cannot replace a required check',()=>{
 const checks=essential.map(check=>({check,passed:true}));
 checks[checks.length-1]={check:'unrelated.txt',passed:true};
 assert.equal(assess(evidence(checks)).publicHttpVerified,false);
});
test('release evidence: expected full commit SHA and verified main are mandatory',()=>{
 const noSha=evidence();
 noSha.commitExpected=null;
 assert.equal(assess(noSha).publicHttpVerified,false);
 const unverified=evidence();
 unverified.mainRevisionVerified=false;
 assert.equal(assess(unverified).publicHttpVerified,false);
});
test('release evidence: future extra checks are allowed only when unique and passing',()=>{
 const extra=evidence([...evidence().checks,{check:'additional-public-file.css',passed:true}]);
 assert.equal(assess(extra).publicHttpVerified,true);
 const failed=evidence([...evidence().checks,{check:'additional-public-file.css',passed:false}]);
 assert.equal(assess(failed).publicHttpVerified,false);
});
