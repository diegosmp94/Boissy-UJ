/** Stripe TEST ticket webhook; verifies raw signature before any privileged RPC.
 * NEVER deploy outside separately approved Supabase staging.
 */
import Stripe from 'npm:stripe@22.6.0';
import {verifiedStripeTestProjectOrigin} from '../_shared/stripe-test-financial-guards.mjs';
import {stripeId,verifiedTestTicketCheckout,verifyTestTicketCharge,
 verifyTestTicketReversal} from '../_shared/stripe-test-ticket-verification.mjs';
const reply=(status,code)=>new Response(JSON.stringify({status}),{status:code,
 headers:{'content-type':'application/json','cache-control':'no-store',
  'x-content-type-options':'nosniff'}});
const id=(p,x)=>typeof x==='string'&&new RegExp('^'+p+'_[a-zA-Z0-9_]{6,180}$').test(x);
function config(){
 const ref=Deno.env.get('BOISSY_STAGING_PROJECT_REF')||'';
 const url=verifiedStripeTestProjectOrigin(Deno.env.get('SUPABASE_URL')||'',ref);
 const apiKey=Deno.env.get('STRIPE_TEST_RESTRICTED_KEY')||'';
 const secret=Deno.env.get('STRIPE_TEST_TICKET_WEBHOOK_SECRET')||'';
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 const product=Deno.env.get('STRIPE_TEST_EVENT_TICKET_PRODUCT_ID')||'';
 if(Deno.env.get('BOISSY_TEST_TICKET_WEBHOOK_ACK')!==
   'YES_PROCESS_TEST_TICKET_WEBHOOK_ON_SEPARATE_STAGING'||
  !/^rk_test_[a-zA-Z0-9_]{12,}$/.test(apiKey)||
  !/^whsec_[a-zA-Z0-9_]{12,}$/.test(secret)||
  !service||!id('prod',product))throw Error('Unsafe TEST ticket webhook');
 return {url,apiKey,secret,service,product};
}
async function rpc(c,name,data){
 const allowed=['billing_apply_verified_test_ticket_payment',
  'billing_record_test_ticket_reversal'];
 if(!allowed.includes(name))throw Error('Unexpected privileged RPC');
 const res=await fetch(c.url+'/rest/v1/rpc/'+name,{
  method:'POST',headers:{apikey:c.service,Authorization:'Bearer '+c.service,
   Accept:'application/json','content-type':'application/json'},
  body:JSON.stringify(data),signal:AbortSignal.timeout(15000)
 });
 if(!res.ok)throw Error('Ticket reconciliation transaction rejected');
 return res.json();
}
async function processPayment(stripe,cfg,event){
 const session=event.data.object;
 const lineItems=await stripe.checkout.sessions.listLineItems(session.id,{
  limit:2,expand:['data.price']});
 if(lineItems.has_more)throw Error('Unexpected extra ticket items');
 const order=verifiedTestTicketCheckout(event,lineItems.data,cfg.product);
 if(!order.paid)return; // Async paid event or retry must supply settled funds.
 if(!id('pi',order.paymentIntentId))throw Error('No paid TEST PaymentIntent');
 const intent=await stripe.paymentIntents.retrieve(order.paymentIntentId);
 const chargeId=stripeId(intent.latest_charge);
 if(!id('ch',chargeId))throw Error('No Stripe Charge');
 const charge=await stripe.charges.retrieve(chargeId);
 const proof=verifyTestTicketCharge(intent,charge,order.amountCents,order.customerId);
 // An event id or metadata can never choose the account: the service RPC
 // resolves session -> immutable registered event/user/quote in DB.
 const eventId=session.client_reference_id;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId))
  throw Error('Missing server-bound event reference');
 await rpc(cfg,'billing_apply_verified_test_ticket_payment',{
  p_event_id:eventId,p_checkout_id:order.checkoutId,
  p_event_id_stripe:event.id,p_customer_id:order.customerId,
  p_payment_intent_id:proof.paymentIntentId,p_charge_id:proof.chargeId,
  p_amount_cents:order.amountCents,p_reversed:proof.reversed
 });
}
async function processReversal(stripe,cfg,event){
 const obj=event.data.object;
 const chargeId=event.type==='charge.refunded'?obj?.id:stripeId(obj?.charge);
 if(!id('ch',chargeId))throw Error('Charge unavailable for reversal');
 const charge=await stripe.charges.retrieve(chargeId);
 if(!verifyTestTicketReversal(event,charge))return;
 await rpc(cfg,'billing_record_test_ticket_reversal',{
  p_event_id_stripe:event.id,p_event_type:event.type,p_charge_id:charge.id
 });
}
Deno.serve(async req=>{
 if(req.method!=='POST')return reply('method_not_allowed',405);
 const contentLength=Number(req.headers.get('content-length')||0);
 if(!Number.isFinite(contentLength)||contentLength>262144)
  return reply('invalid_payload',413);
 let cfg;
 try{cfg=config();}catch{return reply('test_ticket_webhook_disabled',503);}
 const signature=req.headers.get('stripe-signature');
 if(!signature)return reply('signature_required',400);
 let raw;
 try{raw=await req.text();}catch{return reply('invalid_payload',400);}
 if(new TextEncoder().encode(raw).length>262144)return reply('invalid_payload',413);
 const stripe=new Stripe(cfg.apiKey,{apiVersion:'2026-08-26.dahlia'});
 let event;
 try{
  event=await stripe.webhooks.constructEventAsync(raw,signature,cfg.secret,
   undefined,Stripe.createSubtleCryptoProvider());
 }catch{return reply('invalid_signature',400);}
 if(event.livemode!==false)return reply('live_events_forbidden',400);
 const payments=['checkout.session.completed','checkout.session.async_payment_succeeded'];
 const reversals=['charge.refunded','refund.created','refund.updated',
  'charge.dispute.created'];
 if(!payments.includes(event.type)&&!reversals.includes(event.type))
  return reply('ignored',200);
 try{
  if(payments.includes(event.type))await processPayment(stripe,cfg,event);
  else await processReversal(stripe,cfg,event);
  return reply('test_ticket_reconciled',200);
 }catch{
  // Stripe retries unknown Checkout links and transient DB/Stripe outages.
  // No raw event, QR, user email or secrets logged.
  return reply('retry_later',503);
 }
});
