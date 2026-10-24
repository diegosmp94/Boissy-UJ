import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 STRIPE_TEST_REVERSAL_EVENTS,classifyStripeTestFinancialEvent,
 validPremiumTestAmount
} from '../supabase/functions/_shared/stripe-test-financial-guards.mjs';
import {
 STRIPE_TEST_EVENTS,projectStripeTestEvent
} from '../supabase/functions/_shared/stripe-test-events.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const event=(type,patch={})=>({
 id:'evt_approved123456',type,livemode:false,
 data:{object:{livemode:false,id:'re_eventtest123456'}},...patch
});
const opts={monthlyPriceId:'price_monthly_123456',
 annualPriceId:'price_annual_123456'};
const baseDate=1700000000;
const invoice=(amount_paid)=>({
 id:'in_invoice123456',customer:'cus_customer123456',
 currency:'eur',status:'paid',amount_paid,
 subscription:'sub_subscription123456'
});
const checkout=(amount_total,mode,options={})=>({
 id:'cs_test_session123456',customer:'cus_customer123456',
 currency:'eur',mode,created:baseDate,
 amount_total,payment_status:'paid',
 subscription:mode==='subscription'?'sub_subscription123456':null,...options
});
const lines=(price)=>[{quantity:1,price:{id:price,currency:'eur'},
 period:{start:baseDate,end:baseDate+2592000}}];
const signed=(type,obj)=>({id:'evt_signed123456',type,livemode:false,
 created:baseDate,data:{object:{livemode:false,...obj}}});

test('step 60: every recognized refund and dispute is put on a financial hold, never ignored',()=>{
 assert.ok(STRIPE_TEST_REVERSAL_EVENTS.length>=8);
 assert.equal(new Set(STRIPE_TEST_REVERSAL_EVENTS).size,STRIPE_TEST_REVERSAL_EVENTS.length);
 for(const type of STRIPE_TEST_REVERSAL_EVENTS)
  assert.equal(classifyStripeTestFinancialEvent(event(type),STRIPE_TEST_EVENTS),'financial_hold',type);
 for(const type of STRIPE_TEST_EVENTS)
  assert.equal(classifyStripeTestFinancialEvent(event(type),STRIPE_TEST_EVENTS),'billing',type);
 assert.equal(classifyStripeTestFinancialEvent(event('unknown.provider.message'),STRIPE_TEST_EVENTS),'ignore');
});
test('step 60: live, unsigned-looking or malformed reversal objects do not pass the guard',()=>{
 for(const bad of [
  {...event('refund.created'),livemode:true},
  {...event('refund.updated'),id:'not-a-stripe-event'},
  {...event('refund.updated'),data:{object:{livemode:true}}},
  {...event('charge.dispute.created'),data:null},
  {...event('refund.created'),data:{object:null}},
  null
 ])assert.throws(()=>classifyStripeTestFinancialEvent(bad,STRIPE_TEST_EVENTS));
 assert.throws(()=>classifyStripeTestFinancialEvent(event('invoice.paid'),null));
});
test('step 60: only exactly 10 EUR monthly and 100 EUR nonrecurring are eligible',()=>{
 for(const [kind,amount] of [['monthly',1000],['annual',10000]]){
  assert.equal(validPremiumTestAmount({kind,amount,currency:'eur'}),true);
  for(const currency of ['usd','gbp',null])
   assert.equal(validPremiumTestAmount({kind,amount,currency}),false);
  for(const value of [0,-1,1,99,999,1001,9999,10001,amount-1,amount+1,'1000',NaN,1.5,Infinity])
   assert.equal(validPremiumTestAmount({kind,amount:value,currency:'eur'}),false,String(value));
 }
 assert.equal(validPremiumTestAmount({kind:'donation',amount:1000,currency:'eur'}),false);
});
test('step 60: signed TEST Checkout must have full approved EUR amount',()=>{
 for(const [mode,expectedPrice,correct] of [
  ['subscription',opts.monthlyPriceId,1000],
  ['payment',opts.annualPriceId,10000]
 ]){
  const type='checkout.session.completed';
  assert.equal(projectStripeTestEvent(signed(type,checkout(correct,mode)),{
   ...opts,lines:lines(expectedPrice)
  }).p_price_id,expectedPrice);
  for(const bad of [0,500,999,1001,9999,10001]){
   if(bad===correct)continue;
   assert.throws(()=>projectStripeTestEvent(signed(type,checkout(bad,mode)),{
    ...opts,lines:lines(expectedPrice)
   }),/amount must be/);
  }
 }
});
test('step 60: invoice.paid cannot grant Premium for partial payments or proration',()=>{
 const valid=projectStripeTestEvent(signed('invoice.paid',invoice(1000)),{
  ...opts,lines:lines(opts.monthlyPriceId)
 });
 assert.equal(valid.p_paid,true);
 for(const wrong of [0,1,500,999,1001,2000]){
  assert.throws(()=>projectStripeTestEvent(signed('invoice.paid',invoice(wrong)),{
   ...opts,lines:lines(opts.monthlyPriceId)
  }),/exactly 10 EUR/);
 }
 const failed=projectStripeTestEvent(signed('invoice.payment_failed',{
  ...invoice(0),status:'open'
 }),{...opts,lines:lines(opts.monthlyPriceId)});
 assert.equal(failed.p_paid,false);
});
test('step 60: signed webhook refuses to acknowledge reversal and never logs PII',()=>{
 const webhook=read('supabase/functions/premium-stripe-test-webhook/index.ts');
 const shared=read('supabase/functions/_shared/stripe-test-events.mjs');
 const safety=read('supabase/functions/_shared/stripe-test-financial-guards.mjs');
 assert.match(webhook,/stripe\.webhooks\.constructEventAsync/);
 assert.match(webhook,/classifyStripeTestFinancialEvent\(event,STRIPE_TEST_EVENTS\)/);
 assert.match(webhook,/if\(safety==='financial_hold'\)return respond\('reversal_needs_reconciliation',503\)/);
 assert.match(webhook,/if\(safety==='ignore'\)return respond\('ignored',200\)/);
 assert.ok(webhook.indexOf('classifyStripeTestFinancialEvent')<webhook.indexOf('projectStripeTestEvent(event'));
 assert.doesNotMatch(webhook,/console\.(log|error)|sk_live_|rk_live_|writeFile/);
 assert.doesNotMatch(shared+safety,/\.insert\(|\.update\(|\.delete\(|checkout\.sessions\.create/);
});
test('step 60: no funds, donations or LIVE UI changes accompany financial guard',()=>{
 const frontend=read('premium-front.mjs'),index=read('index.html');
 assert.match(frontend,/Souscription indisponible/);
 assert.match(frontend,/Aucun achat, renouvellement ou accès payant n’est disponible/);
 assert.doesNotMatch(frontend+index,/stripe\.redirectToCheckout|checkout\.sessions\.create|sk_live_/);
});
