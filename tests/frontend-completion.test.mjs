import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PREMIUM_TERMS,PREMIUM_BENEFITS,premiumPeriod,premiumComparison} from '../premium-front.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('app.js'),index=read('index.html'),css=read('premium-front.css'),ui=read('premium-front.mjs');

test('subscription periods match club-approved prices and annual has no auto-renewal',()=>{
 assert.equal(premiumPeriod('monthly').price,'10 €');
 assert.equal(premiumPeriod('annual').price,'100 €');
 assert.match(premiumPeriod('annual').terms,/Sans renouvellement automatique/);
 assert.match(premiumPeriod('monthly').terms,/Sans engagement/);
 assert.equal(premiumPeriod('invalid').id,'monthly');
 assert.equal(Object.isFrozen(PREMIUM_TERMS),true);
 assert.equal(Object.isFrozen(PREMIUM_TERMS.monthly),true);
});
test('premium features are only promised when planned, never presented as active',()=>{
 const planned=PREMIUM_BENEFITS.filter(x=>x.status==='planned');
 assert.ok(planned.length>=4);
 assert.ok(planned.every(x=>!x.free&&x.premium));
 assert.ok(PREMIUM_BENEFITS.some(x=>x.free&&x.status==='public'));
 const annual=premiumComparison('annual');
 assert.equal(annual.entitlements.length,PREMIUM_BENEFITS.length);
 annual.entitlements[0].label='overwritten';
 assert.notEqual(PREMIUM_BENEFITS[0].label,'overwritten');
});
test('premium UI uses actual keyboard-accessible toggle, not a fake checkout',()=>{
 assert.match(ui,/setAttribute\('aria-pressed'/);
 assert.match(ui,/role','group'/);
 assert.match(ui,/button\.addEventListener\('click'/);
 assert.match(ui,/root\.replaceChildren\(\)/);
 assert.match(ui,/href='#\/mon-espace'/);
 assert.match(ui,/Souscription indisponible/);
 assert.doesNotMatch(ui,/stripe|checkout|localStorage|service_role|method:'POST'|\.rpc\(|\.insert\(|\.update\(/i);
 assert.match(app,/mountPremiumPlans\(\)/);
 assert.match(app,/id="premium-plan-selector"/);
 assert.match(app,/sans renouvellement automatique/i);
 assert.match(app,/Aucun paiement actif/);
});
test('front-end routes, mobile Awards entry and supporting styles are wired',()=>{
 assert.match(index,/href="\.\/premium-front\.css"/);
 assert.match(index,/<a href="#\/awards">Awards<\/a><a href="#\/evenements">/);
 for(const route of ["'/communaute':community","'/awards':awards","'/evenements':events","'/soutenir':support"])
  assert.ok(app.includes(route),route);
 for(const cls of ['premium-comparison','fan-journey-head','fan-faq','fan-journey-grid','premium-period-choice'])
  assert.ok(css.includes('.'+cls),cls);
 assert.match(css,/@media\(max-width:620px\)/);
 assert.match(css, /prefers-reduced-motion/);
});
test('future benefits and billing disclaimers cannot trigger a transaction',()=>{
 assert.doesNotMatch(app+ui,/\bsk_live_|\bpk_live_|\/checkout|checkout\.sessions|stripe\.redirectToCheckout/i);
 for(const phrase of ['Billetterie non activée','Aucun paiement actif','sans achat possible','Aucun vote'])
  assert.match(app,new RegExp(phrase,'i'));
 assert.match(app,/Une identité, cinq équipes/);
});
