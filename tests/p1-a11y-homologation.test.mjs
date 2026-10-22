import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('app.js');
const browser=read('scripts/browser-smoke.mjs');
const html=read('index.html');

test('hash-router keyboard skip preserves route and focuses main without authenticating',()=>{
 assert.match(html,/class="skip-link" href="#main"/);
 assert.match(app,/document\.querySelector\('\.skip-link'\)\?\.addEventListener\('click',event=>/);
 assert.match(app,/event\.preventDefault\(\)/);
 assert.match(app,/main\.scrollIntoView\(\{block:'start',behavior:'instant'\}\)/);
 assert.match(app,/main\.focus\(\{preventScroll:true\}\)/);
 assert.match(browser,/Skip link replaced current SPA route/);
 assert.match(browser,/Skip link did not focus main/);
});

test('real Chromium smoke includes unauthenticated account and accessible navigation',()=>{
 assert.match(browser,/name:'mobile-account',hash:'#\/mon-espace',width:390,height:844/);
 assert.match(browser,/Account authentication mount absent/);
 assert.match(browser,/Privacy notice absent from account/);
 assert.match(browser,/Missing document language/);
 assert.match(browser,/Unlabelled header or legal control/);
 assert.match(browser,/Main landmark duplicated/);
});

test('real Chromium smoke checks reduced motion without disabling site animations for other users',()=>{
 assert.match(browser,/Emulation\.setEmulatedMedia/);
 assert.match(browser,/prefers-reduced-motion/);
 assert.match(browser,/Motion durations not reduced/);
 assert.match(browser,/features:\[\]/);
 assert.match(html,/lang="fr"/);
});

test('network observation stores only external origin names and no full URLs or cookies',()=>{
 assert.match(browser,/Network\.requestWillBeSent/);
 assert.match(browser,/new URL\(message\.params\.request\.url\)\.origin/);
 assert.match(browser,/browser-network-origins\.json/);
 assert.doesNotMatch(browser,/Network\.getAllCookies|document\.cookie|localStorage\.getItem/);
});
