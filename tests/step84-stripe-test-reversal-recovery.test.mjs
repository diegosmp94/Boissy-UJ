import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 TEST_REVERSAL_EVENT_TYPES,projectTestReversal,requirePaidInvoicePaymentIntent,
 projectPaidTestCharge
} from '../supabase/functions/_shared/stripe-test-reversals.mjs';
import {
 STRIPE_TEST_REVERSAL_EVENTS,classifyStripeTestFinancialEvent
} from '../supabase/functions/_shared/stripe-test-financial-guards.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610270002_step84_stripe_test_reversals.sql');
const webhook=read('supabase/functions/premium-stripe-test-webhook/index.ts');
const oldSql=read('supabase/migrations/202610270001_step83_stripe_test_grants.sql');
const ts=1793070000;
const charge={id:'ch_chargetest123456',livemode:false,customer:'cus_customertest123456',
 payment_intent:'pi_payment123456',paid:true,refunded:false,disputed:false,
 amount:1000,amount_refunded:0,currency:'eur'};
const intent={id:charge.payment_intent,latest_charge:charge.id,
 customer:charge.customer,livemode:false,status:'succeeded',
 amount_received:1000,currency:'eur'};
const event=(type,obj={})=>({
 id:'evt_event123456',created:ts,type,livemode:false,
 data:{object:{livemode:false,...obj}}
});
const monthly={p_paid:true,p_event_type:'invoice.paid',
 p_source_id:'in_invoice123456',p_customer_id:charge.customer};
const annual={...monthly,p_event_type:'checkout.session.completed',
 p_source_id:'cs_test_session123456'};

test('step84: recognized Stripe reversal events are covered by both projection and durable SQL inbox',()=>{
 assert.deepEqual(TEST_REVERSAL_EVENT_TYPES,STRIPE_TEST_REVERSAL_EVENTS);
 for(const type of TEST_REVERSAL_EVENT_TYPES){
  assert.equal(classifyStripeTestFinancialEvent(event(type,{id:'re_someid123456'}),[]),'financial_hold',type);
  assert.ok(sql.includes("'"+type+"'"),type);
 }
 assert.match(sql,/STAGING ISOLÉ UNIQUEMENT/);
 assert.doesNotMatch(sql,/sk_live_|rk_live_|pk_live_/);
});
test('step84: signed refund and dispute resolve only the verified Stripe TEST charge/customer',()=>{
 for(const [type,obj] of [
  ['refund.created',{id:'re_refund123456',charge:charge.id}],
  ['refund.updated',{id:'re_refund123456',charge:charge.id}],
  ['refund.failed',{id:'re_refund123456',charge:charge.id}],
  ['charge.refund.updated',{id:'re_refund123456',charge:charge.id}],
  ['charge.refunded',{id:charge.id,customer:charge.customer,payment_intent:charge.payment_intent}],
  ['charge.dispute.created',{id:'du_dispute123456',charge:charge.id}],
  ['charge.dispute.closed',{id:'du_dispute123456',charge:charge.id}],
 ]){
  const projected=projectTestReversal(event(type,obj),charge);
  assert.deepEqual(Object.keys(projected),[
   'p_event_id','p_event_type','p_event_created_at','p_charge_id','p_customer_id'
  ]);
  assert.equal(projected.p_charge_id,charge.id);
  assert.equal(projected.p_customer_id,charge.customer);
  assert.equal(Object.hasOwn(projected,'p_source_reference'),false);
 }
});
test('step84: forged reversal links, mismatched payment intents and LIVE objects are rejected',()=>{
 const refund=event('refund.created',{id:'re_refund123456',charge:charge.id});
 for(const bad of [
  {...refund,livemode:true},
  {...refund,data:{object:{...refund.data.object,livemode:true}}},
  {...refund,data:{object:{...refund.data.object,charge:'ch_othercharge123456'}}},
  {...refund,data:{object:{...refund.data.object,payment_intent:'pi_otherintent123456'}}},
  {...refund,id:'wrong'},
 ]){
  assert.throws(()=>projectTestReversal(bad,charge));
 }
 assert.throws(()=>projectTestReversal(refund,{...charge,livemode:true}));
 assert.throws(()=>projectTestReversal(refund,{...charge,customer:'cus_no'}));
 assert.throws(()=>projectTestReversal(event('charge.dispute.created',{
  id:'re_notdispute123456',charge:charge.id
 }),charge),/Dispute ID missing/);
});
test('step84: exactly one settled Stripe invoice payment maps to the right invoice',()=>{
 const payments={has_more:false,data:[{status:'paid',invoice:monthly.p_source_id,
  payment:{type:'payment_intent',payment_intent:intent.id}}]};
 assert.equal(requirePaidInvoicePaymentIntent(payments,monthly.p_source_id),intent.id);
 for(const wrong of [
  {...payments,has_more:true},
  {...payments,data:[]},
  {...payments,data:[...payments.data,...payments.data]},
  {...payments,data:[{...payments.data[0],status:'open'}]},
  {...payments,data:[{...payments.data[0],invoice:'in_different123456'}]},
  {...payments,data:[{...payments.data[0],payment:{type:'charge',payment_intent:intent.id}}]}
 ])assert.throws(()=>requirePaidInvoicePaymentIntent(wrong,monthly.p_source_id));
});
test('step84: settled Stripe charge must match official paid invoice in amount and customer',()=>{
 const good=projectPaidTestCharge(monthly,intent,charge);
 assert.deepEqual(good,{
  p_source_reference:monthly.p_source_id,p_charge_id:charge.id,
  p_payment_intent_id:intent.id,p_customer_id:charge.customer,p_reversed:false
 });
 const yearIntent={...intent,amount_received:10000};
 const yearCharge={...charge,amount:10000};
 assert.equal(projectPaidTestCharge(annual,yearIntent,yearCharge).p_source_reference,
  'cs_test_session123456');
 for(const [pi,charged] of [
  [{...intent,amount_received:900},charge],
  [{...intent,status:'processing'},charge],
  [{...intent,customer:'cus_other123456'},charge],
  [{...intent,latest_charge:'ch_other123456'},charge],
  [intent,{...charge,amount:990}],
  [intent,{...charge,payment_intent:'pi_other123456'}],
  [intent,{...charge,paid:false}],
  [{...intent,livemode:true},charge]
 ])assert.throws(()=>projectPaidTestCharge(monthly,pi,charged));
 assert.throws(()=>projectPaidTestCharge({...monthly,p_paid:false},intent,charge));
 assert.throws(()=>projectPaidTestCharge({...monthly,p_source_id:'other'},intent,charge));
});
test('step84: partial refund or dispute causes irreversible server hold; no unrelated grant altered',()=>{
 for(const changed of [
  {...charge,amount_refunded:1},
  {...charge,refunded:true},
  {...charge,disputed:true}
 ])assert.equal(projectPaidTestCharge(monthly,intent,changed).p_reversed,true);
 for(const marker of [
  "charge_id text not null unique",
  "payment_intent_id text not null unique",
  "source_reference text primary key",
  "p.charge_id=p_charge_id and p.customer_id=p_customer_id",
  "where g.source_reference=v_source and g.revoked_at is null",
  "where g.source_reference=p_source_reference and g.revoked_at is null",
  "premium_test_grant_sources s",
  "v_link.user_id<>v_grant.user_id",
  "v_link.customer_id is distinct from p_customer_id",
  "p_reversed or v_has_reversal",
  "v_link.plan_kind='annual'",
  "v_link.plan_kind='monthly'",
 ])assert.ok(sql.includes(marker),marker);
 assert.doesNotMatch(sql,/update app_private\.premium_access_grants\s+set revoked_at[^;]*where user_id=/is);
});
test('step84: server does not display unbound TEST grants and never leaks Stripe IDs',()=>{
 for(const fn of ['app_private.member_has_active_premium()',
  'public.member_my_premium_status()']){
  const section=sql.split('create or replace function '+fn)[1];
  assert.ok(section);
  assert.ok(section.split('$fn$;')[0].includes(
   'join app_private.premium_test_charge_proofs p'),'must join bound proof');
 }
 const member=sql.split('create or replace function public.member_my_premium_status()')[1]
  .split('$fn$;')[0];
 assert.match(member,/v_user uuid:=\(select auth.uid\(\)\)/);
 assert.match(member,/g.user_id=v_user/);
 assert.doesNotMatch(member,/jsonb_build_object\([^)]*(?:charge_id|payment_intent_id|source_reference)/);
});
test('step84: duplicate signed reversals are durable, replay-safe and early delivery reconciles on bind',()=>{
 for(const marker of [
  'create table if not exists app_private.premium_test_reversal_inbox',
  'event_id text primary key',
  'where applied_at is null',
  'on conflict(event_id) do nothing',
  'Mismatched duplicate TEST reversal',
  "return 'queued'",
  "return 'applied'",
  "v_has_reversal",
  'p.charge_id=p_charge_id and p.customer_id=p_customer_id',
  'where r.charge_id=p_charge_id and r.customer_id=p_customer_id',
  'set source_reference=p_source_reference,applied_at=coalesce(applied_at,v_now)',
  'billing_test_reversal_backlog',
 ])assert.ok(sql.includes(marker),marker);
 assert.doesNotMatch(sql,/on conflict\(event_id\) do update/i);
});
test('step84: browser cannot call reconciliation or read private charge/inbox tables',()=>{
 for(const name of ['premium_test_charge_proofs','premium_test_reversal_inbox']){
  assert.ok(sql.includes('alter table app_private.'+name+' enable row level security'));
  assert.ok(sql.includes('revoke all on app_private.'+name+' from public,anon,authenticated'));
 }
 for(const name of [
  'billing_record_verified_test_reversal','billing_bind_verified_test_charge',
  'billing_test_reversal_backlog'
 ]){
  assert.ok(sql.includes('create or replace function public.'+name+'('));
  assert.ok(sql.includes('revoke all on function public.'+name+'('));
  assert.ok(sql.includes('grant execute on function public.'+name+'('));
 }
 assert.doesNotMatch(sql,/grant execute on function public\.billing_\w+\([^;]+to authenticated/is);
 assert.doesNotMatch(sql,/grant (?:select|insert|update|delete) on app_private\.[^;]+to (?:anon|authenticated)/is);
 assert.match(sql,/grant execute on function public\.member_my_premium_status\(\)\s+to authenticated/);
});
test('step84: only after Stripe signature verification may webhook persist charge binding/reversal',()=>{
 assert.ok(webhook.indexOf('stripe.webhooks.constructEventAsync')<
  webhook.indexOf('persistSignedTestReversal(stripeForBilling,config,event)'));
 for(const needle of [
  "billing_record_verified_test_reversal",
  "billing_bind_verified_test_charge",
  "requirePaidInvoicePaymentIntent(payments,event.data.object.id)",
  "stripe.invoicePayments.list",
  "stripe.paymentIntents.retrieve",
  "stripe.charges.retrieve",
  "const proof=command.p_paid",
  "await persist(config,command);",
  "if(proof)await persist(config,proof,'billing_bind_verified_test_charge')",
  "return respond('reversal_stored',200)",
  "return respond('retry_later',503)",
  "verifiedStripeTestProjectOrigin(projectUrl,projectRef)"
 ])assert.ok(webhook.includes(needle),needle);
 assert.ok(webhook.indexOf("await persistSignedTestReversal(stripeForBilling,config,event)")<
  webhook.indexOf("return respond('reversal_stored',200)"));
 assert.ok(oldSql.includes('premium_test_grant_sources'));
});
