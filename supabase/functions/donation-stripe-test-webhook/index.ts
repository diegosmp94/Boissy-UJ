/** Signed donation TEST webhook; unpublished, isolated staging only.
 * No tax receipts, Premium access, LIVE payments, payouts or public totals.
 */
import Stripe from 'npm:stripe@22.6.0';
import {verifiedStripeTestProjectOrigin}
 from '../_shared/stripe-test-financial-guards.mjs';
import {stripeRef,checkTestDonationLine,checkDonationCharge,
 requireSingleTestInvoicePayment,acceptTestDonationReversal}
 from '../_shared/donation-test-verification.mjs';
const reply=(status,http)=>new Response(JSON.stringify({status}),{
 status:http,headers:{'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store','x-content-type-options':'nosniff'}});
const isId=(prefix,id)=>typeof id==='string'&&
 new RegExp('^'+prefix+'_[a-zA-Z0-9_]{6,180}$').test(id);
function config(){
 const ref=Deno.env.get('BOISSY_STAGING_PROJECT_REF')||'';
 const url=verifiedStripeTestProjectOrigin(Deno.env.get('SUPABASE_URL')||'',ref);
 const key=Deno.env.get('STRIPE_TEST_RESTRICTED_KEY')||'';
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 const secret=Deno.env.get('STRIPE_TEST_DONATION_WEBHOOK_SECRET')||'';
 const product=Deno.env.get('STRIPE_TEST_DONATION_PRODUCT_ID')||'';
 const gate=Deno.env.get('BOISSY_TEST_DONATION_WEBHOOK_ACK');
 if(gate!=='YES_PROCESS_TEST_DONATIONS_ONLY_ON_SEPARATE_STAGING'||
  !/^rk_test_[a-zA-Z0-9_]{12,}$/.test(key)||
  !/^whsec_[a-zA-Z0-9_]{12,}$/.test(secret)||
  !service||!isId('prod',product))
  throw new Error('Missing staging donation signature configuration');
 return {url,key,service,secret,product};
}
async function rpc(cfg,name,args){
 const allowed=['billing_bind_test_donation_subscription',
 'billing_resolve_test_donation_subscription',
 'billing_apply_verified_test_donation',
 'billing_record_verified_test_donation_reversal'];
 if(!allowed.includes(name))throw new Error('Disallowed TEST donation RPC');
 const response=await fetch(cfg.url+'/rest/v1/rpc/'+name,{
  method:'POST',headers:{apikey:cfg.service,
   Authorization:'Bearer '+cfg.service,'content-type':'application/json',
   Accept:'application/json'},
  body:JSON.stringify(args),signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw new Error('TEST donation reconciliation retry required');
 return response.json();
}
async function paidCharge(stripe,piId,amount,customer){
 if(!isId('pi',piId))throw new Error('Unmatched paid intent');
 const intent=await stripe.paymentIntents.retrieve(piId);
 const chargeId=stripeRef(intent.latest_charge);
 if(!isId('ch',chargeId))throw new Error('Missing paid TEST charge');
 const charge=await stripe.charges.retrieve(chargeId);
 return checkDonationCharge(intent,charge,amount,customer);
}
async function handleCheckout(stripe,cfg,event){
 const obj=event.data.object;
 if(obj.livemode!==false||!isId('cs_test',obj.id)||
  !['payment','subscription'].includes(obj.mode)||
  obj.currency!=='eur'||!isId('cus',stripeRef(obj.customer))||
  !Number.isSafeInteger(obj.amount_total)||
  obj.amount_total<100||obj.amount_total>100000)
  throw new Error('Invalid signed TEST donation Checkout');
 const frequency=obj.mode==='subscription'?'monthly':'once';
 const lines=await stripe.checkout.sessions.listLineItems(obj.id,{
  limit:2,expand:['data.price']
 });
 if(lines.has_more)throw new Error('Multiple donation items');
 checkTestDonationLine(lines.data,cfg.product,obj.amount_total,frequency);
 if(frequency==='monthly'){
  const sub=stripeRef(obj.subscription);
  if(!isId('sub',sub))throw new Error('No signed monthly subscription');
  await rpc(cfg,'billing_bind_test_donation_subscription',{
   p_checkout_id:obj.id,p_customer_id:stripeRef(obj.customer),
   p_subscription_id:sub
  });
  return;
 }
 if(obj.payment_status!=='paid')return; // No donation confirmed by success URL.
 const proof=await paidCharge(stripe,stripeRef(obj.payment_intent),
  obj.amount_total,stripeRef(obj.customer));
 await rpc(cfg,'billing_apply_verified_test_donation',{
  p_event_id:event.id,p_event_created_at:new Date(event.created*1000).toISOString(),
  p_source_reference:obj.id,p_checkout_id:obj.id,
  p_customer_id:stripeRef(obj.customer),
  p_payment_intent_id:proof.paymentIntentId,p_charge_id:proof.chargeId,
  p_amount_cents:obj.amount_total,p_frequency:'once',p_reversed:proof.reversed
 });
}
async function handleInvoice(stripe,cfg,event){
 const inv=event.data.object;
 const sub=stripeRef(inv.parent?.subscription_details?.subscription||
   inv.subscription);
 if(inv.livemode!==false||inv.status!=='paid'||inv.currency!=='eur'||
  !isId('in',inv.id)||!isId('sub',sub)||
  !isId('cus',stripeRef(inv.customer)))
  throw new Error('Invalid signed paid TEST donation invoice');
 // Only a previously registered staging Checkout may receive donated funds.
 const link=await rpc(cfg,'billing_resolve_test_donation_subscription',{
  p_subscription_id:sub
 });
 if(!isId('cs_test',link.checkout_id)||link.customer_id!==
  stripeRef(inv.customer)||!Number.isSafeInteger(link.amount_cents)||
  inv.amount_paid!==link.amount_cents)
  throw new Error('Invoice differs from registered TEST donation');
 const lines=await stripe.invoices.listLineItems(inv.id,{
  limit:2,expand:['data.price']
 });
 if(lines.has_more)throw new Error('Multiple invoice lines');
 checkTestDonationLine(lines.data,cfg.product,link.amount_cents,'monthly');
 const payments=await stripe.invoicePayments.list({invoice:inv.id,limit:2});
 const piId=requireSingleTestInvoicePayment(payments,inv.id);
 const proof=await paidCharge(stripe,piId,link.amount_cents,link.customer_id);
 await rpc(cfg,'billing_apply_verified_test_donation',{
  p_event_id:event.id,p_event_created_at:new Date(event.created*1000).toISOString(),
  p_source_reference:inv.id,p_checkout_id:link.checkout_id,
  p_customer_id:link.customer_id,
  p_payment_intent_id:proof.paymentIntentId,p_charge_id:proof.chargeId,
  p_amount_cents:link.amount_cents,p_frequency:'monthly',p_reversed:proof.reversed
 });
}
async function handleReversal(stripe,cfg,event){
 const obj=event.data.object;
 const chargeId=event.type==='charge.refunded'?obj.id:stripeRef(obj.charge);
 if(!isId('ch',chargeId))throw new Error('Unknown reversed charge');
 const charge=await stripe.charges.retrieve(chargeId);
 if(acceptTestDonationReversal(event,charge)){
  await rpc(cfg,'billing_record_verified_test_donation_reversal',{
   p_event_id:event.id,p_event_type:event.type,p_charge_id:charge.id
  });
 }
 // Pending refunds that are not successful do not revoke a paid donation.
}
Deno.serve(async req=>{
 if(req.method!=='POST')return reply('method_not_allowed',405);
 const length=Number(req.headers.get('content-length')||0);
 if(!Number.isFinite(length)||length>256*1024)return reply('invalid_payload',413);
 let cfg;
 try{cfg=config();}catch{return reply('donation_test_webhook_disabled',503);}
 const signature=req.headers.get('stripe-signature');
 if(!signature)return reply('signature_required',400);
 let raw;
 try{raw=await req.text();}catch{return reply('invalid_payload',400);}
 if(new TextEncoder().encode(raw).length>256*1024)return reply('invalid_payload',413);
 const stripe=new Stripe(cfg.key,{apiVersion:'2026-08-26.dahlia'});
 let event;
 try{
  event=await stripe.webhooks.constructEventAsync(raw,signature,cfg.secret,
   undefined,Stripe.createSubtleCryptoProvider());
 }catch{return reply('signature_invalid',400);}
 if(event.livemode!==false)return reply('test_events_only',400);
 const recognized=['checkout.session.completed',
  'checkout.session.async_payment_succeeded','invoice.paid',
  'charge.refunded','charge.dispute.created','refund.created','refund.updated'];
 if(!recognized.includes(event.type))return reply('ignored',200);
 try{
  if(event.type.startsWith('checkout.session.'))
   await handleCheckout(stripe,cfg,event);
  else if(event.type==='invoice.paid')
   await handleInvoice(stripe,cfg,event);
  else await handleReversal(stripe,cfg,event);
  return reply('test_donation_reconciled',200);
 }catch{
  // Unknown link or service outage must be retried by Stripe, not acknowledged.
  // Never log signed raw body, identity or service secrets.
  return reply('retry_later',503);
 }
});
