import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizePublicSecurityHeaders} from '../scripts/public-security-headers.mjs';

test('public HTTP audit: missing headers are reported, never assumed',()=>{
 const report=summarizePublicSecurityHeaders(new Headers());
 assert.equal(report.checked,true);
 for(const key of ['hstsPresent','cspHttpHeaderPresent','referrerPolicyHeaderPresent','nosniffPresent','frameOptionsHeaderPresent'])
  assert.equal(report[key],false,key);
 assert.equal(report.allFiveHeadersPresent,false);
 assert.ok(Object.isFrozen(report));
});

test('public HTTP audit: presence only, no raw header values or cookies',()=>{
 const headers=new Headers({
  'strict-transport-security':'max-age=31536000',
  'content-security-policy':"default-src 'self'",
  'referrer-policy':'no-referrer',
  'x-content-type-options':'NoSniff',
  'x-frame-options':'DENY',
  'set-cookie':'session=DO_NOT_LOG_THIS_VALUE',
  'x-private-debug':'DO_NOT_LOG_THIS_VALUE'
 });
 const report=summarizePublicSecurityHeaders(headers);
 for(const key of ['hstsPresent','cspHttpHeaderPresent','referrerPolicyHeaderPresent','nosniffPresent','frameOptionsHeaderPresent'])
  assert.equal(report[key],true,key);
 assert.equal(report.allFiveHeadersPresent,true);
 assert.doesNotMatch(JSON.stringify(report),/DO_NOT_LOG_THIS_VALUE|session=|max-age|default-src/);
 assert.match(report.scope,/presence-only/);
});

test('public HTTP audit: malformed or unavailable header collection is explicitly unchecked',()=>{
 const report=summarizePublicSecurityHeaders(null);
 assert.equal(report.checked,false);
 assert.equal(report.hstsPresent,false);
 assert.equal(report.nosniffPresent,false);
 assert.equal(report.allFiveHeadersPresent,false);
 const invalid=summarizePublicSecurityHeaders({get:()=>null});
 assert.equal(invalid.checked,true);
 assert.equal(invalid.cspHttpHeaderPresent,false);
});

test('public HTTP audit: production smoke reports only sanitized entrypoint header flags',()=>{
 const source=readFileSync(new URL('../scripts/live-pages-smoke.mjs',import.meta.url),'utf8');
 assert.match(source,/summarizePublicSecurityHeaders\(response\.headers\)/);
 assert.match(source,/httpSecurityHeaders:publicHeaderAudit/);
 assert.match(source,/if\(asset\.file===''\)/);
 assert.match(source,/WARN public HTTP header hardening incomplete/);
});
