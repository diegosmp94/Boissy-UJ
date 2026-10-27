import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 stripeId,verifiedTestTicketCheckout,verifyTestTicketCharge,
 verifyTestTicketReversal
} from '../supabase/functions/_shared/stripe-test-ticket-verification.mjs';
import {normalizeTestTicketOffer,normalizeTestTicketOrder,
 safeStripeTestCheckoutUrl} from '../member-paid-ticket-test.mjs';
import {canUseFreeTickets,FREE_TICKET_STAGING} from '../free-ticket-staging-config.mjs';

const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610270009_step90_stripe_test_event_tickets.sql');
const checkout=read('supabase/functions/event-ticket-stripe-test-checkout/index.ts');
const webhook=read('supabase/functions/event-ticket-stripe-test-webhook/index.ts');
const config=read('supabase/config.toml');
const portal=read('member-paid-ticket-test.mjs');
const member=read('auth.mjs');
const eventId='11111111-1111-4111-8111-111111111111';
const checkoutId='cs_test_123456789abc';
const customer='cus_customer12345';
const piId='pi_intent123456';
const chargeId='ch_charge123456';
const event={
 id:'evt_signed123456',livemode:false,type:'checkout.session.completed',
 data:{object:{livemode:false,id:checkoutId,mode:'payment',
 currency:'eur',customer,amount_total:1500,payment_intent:piId,payment_status:'paid'}}
};
const line={quantity:1,amount_total:1500,price:{
 id:'price_ticket1234',product:'prod_eventticket123',livemode:false,
 currency:'eur',unit_amount:1500,type:'one_time',recurring:null}};
const intent={
 id:piId,livemode:false,status:'succeeded',
 currency:'eur',amount_received:1500,customer,
 latest_charge:chargeId};
const charge={id:chargeId,livemode:false,paid:true,currency:'eur',
 amount:1500,customer,payment_intent:piId,
 refunded:false,disputed:false,amount_refunded:0};

test('step90: signed Stripe TEST Checkout must match exact unique product, card payment and amount',()=>{
 const normalized=verifiedTestTicketCheckout(event,[line],'prod_eventticket123');
 assert.deepEqual(normalized,{checkoutId,amountCents:1500,
  customerId:customer,paymentIntentId:piId,paid:true});
 for(const [e,lines,product] of [
  [{...event,livemode:true},[line],'prod_eventticket123'],
  [event,[line,line],'prod_eventticket123'],
  [event,[line],'prod_other123456'],
  [event,[{...line,amount_total:1499}],'prod_eventticket123'],
  [event,[{...line,price:{...line.price,type:'recurring'}}],'prod_eventticket123'],
  [event,[{...line,price:{...line.price,livemode:true}}],'prod_eventticket123'],
  [{...event,data:{object:{...event.data.object,amount_total:1550}}},[line],'prod_eventticket123'],
  [{...event,data:{object:{...event.data.object,currency:'usd'}}},[line],'prod_eventticket123']
 ])assert.throws(()=>verifiedTestTicketCheckout(e,lines,product));
 assert.equal(stripeId({id:piId}),piId);
});
test('step90: payment proof requires one confirmed matched TEST intent and Charge',()=>{
 assert.deepEqual(verifyTestTicketCharge(intent,charge,1500,customer),{
  paymentIntentId:piId,chargeId,reversed:false});
 assert.equal(verifyTestTicketCharge(intent,{...charge,amount_refunded:100},1500,customer).reversed,true);
 for(const [p,c,amount,who] of [
  [{...intent,livemode:true},charge,1500,customer],
  [{...intent,status:'processing'},charge,1500,customer],
  [{...intent,amount_received:1},charge,1500,customer],
  [intent,{...charge,paid:false},1500,customer],
  [intent,{...charge,amount:1499},1500,customer],
  [intent,{...charge,customer:'cus_wrong123456'},1500,customer],
  [intent,charge,100,customer],
  [intent,charge,1500,'cus_wrong123456']
 ])assert.throws(()=>verifyTestTicketCharge(p,c,amount,who));
});
test('step90: reversal matches one Charge and only verified TEST reversal events',()=>{
 const evt=(type,object)=>({
  id:'evt_reversal123456',type,livemode:false,
  data:{object:{livemode:false,...object}}
 });
 assert.equal(verifyTestTicketReversal(
  evt('charge.refunded',{id:chargeId}),{...charge,amount_refunded:1}),true);
 assert.equal(verifyTestTicketReversal(
  evt('refund.updated',{id:'re_refund123456',charge:chargeId}),charge),false);
 assert.equal(verifyTestTicketReversal(
  evt('charge.dispute.created',{id:'du_dispute123456',charge:chargeId}),charge),true);
 assert.throws(()=>verifyTestTicketReversal(
  evt('refund.created',{id:'re_refund123456',charge:'ch_wrong12345'}),charge));
 assert.throws(()=>verifyTestTicketReversal(
  {...evt('charge.refunded',{id:chargeId}),livemode:true},charge));
});
test('step90: ticket offer and order projections use only bounded server values',()=>{
 assert.deepEqual(normalizeTestTicketOffer({
  event_id:eventId,title:'Sport',starts_at:'2026-11-10T10:00:00Z',
  amount_cents:0,tier:'premium'
 }),{eventId,title:'Sport',startsAt:'2026-11-10T10:00:00Z',
  amountCents:0,tier:'premium'});
 assert.equal(normalizeTestTicketOffer({event_id:eventId,amount_cents:1500}),null);
 assert.equal(normalizeTestTicketOffer({event_id:eventId,title:'X',starts_at:'2026-11-10',
  amount_cents:0,tier:'vip'}),null);
 assert.equal(normalizeTestTicketOrder({event_id:eventId,title:'Ticket',
  amount_cents:1500,status:'issued',can_reissue:true}).status,'issued');
 assert.equal(normalizeTestTicketOrder({event_id:eventId,title:'Ticket',
  amount_cents:1500,status:'unknown',can_reissue:true}),null);
});
test('step90: Checkout TEST links use exact official HTTPS Stripe hostname',()=>{
 const url='https://checkout.stripe.com/c/pay/cs_test_123456789abc#session';
 assert.equal(safeStripeTestCheckoutUrl(url),url);
 for(const target of [
  'https://checkout.stripe.com.evil.com/c/pay/cs_test_123456789abc',
  'http://checkout.stripe.com/c/pay/cs_test_123456789abc',
  'https://evil.test/c/pay/cs_test_123456789abc',
  'https://checkout.stripe.com/not-test',
  'https://checkout.stripe.com@evil.example/c/pay/cs_test_123456789abc',
  'javascript:alert(1)'
 ])assert.equal(safeStripeTestCheckoutUrl(target),null,target);
});
test('step90: production is OFF by default, independent staging and real identity mandatory',()=>{
 assert.equal(FREE_TICKET_STAGING.enabled,false);
 assert.equal(canUseFreeTickets(),false);
 assert.match(portal,/if\(!canUseFreeTickets\(\)\)/);
 assert.match(portal,/api\.auth\.getUser\(\)/);
 assert.match(portal,/user\?\.id===userId/);
 assert.match(portal,/api\.rpc\('member_list_eligible_test_ticket_events'\)/);
 assert.match(portal,/api\.rpc\('member_my_test_paid_tickets'\)/);
 assert.match(portal,/member_request_premium_test_comp_ticket/);
 assert.match(portal,/api\.functions\.invoke\('event-ticket-stripe-test-checkout'/);
 assert.match(member,/mountMemberPaidTicketTest\(account,api,user.id/);
 assert.doesNotMatch(portal,/service_role|sk_live_|rk_live_|localStorage|sessionStorage|sendBeacon|console\.log/);
});
test('step90: SQL private orders, charge identities and reversal inbox have zero browser grants',()=>{
 for(const name of ['ticket_test_orders','ticket_test_reversal_inbox']){
  assert.ok(sql.includes('create table if not exists app_private.'+name),name);
  assert.ok(sql.includes('alter table app_private.'+name+' enable row level security'),name);
  assert.ok(sql.includes('revoke all on app_private.'+name+' from public,anon,authenticated'),name);
 }
 for(const item of [
  'source', 'event_id uuid not null references public.club_events(id)',
  "status in ('pending','issued','paid_unfulfilled','reversed','expired')",
  'checkout_id text primary key', 'payment_intent_id text unique',
  'charge_id text unique', 'ticket_id uuid unique',
  'ticket_origin', 'premium_comp', 'test_paid',
  'member_list_eligible_test_ticket_events'
 ])assert.ok(sql.includes(item),item);
 assert.doesNotMatch(sql,/grant (?:select|update|insert|delete) on app_private\.ticket_test_/i);
});
test('step90: Premium grants must be charge-proven and never inferred from mutable browser metadata',()=>{
 const quote=sql.split('create or replace function app_private.ticket_test_price(')[1]
  .split('create or replace function public.billing_quote_test_event_ticket(')[0];
 for(const token of [
  'app_private.premium_access_grants g',
  'app_private.premium_test_charge_proofs p',
  'g.user_id=p_user_id','g.revoked_at is null',
  'g.valid_from<=now() and now()<g.valid_until',
  "e.access_kind='premium' and not premium",
  "e.priority_kind='premium'",
  "then e.premium_price_cents else e.price_cents",
  "w.status='scheduled'",
  'window_record.id'
 ])assert.ok(quote.includes(token),token);
 assert.match(sql,/grant execute on function public\.billing_quote_test_event_ticket\(uuid,uuid\)\s+to service_role/);
 assert.match(sql,/grant execute on function public\.member_list_eligible_test_ticket_events\(\)\s+to authenticated/);
 assert.doesNotMatch(quote,/user_metadata|premium=true|member_role=|p_is_premium/);
});
test('step90: Checkout holds seat with atomic event lock and verified exact quote',()=>{
 const register=sql.split('create or replace function public.billing_register_test_ticket_order(')[1]
  .split('create or replace function public.billing_apply_verified_test_ticket_payment(')[0];
 for(const token of [
  'where id=p_event_id for update',
  'app_private.ticket_test_price(p_user_id,p_event_id)',
  "(price->>'amount_cents')::int is distinct from p_amount_cents",
  'price->>\'tier\' is distinct from p_tier',
  "o.status='pending' and o.hold_until>clock_timestamp()",
  "status in ('issued','checked_in')",
  'if occupied>=e.capacity',
  'if window_occupied >=',
  "interval '35 minutes'"
 ])assert.ok(register.includes(token),token);
 assert.match(checkout,/expires_at:Math\.floor\(Date\.now\(\)\/1000\)\+30\*60/);
 assert.match(checkout,/client_reference_id:eventId/);
 assert.match(checkout,/billing_quote_test_event_ticket/);
 assert.match(checkout,/billing_register_test_ticket_order/);
 assert.match(checkout,/BOISSY_TEST_TICKET_CHECKOUT_ACK/);
 assert.match(checkout,/verifiedStripeTestProjectOrigin/);
 assert.match(checkout,/email_confirmed_at/);
 assert.match(checkout,/payment_method_types:\['card'\]/);
 assert.match(checkout,/session/); // Stripe hosted Checkout is server-created
});
test('step90: paid ticket is issued only after server-bound Stripe signed proof, no QR plaintext persisted',()=>{
 const settle=sql.split('create or replace function public.billing_apply_verified_test_ticket_payment(')[1]
  .split('create or replace function public.billing_record_test_ticket_reversal(')[0];
 for(const token of [
  'where id=p_event_id for update',
  'where checkout_id=p_checkout_id and event_id=p_event_id for update',
  'o.amount_cents<>p_amount_cents',
  'p_customer_id', 'p_payment_intent_id','p_charge_id',
  "o.status<>'pending'",
  'app_private.ticket_test_reversal_inbox',
  'is_reversed:=p_reversed',
  "result:='paid_unfulfilled'",
  "result:='issued'",
  "ticket_origin,payment_checkout_id",
  "'test_paid',p_checkout_id",
  "settled_at=clock_timestamp()",
  "status in ('issued','checked_in')"
 ])assert.ok(settle.includes(token),token);
 assert.match(settle,/v_secret|secret:=pg_catalog\.encode/);
 assert.doesNotMatch(settle,/return 'BUJ1:'|return secret|return p_customer_id/);
 assert.match(sql,/create or replace function public\.member_my_test_paid_tickets\(\)/);
});
test('step90: refunds/chargebacks are targeted and old valid QR cannot grant entry',()=>{
 const reversal=sql.split('create or replace function public.billing_record_test_ticket_reversal(')[1]
  .split('create or replace function public.member_my_test_paid_tickets(')[0];
 const scanner=sql.split('create or replace function public.admin_scan_free_event_ticket(')[1]
  .split('create or replace function public.admin_free_ticket_entry_report(')[0];
 assert.match(reversal,/app_private\.ticket_test_reversal_inbox/);
 assert.match(reversal,/where charge_id=p_charge_id for update/);
 assert.match(reversal,/where id=o.ticket_id and status='issued'/);
 assert.match(reversal,/where checkout_id=o.checkout_id/);
 assert.match(scanner,/v_event.booking_kind not in \('free','paid'\)/);
 assert.match(scanner,/v_ticket.ticket_origin='test_paid'/);
 assert.match(scanner,/o.status='issued'/);
 assert.match(scanner,/ticket_test_reversal_inbox/);
 assert.match(scanner,/v_ticket.ticket_origin='premium_comp'/);
 assert.match(scanner,/g.revoked_at is null/);
 assert.match(scanner,/p_qr !~ \('\^BUJ1:/);
 assert.match(scanner,/v_outcome:='already_used'/);
 assert.match(sql,/status='issued' and ticket_origin<>'test_paid'/);
 assert.match(sql,/new.booking_kind is distinct from old.booking_kind/);
});
test('step90: Checkout and webhook require restricted TEST secrets, raw signature and settled Charge',()=>{
 for(const token of [
  "stripe.webhooks.constructEventAsync(raw,signature,cfg.secret",
  "event.livemode!==false",
  "stripe.checkout.sessions.listLineItems",
  "stripe.paymentIntents.retrieve",
  "stripe.charges.retrieve",
  "verifyTestTicketCharge",
  "verifyTestTicketReversal",
  "billing_apply_verified_test_ticket_payment",
  "billing_record_test_ticket_reversal",
  "return reply('retry_later',503)"
 ])assert.ok(webhook.includes(token),token);
 assert.match(config,/\[functions\.event-ticket-stripe-test-checkout\]\s*verify_jwt = true/);
 assert.match(config,/\[functions\.event-ticket-stripe-test-webhook\]\s*verify_jwt = false/);
 assert.doesNotMatch(webhook+checkout,/sk_live_|rk_live_|pk_live_|console\.log|console\.error/);
});
