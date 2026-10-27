/** Server-only Stripe TEST event ticket checkout.
 * NEVER deploy on production Supabase or enable LIVE purchases.
 * Prices/discounts/premium entitlements come exclusively from DB.
 */
import Stripe from 'npm:stripe@22.6.0';
import {verifiedStripeTestProjectOrigin}
 from '../_shared/stripe-test-financial-guards.mjs';
const ok=(status,http,origin=null,more={})=>new Response(JSON.stringify({status,...more}),{
 status:http,headers:{'content-type':'application/json','cache-control':'no-store',
 'x-content-type-options':'nosniff',...(origin?{'access-control-allow-origin':origin,'vary':'Origin'}:{})}
});
const id=(prefix,s)=>typeof s==='string'&&
 new RegExp('^'+prefix+'_[a-zA-Z0-9_]{6,180}$').test(s);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function getConfig(){
 const ref=Deno.env.get('BOISSY_STAGING_PROJECT_REF')||'';
 const url=verifiedStripeTestProjectOrigin(Deno.env.get('SUPABASE_URL')||'',ref);
 const origin=Deno.env.get('BOISSY_STAGING_ORIGIN')||'';
 const secret=Deno.env.get('STRIPE_TEST_RESTRICTED_KEY')||'';
 const product=Deno.env.get('STRIPE_TEST_EVENT_TICKET_PRODUCT_ID')||'';
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 const pub=Deno.env.get('SUPABASE_ANON_KEY')||'';
 if(Deno.env.get('BOISSY_TEST_TICKET_CHECKOUT_ACK')!==
   'YES_TEST_TICKETS_ON_ISOLATED_STAGING_ONLY'||
  !/^rk_test_[a-zA-Z0-9_]{12,}$/.test(secret)||!id('prod',product)||
  !service||!pub||!origin.startsWith('https://')||
  new URL(origin).origin!==origin)
  throw Error('TEST ticket checkout not enabled');
 return {url,origin,secret,product,service,pub};
}
async function rpc(cfg,name,params){
 if(!['billing_quote_test_event_ticket','billing_register_test_ticket_order'].includes(name))
  throw Error('Unexpected privileged RPC');
 const response=await fetch(cfg.url+'/rest/v1/rpc/'+name,{
  method:'POST',headers:{apikey:cfg.service,
   Authorization:'Bearer '+cfg.service,'content-type':'application/json',
   Accept:'application/json'},body:JSON.stringify(params),signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw Error('Staging ticket RPC refused');
 return response.json();
}
Deno.serve(async req=>{
 let cfg;
 try{cfg=getConfig();}catch{return ok('test_ticket_checkout_disabled',503);}
 if(req.headers.get('origin')!==cfg.origin)return ok('forbidden_origin',403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{
  'access-control-allow-origin':cfg.origin,'vary':'Origin',
  'access-control-allow-headers':'authorization,content-type',
  'access-control-allow-methods':'POST,OPTIONS'
 }});
 if(req.method!=='POST')return ok('method_not_allowed',405,cfg.origin);
 if(!req.headers.get('content-type')?.startsWith('application/json'))
  return ok('invalid_content_type',415,cfg.origin);
 const token=req.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
 if(!token)return ok('auth_required',401,cfg.origin);
 let eventId;
 try{
  const raw=await req.text();
  if(!raw||raw.length>128)throw Error('Invalid request size');
  const body=JSON.parse(raw);
  if(!body||Array.isArray(body)||Object.keys(body).length!==1||
   !UUID.test(body.event_id))throw Error('Invalid event reference');
  eventId=body.event_id;
 }catch{return ok('invalid_request',400,cfg.origin);}
 let user;
 try{
  const response=await fetch(cfg.url+'/auth/v1/user',{headers:{
   apikey:cfg.pub,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)throw Error('Auth rejected');
  user=await response.json();
  if(!user?.id||!user.email_confirmed_at||!user.email)
   throw Error('Verified staging account required');
 }catch{return ok('verified_staging_account_required',401,cfg.origin);}
 const stripe=new Stripe(cfg.secret,{apiVersion:'2026-08-26.dahlia'});
 let checkout;
 try{
  const price=await rpc(cfg,'billing_quote_test_event_ticket',{
   p_user_id:user.id,p_event_id:eventId
  });
  if(!Number.isSafeInteger(price?.amount_cents)||
    price.amount_cents<50||price.amount_cents>1000000||
    !['premium','public'].includes(price.tier)||
    !(price.window_id===null||UUID.test(price.window_id)))
   return ok('test_ticket_not_payable',409,cfg.origin);
  const product=await stripe.products.retrieve(cfg.product);
  if(product.livemode!==false||product.active!==true)
   throw Error('Unexpected TEST ticket product');
  checkout=await stripe.checkout.sessions.create({
   mode:'payment',customer_email:user.email,customer_creation:'always',
   payment_method_types:['card'], // no delayed/partial payments in this test
   line_items:[{price_data:{currency:'eur',product:cfg.product,
    unit_amount:price.amount_cents},quantity:1}],
   success_url:cfg.origin+'/#/mon-espace',
   cancel_url:cfg.origin+'/#/evenements'
  });
  if(!id('cs_test',checkout.id)||!checkout.url)
   throw Error('Non TEST Checkout returned');
  await rpc(cfg,'billing_register_test_ticket_order',{
   p_user_id:user.id,p_event_id:eventId,p_checkout_id:checkout.id,
   p_amount_cents:price.amount_cents,p_tier:price.tier,p_window_id:price.window_id
  });
  return ok('test_checkout_created',200,cfg.origin,{url:checkout.url});
 }catch{
  if(checkout?.id)try{await stripe.checkout.sessions.expire(checkout.id);}catch{}
  return ok('test_ticket_unavailable',503,cfg.origin);
 }
});
