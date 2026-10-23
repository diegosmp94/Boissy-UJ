import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 STRIPE_TEST_EVENTS,projectStripeTestEvent
} from '../supabase/functions/_shared/stripe-test-events.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const migration=read('supabase/migrations/202610230004_stripe_test_billing_webhook.sql');
const webhook=read('supabase/functions/premium-stripe-test-webhook/index.ts');
const checkout=read('supabase/functions/premium-stripe-test-checkout/index.ts');
const config=read('supabase/config.toml');
const t=1700000000,monthly='price_monthly_123456',annual='price_annual_123456';
const opts={monthlyPriceId:monthly,annualPriceId:annual};
const event=(type,obj,extra={})=>({
 id:'evt_example1234567',type,created:t,livemode:false,
 data:{object:{livemode:false,...obj}},...extra
});
const customer='cus_customer123456',sub='sub_subscription123456';
const session='cs_test_session123456';
const line=(id,start=t,end=t+2592000)=>({
 quantity:1,price:{id,currency:'eur'},period:{start,end}
});
test('webhook can only project five selected TEST event types',()=>{
 assert.deepEqual(STRIPE_TEST_EVENTS,[
  'checkout.session.completed','checkout.session.async_payment_succeeded',
  'invoice.paid','invoice.payment_failed','customer.subscription.deleted'
 ]);
 assert.equal(projectStripeTestEvent(event('unknown.event',{id:'something'}),opts),null);
 assert.throws(()=>projectStripeTestEvent(event('invoice.paid',{id:'in_12345678'},{livemode:true}),{
  ...opts,lines:[line(monthly)]
 }),/Only signed TEST/);
 assert.throws(()=>projectStripeTestEvent(event('invoice.paid',{id:'in_12345678'}),{
  ...opts,monthlyPriceId:annual,lines:[line(monthly)]
 }),/price configuration/);
});
test('paid monthly invoice projects only safe fields and exact service period',()=>{
 const invoice={
  id:'in_invoice123456',customer,currency:'eur',status:'paid',amount_paid:1000,
  parent:{subscription_details:{subscription:sub}}
 };
 const cmd=projectStripeTestEvent(event('invoice.paid',invoice),{
  ...opts,lines:[line(monthly)]
 });
 assert.equal(cmd.p_subscription_id,sub);
 assert.equal(cmd.p_customer_id,customer);
 assert.equal(cmd.p_price_id,monthly);
 assert.equal(cmd.p_source_id,invoice.id);
 assert.equal(cmd.p_paid,true);
 assert.equal(cmd.p_period_start,new Date(t*1000).toISOString());
 assert.equal(cmd.p_period_end,new Date((t+2592000)*1000).toISOString());
 assert.equal(Object.hasOwn(cmd,'user_id'),false);
 assert.equal(Object.hasOwn(cmd,'email'),false);
 assert.equal(Object.hasOwn(cmd,'amount_paid'),false);
});
test('invoice without payment, period or matching plan is refused',()=>{
 const base={id:'in_invoice123456',customer,currency:'eur',status:'paid',amount_paid:1000,
  subscription:sub};
 const make=(patch={},lines=[line(monthly)])=>
  projectStripeTestEvent(event('invoice.paid',{...base,...patch}),{...opts,lines});
 assert.throws(()=>make({amount_paid:0}),/paid positive invoices/);
 assert.throws(()=>make({status:'draft'}),/paid positive invoices/);
 assert.throws(()=>make({currency:'usd'}),/Invalid TEST invoice/);
 assert.throws(()=>make({},[line(annual)]),/plan price mismatch/);
 assert.throws(()=>make({},[line(monthly),line(monthly)]),/Single recognized/);
 assert.throws(()=>make({},[{...line(monthly),period:{start:t,end:t}}]),/service period/);
 assert.throws(()=>make({subscription:null}),/association unavailable/);
 const failed=projectStripeTestEvent(event('invoice.payment_failed',{
  ...base,status:'open',amount_paid:0
 }),{...opts,lines:[line(monthly)]});
 assert.equal(failed.p_paid,false);
 assert.equal(failed.p_period_start,null);
});
test('checkout session binds plan, but monthly session never creates Premium access',()=>{
 const monthlySession={id:session,customer,subscription:sub,created:t,
  mode:'subscription',payment_status:'paid',currency:'eur',amount_total:1000};
 const result=projectStripeTestEvent(event('checkout.session.completed',monthlySession),{
  ...opts,lines:[line(monthly)]
 });
 assert.equal(result.p_checkout_id,session);
 assert.equal(result.p_subscription_id,sub);
 assert.equal(result.p_paid,false);
 assert.equal(result.p_period_start,null);
 assert.throws(()=>projectStripeTestEvent(event('checkout.session.completed',{
  ...monthlySession,subscription:null
 }),{...opts,lines:[line(monthly)]}),/identify Stripe Subscription/);
});
test('annual paid Checkout is one-time, fixed EUR 100 and never a recurring subscription',()=>{
 const annualSession={id:session,customer,subscription:null,created:t,
  mode:'payment',payment_status:'paid',currency:'eur',amount_total:10000};
 const project=(obj)=>projectStripeTestEvent(event('checkout.session.completed',obj),{
  ...opts,lines:[line(annual)]
 });
 const paid=project(annualSession);
 assert.equal(paid.p_paid,true);
 assert.equal(paid.p_source_id,session);
 assert.equal(paid.p_period_start,new Date(t*1000).toISOString());
 assert.equal(paid.p_subscription_id,null);
 assert.equal(project({...annualSession,payment_status:'unpaid'}).p_paid,false);
 assert.throws(()=>project({...annualSession,amount_total:9900}),/100 EUR/);
 assert.throws(()=>project({...annualSession,subscription:sub}),/must not recur/);
 assert.throws(()=>projectStripeTestEvent(event('checkout.session.completed',annualSession),{
  ...opts,lines:[line(monthly)]
 }),/plan price mismatch/);
});
test('subscription deletion is tied to exact test customer and monthly price',()=>{
 const obj={id:sub,customer,items:{data:[line(monthly)]}};
 const result=projectStripeTestEvent(event('customer.subscription.deleted',obj),opts);
 assert.equal(result.p_event_type,'customer.subscription.deleted');
 assert.equal(result.p_subscription_id,sub);
 assert.equal(result.p_paid,false);
 assert.throws(()=>projectStripeTestEvent(event('customer.subscription.deleted',{
  ...obj,items:{data:[line(annual)]}
 }),opts),/plan price mismatch/);
});
test('private billing SQL denies direct access, repeat events and delayed old paid invoices',()=>{
 for(const phrase of [
  'create table if not exists app_private.premium_test_checkout_links',
  'create table if not exists app_private.premium_test_webhook_receipts',
  'enable row level security',
  'revoke all on app_private.premium_test_checkout_links from public,anon,authenticated',
  'revoke all on app_private.premium_test_webhook_receipts from public,anon,authenticated',
  'grant execute on function public.billing_register_test_checkout',
  'grant execute on function public.billing_apply_verified_test_event',
  'to service_role',
  'pg_catalog.pg_advisory_xact_lock',
  'if exists(select 1 from app_private.premium_test_webhook_receipts',
  "and p_event_type<>'customer.subscription.deleted'",
  "and p_event_type not in ('customer.subscription.deleted','invoice.paid') then",
  'if v_link.closed_at is not null',
  "v_link.plan_kind='monthly'",
  "v_link.plan_kind='annual'",
  "p_paid and p_period_start is not null",
  "v_expire:=p_period_start+interval '12 months'",
  'p_period_end<=v_now',
  'e.valid_until>=p_period_end',
  'on conflict(user_id) do update',
  "where e.user_id=v_link.user_id and e.revoked_at is null",
  "and e.source_reference=v_link.last_grant_source",
  "last_grant_source=p_source_id"
 ])assert.ok(migration.includes(phrase),phrase);
 assert.doesNotMatch(migration,/grant execute .* to authenticated/i);
 assert.doesNotMatch(migration,/grant (select|insert|update|delete) on app_private/i);
 assert.doesNotMatch(migration,/insert into public\.user_roles/i);
});
test('Edge webhook enforces Stripe raw signature, TEST-only key and service RPC',()=>{
 for(const phrase of [
  'new Stripe(config.apiKey', 'STRIPE_TEST_RESTRICTED_KEY',
  'STRIPE_TEST_WEBHOOK_SECRET','BOISSY_TEST_WEBHOOK_ACK',
  'stripe.webhooks.constructEventAsync',
  'raw,signature,config.signingSecret',
  'Stripe.createSubtleCryptoProvider()',
  "event.livemode!==false",
  'billing_apply_verified_test_event',
  "if(!response.ok)throw",
  "return respond('retry_later',503)",
  'checkout.sessions.listLineItems',
  'invoices.listLineItems'
 ])assert.ok(webhook.includes(phrase),phrase);
 assert.match(config,/\[functions\.premium-stripe-test-webhook\]\s*verify_jwt = false/);
 assert.doesNotMatch(webhook,/console\.log|console\.error|Deno\.env\.get\('STRIPE_LIVE/i);
});
test('Checkout TEST endpoint requires verified user, pinned prices, exact origin and private binding',()=>{
 for(const phrase of [
  "BOISSY_TEST_CHECKOUT_ACK",
  'YES_ENABLE_CHECKOUT_ONLY_ON_ISOLATED_STAGING',
  'SUPABASE_ANON_KEY','/auth/v1/user',
  'email_confirmed_at',
  'BOISSY_STAGING_ORIGIN',
  'price.unit_amount',
  'price.livemode!==false',
  'price.recurring?.interval',
  'price.type',
  'stripe.checkout.sessions.create',
  'integration_identifier:integrationId()',
  'billing_register_test_checkout',
  "if(!response.ok)throw",
  'stripe.checkout.sessions.expire',
  "body.period==='monthly'?'subscription':'payment'"
 ])assert.ok(checkout.includes(phrase),phrase);
 assert.match(checkout,/req.headers.get\('authorization'\)/);
 assert.match(checkout,/match\(\/\^Bearer/);
 assert.match(config,/\[functions\.premium-stripe-test-checkout\]\s*verify_jwt = true/);
 assert.doesNotMatch(checkout,/metadata.*user_id|client_reference_id|sk_live_|stripe\.redirectToCheckout/i);
 assert.doesNotMatch(checkout,/automatic_tax\s*:/);
});
