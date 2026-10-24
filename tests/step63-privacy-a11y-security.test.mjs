import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 assessAnonymousPublicOrigins,publicOriginAllowlist
} from '../scripts/browser-origin-policy.mjs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=read('index.html');
const css=read('styles.css');
const app=read('app.js');
const browser=read('scripts/browser-smoke.mjs');
const audit=read('scripts/audit-preview.mjs');

test('step63: static Pages CSP restricts script execution and remote connection origins',()=>{
 const csp=html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1];
 assert.ok(csp,'CSP meta must exist');
 for(const rule of [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-src 'none'",
  "form-action 'self'",
  "connect-src 'self'",
  "font-src 'self'",
  "upgrade-insecure-requests"
 ])assert.ok(csp.includes(rule),rule);
 assert.match(csp,/https:\/\/dahzewvbybujqhogumte\.supabase\.co/);
 assert.doesNotMatch(csp,/(?:script-src|connect-src)[^;]*\*/);
 assert.doesNotMatch(csp,/script-src[^;]*(?:unsafe-inline|unsafe-eval|blob:|data:)/);
 assert.doesNotMatch(csp,/https:\/\/fonts\.(?:googleapis|gstatic)\.com/);
 assert.match(html,/name="robots" content="noindex, nofollow"/);
});
test('step63: no passive Google Fonts or referrer leakage, while genuine CDN Auth is documented',()=>{
 assert.doesNotMatch(html,/<link[^>]+(?:fonts\.googleapis|fonts\.gstatic)\.com/);
 assert.match(html,/name="referrer" content="no-referrer"/);
 assert.match(app,/Les polices utilisent désormais celles du système/);
 assert.match(app,/jsDelivr pour charger la bibliothèque d'authentification/);
 assert.match(read('auth.mjs'),/import\("https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.118\.0\/\+esm"\)/);
 assert.doesNotMatch(html,/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/);
});
test('step63: anonymous network audit explicitly allows only two documented external providers',()=>{
 assert.deepEqual(publicOriginAllowlist,[
  'https://cdn.jsdelivr.net',
  'https://dahzewvbybujqhogumte.supabase.co'
 ]);
 const okay=assessAnonymousPublicOrigins([
  'https://cdn.jsdelivr.net','https://dahzewvbybujqhogumte.supabase.co',
  'https://cdn.jsdelivr.net'
 ]);
 assert.equal(okay.passed,true);
 assert.equal(okay.reviewedOrigins.length,2);
 assert.equal(okay.unreviewedOrigins.length,0);
 assert.equal(okay.containsPersonalData,false);
 assert.equal(okay.realDeviceAudit,false);
 assert.equal(Object.isFrozen(okay),true);
});
test('step63: unauthorized analytics, font, subdomains, insecure origins and credential-bearing URLs fail closed',()=>{
 for(const disallowed of [
  'https://fonts.googleapis.com','https://fonts.gstatic.com',
  'https://google-analytics.com','https://www.googletagmanager.com',
  'https://cdn.jsdelivr.net.evil.test','http://cdn.jsdelivr.net',
  'https://dahzewvbybujqhogumte.supabase.co.attacker.test',
  'https://user@cdn.jsdelivr.net','https://cdn.jsdelivr.net/path','javascript:alert(1)',
  'invalid-value'
 ]){
  const status=assessAnonymousPublicOrigins([disallowed]);
  assert.equal(status.passed,false,disallowed);
  assert.equal(status.unreviewedOrigins.length,1);
 }
 assert.throws(()=>assessAnonymousPublicOrigins(null),/origin inventory/);
 assert.throws(()=>assessAnonymousPublicOrigins([{}]),/origin inventory/);
});
test('step63: preview release gate and actual CDP browser check security controls',()=>{
 assert.match(browser,/assessAnonymousPublicOrigins\(origins\)/);
 assert.match(browser,/if\(!originAudit\.passed\)throw new Error/);
 assert.match(browser,/Static browser security policy missing/);
 assert.match(browser,/Personal navigation URL could leak via Referer/);
 assert.match(browser,/Passive third-party font request is not allowed/);
 assert.match(browser,/Account form contains unlabeled inputs/);
 assert.match(audit,/Browser CSP guard absent/);
 assert.match(audit,/External font provider reintroduced/);
 assert.match(audit,/Referrer protection is absent/);
 assert.match(audit,/Browser security policy does not pin the configured Supabase origin/);
});
test('step63: focus-visible, minimum mobile touch targets, reduced motion and Windows contrast are covered',()=>{
 assert.match(css,/:where\(input,textarea,select,summary,\[tabindex\]\):focus-visible/);
 assert.match(css,/\.bottom-nav a\{min-height:44px/);
 assert.match(css,/#menu-toggle\{min-width:44px;min-height:44px\}/);
 assert.match(css,/animation-iteration-count:1!important/);
 assert.match(css,/@media\(forced-colors:active\)/);
 assert.match(css,/font-family:system-ui,-apple-system,BlinkMacSystemFont/);
 assert.match(html,/class="skip-link" href="#main"/);
 assert.match(html,/id="main" tabindex="-1"/);
});
test('step63: strict protections keep payments and marketing trackers disabled',()=>{
 assert.doesNotMatch(html,/stripe\.com\/checkout|google-analytics\.com|connect\.facebook\.net/);
 assert.doesNotMatch(read('premium-front.mjs'),/stripe\.redirectToCheckout|sk_live_/);
 assert.match(app,/Validation juridique à compléter/);
});
