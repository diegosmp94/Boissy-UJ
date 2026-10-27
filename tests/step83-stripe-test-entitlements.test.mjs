import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectStripeTestEvent} from '../supabase/functions/_shared/stripe-test-events.mjs';
import {classifyStripeTestFinancialEvent,verifiedStripeTestProjectOrigin}
 from '../supabase/functions/_shared/stripe-test-financial-guards.mjs';

const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=file('supabase/migrations/202610270001_step83_stripe_test_grants.sql');
const statusSql=file('supabase/migrations/202610260019_premium_server_entitlements.sql');
const checkout=file('supabase/functions/premium-stripe-test-checkout/index.ts');
const webhook=file('supabase/functions/premium-stripe-test-webhook/index.ts');
const oldSql=file('supabase/migrations/202610230004_stripe_test_billing_webhook.sql');
const config=file('supabase/config.toml');
const monthly='price_monthly_123456',annual='price_annual_123456';
const ts=1793070000;
const obj=(kind,data)=>({
 id:'evt_example123456',created:ts,livemode:false,type:kind,
 data:{object:{livemode:false,...data}}
});
const line=(price,start=ts,end=ts+2592000)=>({
 quantity:1,price:{id:price,currency:'eur'},period:{start,end}
});
const opts={monthlyPriceId:monthly,annualPriceId:annual};

test('step83 is explicitly staging only and integrates step82 entitlements instead of historic Awards grants',()=>{
 assert.match(sql,/STAGING ISOLÉ UNIQUEMENT/);
 assert.match(sql,/202610260019_premium_server_entitlements/);
 assert.match(sql,/app_private\.premium_access_grants/);
 assert.match(sql,/source_kind,'verified_stripe_test'/);
 assert.doesNotMatch(sql,/app_private\.award_vote_entitlements/);
 assert.ok(oldSql.includes('app_private.award_vote_entitlements'),
  'the historic prototype is left for compatibility, never selected for step83');
 assert.match(statusSql,/app_private\.premium_access_grants/);
 assert.match(statusSql,/member_my_premium_status/);
 assert.doesNotMatch(sql,/sk_live_|pk_live_|stripe\.checkout\.sessions\.create|create subscription/i);
});
test('step83 private tables and service-only functions have explicit zero access for browsers',()=>{
 for(const table of [
  'premium_test_checkout_links','premium_test_webhook_receipts',
  'premium_test_grant_sources'
 ]){
  assert.ok(sql.includes('create table if not exists app_private.'+table));
  assert.ok(sql.includes('alter table app_private.'+table+' enable row level security'));
  assert.ok(sql.includes('revoke all on app_private.'+table+' from public,anon,authenticated'));
 }
 for(const fn of ['billing_register_test_checkout','billing_apply_verified_test_event']){
  assert.match(sql,new RegExp('create or replace function public\\.'+fn+'\\('));
  assert.match(sql,new RegExp('revoke all on function public\\.'+fn+'\\('));
  assert.match(sql,new RegExp('grant execute on function public\\.'+fn+'\\('));
 }
 assert.match(sql,/to service_role;/);
 assert.doesNotMatch(sql,/grant execute[\s\S]{0,200}to authenticated/i);
 assert.doesNotMatch(sql,/grant (select|insert|update|delete) on app_private\./i);
});
test('registered checkout -> member binding, amount and plan exclusively come from signed server checks',()=>{
 for(const marker of [
  "p_checkout_id !~ '^cs_test_",
  'and u.email_confirmed_at is not null',
  'on conflict(checkout_id) do nothing',
  'p_customer_id<>v_link.customer_id',
  'p_price_id is distinct from v_link.price_id',
  "v_link.plan_kind='monthly'",
  'NEVER grant monthly Premium from Checkout',
  'p_paid then',
  "v_expiry:=p_period_start+interval '12 months'",
  "p_period_end<=v_now",
  "'monthly',p_period_start,p_period_end",
 ])assert.ok(sql.includes(marker),marker);
 assert.match(checkout,/verifiedStripeTestProjectOrigin/);
 assert.match(checkout,/stripe\.prices\.retrieve\(priceId\)/);
 assert.match(checkout,/price\.livemode!==false/);
 assert.match(checkout,/price\.unit_amount/);
 assert.match(checkout,/billing_register_test_checkout/);
 assert.match(checkout,/if\(!response\.ok\)throw/);
});
test('idempotence and cancellation are scoped to one TEST checkout, preserving independent grants',()=>{
 for(const marker of [
  'premium_test_webhook_receipts',
  'pg_catalog.pg_advisory_xact_lock',
  'where event_id=p_event_id',
  'on conflict(source_reference) do nothing',
  'premium_test_grant_sources',
  's.source_reference=g.source_reference',
  's.checkout_id=v_link.checkout_id',
  "and g.user_id=v_link.user_id and g.plan_kind='monthly'",
  'and g.revoked_at is null',
  'v_link.closed_at is not null',
  "'invoice.payment_failed'",
 ])assert.ok(sql.includes(marker),marker);
 assert.doesNotMatch(sql,/update app_private\.premium_access_grants g set revoked_at=v_now\s+where g\.user_id=v_link\.user_id\s*;/i);
 assert.match(sql,/insert into app_private\.premium_test_webhook_receipts\(event_id,event_type\)/);
});
test('real Stripe TEST event shape maps monthly paid invoice to service source, annual to one-off grant',()=>{
 const invoice=obj('invoice.paid',{
  id:'in_invoice123456',customer:'cus_customer123456',
  currency:'eur',status:'paid',amount_paid:1000,
  parent:{subscription_details:{subscription:'sub_subscription123456'}}
 });
 const monthlyProjection=projectStripeTestEvent(invoice,{
  ...opts,lines:[line(monthly)]
 });
 assert.equal(monthlyProjection.p_source_id,'in_invoice123456');
 assert.equal(monthlyProjection.p_paid,true);
 assert.equal(monthlyProjection.p_period_end,new Date((ts+2592000)*1000).toISOString());
 assert.equal(Object.hasOwn(monthlyProjection,'p_user_id'),false);
 const annualSession=obj('checkout.session.completed',{
  id:'cs_test_session123456',customer:'cus_customer123456',
  subscription:null,mode:'payment',payment_status:'paid',
  currency:'eur',amount_total:10000,created:ts
 });
 const annualProjection=projectStripeTestEvent(annualSession,{
  ...opts,lines:[line(annual)]
 });
 assert.equal(annualProjection.p_source_id,'cs_test_session123456');
 assert.equal(annualProjection.p_paid,true);
 assert.equal(annualProjection.p_subscription_id,null);
 const monthlySession=obj('checkout.session.completed',{
  ...annualSession.data.object,
  mode:'subscription',subscription:'sub_subscription123456',
  amount_total:1000
 });
 const monthlySessionProjection=projectStripeTestEvent(monthlySession,{
  ...opts,lines:[line(monthly)]
 });
 assert.equal(monthlySessionProjection.p_paid,false);
});
test('webhook requires original Stripe signature, TEST mode, exact staging target and denies reversals pending step84',()=>{
 for(const marker of [
  'stripe.webhooks.constructEventAsync',
  'raw,signature,config.signingSecret',
  'event.livemode!==false',
  'verifiedStripeTestProjectOrigin',
  'classifyStripeTestFinancialEvent',
  "safety==='financial_hold'",
  'billing_apply_verified_test_event',
  'return respond(\'retry_later\',503)'
 ])assert.ok(webhook.includes(marker),marker);
 const event=obj('charge.refunded',{id:'ch_someid',livemode:false});
 assert.equal(classifyStripeTestFinancialEvent(event,['invoice.paid']),'financial_hold');
 assert.throws(()=>verifiedStripeTestProjectOrigin(
  'https://dahzewvbybujqhogumte.supabase.co',
  'dahzewvbybujqhogumte'));
 assert.match(config,/premium-stripe-test-webhook/);
 assert.match(config,/verify_jwt = false/);
});
