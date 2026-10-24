import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 checkPublicSiteBase,inspectPublicAsset,validatePublicReleaseRecord,
 PUBLIC_SITE_HOST,PUBLIC_SITE_PATH
} from '../scripts/public-live-validator.mjs';
import {publicReleaseRecord} from '../scripts/write-public-release.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const base='https://diegosmp94.github.io/Boissy-UJ/';
const sha='a'.repeat(40);
const report=JSON.stringify(publicReleaseRecord(sha));
test('step64 release checker pins the canonical Pages host/path and rejects unsafe alternatives',()=>{
 assert.equal(checkPublicSiteBase(base).href,base);
 assert.equal(checkPublicSiteBase('http://127.0.0.1:4222/').host,'127.0.0.1:4222');
 assert.equal(PUBLIC_SITE_HOST,'diegosmp94.github.io');
 assert.equal(PUBLIC_SITE_PATH,'/Boissy-UJ/');
 for(const url of [
  'https://diegosmp94.github.io/', 'https://diegosmp94.github.io/AnotherProject/',
  'https://diegosmp94.github.io/Boissy-UJ/?token=x',
  'https://diegosmp94.github.io/Boissy-UJ/#privacy',
  'http://diegosmp94.github.io/Boissy-UJ/',
  'https://evil.example/Boissy-UJ/', 'https://user@diegosmp94.github.io/Boissy-UJ/',
  'https://diegosmp94.github.io:443/Boissy-UJ/',
  'https://diegosmp94.github.io.evil.example/Boissy-UJ/'
 ])assert.throws(()=>checkPublicSiteBase(url),undefined,url);
});
test('step64 JSON release manifest is parsed, structure-checked and matched against exact main',()=>{
 assert.deepEqual(validatePublicReleaseRecord(report,sha),{commit:sha,mainMatched:true});
 assert.deepEqual(validatePublicReleaseRecord(report),{commit:sha,mainMatched:false});
 for(const body of [
  '', 'not-json','{}',JSON.stringify({commit:sha}),
  JSON.stringify({commit:sha,source:'staging'}),
  JSON.stringify({commit:'abc',source:'main'}),
  JSON.stringify({commit:sha,source:'main',secret:'not-allowed'}),
  JSON.stringify([publicReleaseRecord(sha)])
 ])assert.throws(()=>validatePublicReleaseRecord(body,sha));
 assert.throws(()=>validatePublicReleaseRecord(report,'b'.repeat(40)),/does not match/);
 assert.throws(()=>validatePublicReleaseRecord(report,'b'),/does not match/);
});
test('step64 detects misleading success HTTP from cross-site and within-site redirects',()=>{
 const data={base,file:'app.js',type:'script',expected:['module'],body:'export const module=1;',
  mime:'text/javascript',responseUrl:base+'app.js'};
 assert.deepEqual(inspectPublicAsset(data),{checked:true});
 for(const responseUrl of [
  'https://attacker.example/app.js',
  base,
  base+'auth.mjs',
  base+'app.js?x=1',
  base+'app.js#1'
 ])assert.throws(()=>inspectPublicAsset({...data,responseUrl}));
});
test('step64 rejects error HTML, invalid MIME and missing module content masquerading as successful assets',()=>{
 const spec={base,file:'media-center.mjs',type:'script',expected:['mountNews'],
  mime:'text/javascript',body:'export function mountNews(){}',
  responseUrl:base+'media-center.mjs'};
 assert.equal(inspectPublicAsset(spec).checked,true);
 for(const bad of [
  {mime:'text/html',body:'<html>404</html>'},
  {mime:'text/plain',body:'export function mountNews(){}'},
  {mime:'text/javascript',body:'<html>error</html>'}
 ])assert.throws(()=>inspectPublicAsset({...spec,...bad}));
 assert.equal(inspectPublicAsset({...spec,mime:'application/javascript; charset=utf-8'}).checked,true);
 const css={base,file:'styles.css',type:'css',mime:'text/css; charset=utf-8',
  body:'.topbar{display:flex}',expected:['.topbar'],responseUrl:base+'styles.css'};
 assert.equal(inspectPublicAsset(css).checked,true);
 assert.throws(()=>inspectPublicAsset({...css,mime:'text/html'}));
});
test('step64 validates existing privacy, CSP and robots on the actually served index',()=>{
 const entry={base,file:'',type:'html',mime:'text/html; charset=utf-8',
  body:read('index.html'),expected:['id="main"'],
  responseUrl:base};
 assert.equal(inspectPublicAsset(entry).checked,true);
 assert.throws(()=>inspectPublicAsset({
  ...entry,body:'<html><main id="main"></main></html>'
 }),/legal\/security/);
 const robots={base,file:'robots.txt',type:'txt',mime:'text/plain',
  body:'User-agent: *\nDisallow: /\n',expected:['User-agent: *','Disallow: /'],
  responseUrl:base+'robots.txt'};
 assert.equal(inspectPublicAsset(robots).checked,true);
 assert.throws(()=>inspectPublicAsset({...robots,body:'User-agent: *\nAllow: /\n'}));
});
test('step64 performs exact live JSON commit verification rather than naive string matching',()=>{
 const req={base,file:'release.json',type:'json',responseUrl:base+'release.json',
  expected:['"source":"main"'],mime:'application/json',expectedCommit:sha,body:report};
 assert.deepEqual(inspectPublicAsset(req),{commit:sha,mainMatched:true});
 assert.throws(()=>inspectPublicAsset({...req,body:JSON.stringify(publicReleaseRecord('b'.repeat(40)))}));
 assert.throws(()=>inspectPublicAsset({...req,mime:'text/html'}));
});
test('step64 CI records only redacted deployment evidence and never a false full homologation',()=>{
 const live=read('scripts/live-pages-smoke.mjs');
 const workflow=read('.github/workflows/pages-public.yml');
 const manual=read('.github/workflows/live-pages-smoke.yml');
 assert.match(live,/assets\.push\(\{\s*\n name:'Version de publication'/);
 assert.match(live,/file:'robots\.txt'/);
 assert.match(live,/inspectPublicAsset\(/);
 assert.match(live,/live-public-report\.json/);
 assert.match(live,/mainRevisionVerified:failed===0&&Boolean\(expectedCommit\)/);
 assert.match(live,/personalDataCollected:false/);
 assert.match(live,/accountFlowsCertified:false/);
 assert.match(live,/mobileDevicesCertified:false/);
 assert.match(workflow,/BOISSY_EXPECTED_COMMIT:\s*\$\{\{ github\.sha \}\}/);
 assert.match(workflow,/if: always\(\)/);
 assert.match(workflow,/smoke-artifacts\/live-public-report\.json/);
 assert.match(manual,/BOISSY_EXPECTED_COMMIT:\s*\$\{\{ github\.sha \}\}/);
 assert.doesNotMatch(live,/service_role|SUPABASE_SERVICE_ROLE_KEY|auth\.admin|cookie|getSession\(/);
});
