/**
 * Stripe TEST only / Supabase Edge Function. NOT DEPLOYED TO PRODUCTION.
 * No checkout entry point, payouts, LIVE keys, or browser-triggered entitlements.
 * Every event is signed by Stripe and reconciled against a registered private
 * Checkout link through a service-role-only SQL RPC.
 */
import Stripe from 'npm:stripe@22.6.0';
import {projectStripeTestEvent} from '../_shared/stripe-test-events.mjs';

function configuration(){
 const apiKey=Deno.env.get('STRIPE_TEST_RESTRICTED_KEY')||'';
 const signingSecret=Deno.env.get('STRIPE_TEST_WEBHOOK_SECRET')||'';
 const projectUrl=Deno.env.get('SUPABASE_URL')||'';
 const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 const monthlyPriceId=Deno.env.get('STRIPE_TEST_PRICE_MONTHLY')||'';
 const annualPriceId=Deno.env.get('STRIPE_TEST_PRICE_ANNUAL')||'';
 // The test endpoint is deliberately unable to process anything under LIVE
 // credentials or without isolated TEST webhook credentials.
 if(!/^rk_test_[a-zA-Z0-9_]{12,}$/.test(apiKey)||
   !/^whsec_[a-zA-Z0-9_]{12,}$/.test(signingSecret)||
   !projectUrl.startsWith('https://')||
   !serviceKey||!monthlyPriceId||!annualPriceId){
  throw new Error('Stripe TEST backend is not configured');
 }
 return {apiKey,signingSecret,projectUrl,serviceKey,
  monthlyPriceId,annualPriceId};
}
const respond=(body,status)=>new Response(JSON.stringify({status:body}),{
 status,headers:{'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store','x-content-type-options':'nosniff'}
});
async function persist(config,command){
 const url=new URL('/rest/v1/rpc/billing_apply_verified_test_event',config.projectUrl);
 const response=await fetch(url,{
  method:'POST',headers:{apikey:config.serviceKey,
   Authorization:'Bearer '+config.serviceKey,Accept:'application/json',
   'Content-Type':'application/json'},
  body:JSON.stringify(command),signal:AbortSignal.timeout(15000)
 });
 if(!response.ok)throw new Error('The private TEST billing RPC rejected the event');
}
Deno.serve(async req=>{
 if(req.method!=='POST')return respond('method_not_allowed',405);
 const length=Number(req.headers.get('content-length')||0);
 if(!Number.isFinite(length)||length>256*1024)return respond('invalid_payload',413);
 let config;
 try{config=configuration();}catch{return respond('test_backend_unavailable',503);}
 const signature=req.headers.get('stripe-signature');
 if(!signature)return respond('signature_required',400);
 let raw;
 try{raw=await req.text();}catch{return respond('invalid_payload',400);}
 if(new TextEncoder().encode(raw).length>256*1024)return respond('invalid_payload',413);
 let event;
 const stripe=new Stripe(config.apiKey,{apiVersion:'2026-08-26.dahlia'});
 try{
  // Official Stripe verifier uses the RAW body and exact endpoint secret.
  event=await stripe.webhooks.constructEventAsync(
   raw,signature,config.signingSecret,undefined,
   Stripe.createSubtleCryptoProvider()
  );
 }catch{return respond('signature_invalid',400);}
 if(event.livemode!==false)return respond('test_events_only',400);
 const recognized=[
  'checkout.session.completed','checkout.session.async_payment_succeeded',
  'invoice.paid','invoice.payment_failed','customer.subscription.deleted'
 ];
 if(!recognized.includes(event.type))return respond('ignored',200);
 try{
  const obj=event.data.object;
  let lines;
  if(event.type.startsWith('checkout.session.')){
   const items=await stripe.checkout.sessions.listLineItems(obj.id,{
    limit:2,expand:['data.price']
   });
   lines=items.data;
   if(items.has_more)throw new Error('Too many line items');
  }else if(event.type.startsWith('invoice.')){
   const items=await stripe.invoices.listLineItems(obj.id,{
    limit:2,expand:['data.price']
   });
   lines=items.data;
   if(items.has_more)throw new Error('Too many line items');
  }
  const command=projectStripeTestEvent(event,{
   ...config,lines
  });
  if(!command)return respond('ignored',200);
  await persist(config,command);
  return respond('processed',200);
 }catch{
  // Unknown server-side session, unordered webhooks, unavailable Stripe
  // or DB -> retryable error. Never acknowledge billing on failed storage.
  // Never log event payloads, PII, tokens, or API keys.
  return respond('retry_later',503);
 }
});
