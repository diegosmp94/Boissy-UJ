/** Unpublished Stripe TEST donations endpoint. Only isolated Supabase staging.
 * Requests cannot specify Stripe product, price, customer, user or redirect.
 */
import Stripe from 'npm:stripe@22.6.0';
import {verifiedStripeTestProjectOrigin}
 from '../_shared/stripe-test-financial-guards.mjs';
const reply=(status,http,origin=null,more={})=>new Response(
 JSON.stringify({status,...more}),{status:http,headers:{
  'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff',
  ...(origin?{'access-control-allow-origin':origin,'vary':'Origin'}:{})
 }});
const validId=(prefix,x)=>typeof x==='string'&&
 new RegExp('^'+prefix+'_[a-zA-Z0-9_]{6,180}$').test(x);
function config(){
 const ref=Deno.env.get('BOISSY_STAGING_PROJECT_REF')||'';
 const url=verifiedStripeTestProjectOrigin(Deno.env.get('SUPABASE_URL')||'',ref);
 const key=Deno.env.get('STRIPE_TEST_RESTRICTED_KEY')||'';
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 const pub=Deno.env.get('SUPABASE_ANON_KEY')||'';
 const product=Deno.env.get('STRIPE_TEST_DONATION_PRODUCT_ID')||'';
 const origin=Deno.env.get('BOISSY_STAGING_ORIGIN')||'';
 const gate=Deno.env.get('BOISSY_TEST_DONATION_ACK');
 if(gate!=='YES_TEST_DONATIONS_ONLY_ON_SEPARATE_STAGING'||
  !/^rk_test_[a-zA-Z0-9_]{12,}$/.test(key)||!service||!pub||
  !validId('prod',product)||new URL(origin).origin!==origin||
  !origin.startsWith('https://'))
  throw new Error('Unsafe donation staging configuration');
 return {url,key,service,pub,product,origin};
}
async function register(cfg,data){
 const r=await fetch(cfg.url+'/rest/v1/rpc/billing_register_test_donation_checkout',{
  method:'POST',headers:{apikey:cfg.service,Authorization:'Bearer '+cfg.service,
   'content-type':'application/json',Accept:'application/json'},
  body:JSON.stringify(data),signal:AbortSignal.timeout(12000)
 });
 if(!r.ok)throw new Error('Donation TEST link refused');
}
Deno.serve(async req=>{
 let cfg;
 try{cfg=config();}catch{return reply('test_donations_disabled',503);}
 if(req.headers.get('origin')!==cfg.origin)return reply('forbidden_origin',403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{
  'access-control-allow-origin':cfg.origin,
  'access-control-allow-methods':'POST,OPTIONS',
  'access-control-allow-headers':'authorization,content-type',
  'vary':'Origin'}});
 if(req.method!=='POST')return reply('method_not_allowed',405,cfg.origin);
 if(!req.headers.get('content-type')?.startsWith('application/json'))
  return reply('invalid_media_type',415,cfg.origin);
 const token=req.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
 if(!token)return reply('auth_required',401,cfg.origin);
 let body;
 try{
  const raw=await req.text();
  if(raw.length>320)throw new Error('Too big');
  body=JSON.parse(raw);
  if(!body||Array.isArray(body)||Object.keys(body).sort().join(',')!==
   'amount_cents,campaign_id,frequency'||!
   /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.campaign_id)||
   !Number.isSafeInteger(body.amount_cents)||body.amount_cents<100||
   body.amount_cents>100000||
   !['once','monthly'].includes(body.frequency))
   throw new Error('Invalid donation');
 }catch{return reply('invalid_donation',400,cfg.origin);}
 let user;
 try{
  const response=await fetch(cfg.url+'/auth/v1/user',{headers:{
   apikey:cfg.pub,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('Invalid staging user');
  user=await response.json();
  if(!user?.id||!user.email||!user.email_confirmed_at)
   throw new Error('Email verification required');
 }catch{return reply('verified_staging_account_required',401,cfg.origin);}
 const stripe=new Stripe(cfg.key,{apiVersion:'2026-08-26.dahlia'});
 let session;
 try{
  // Registration only permits campaigns OPEN in DB, despite frontend requests.
  const product=await stripe.products.retrieve(cfg.product);
  if(product.active!==true||product.livemode!==false)
   throw new Error('TEST donation product not approved');
  const price_data={
   product:cfg.product,currency:'eur',unit_amount:body.amount_cents,
   ...(body.frequency==='monthly'?{recurring:{interval:'month'}}:{})
  };
  const returnTo=cfg.origin+'/#/soutenir';
  session=await stripe.checkout.sessions.create({
   mode:body.frequency==='monthly'?'subscription':'payment',
   line_items:[{price_data,quantity:1}],
   customer_email:user.email,
   ...(body.frequency==='once'?{customer_creation:'always'}:{}),
   success_url:returnTo,cancel_url:returnTo
  });
  if(!session.id?.startsWith('cs_test_')||!session.url)
   throw new Error('Not TEST Checkout');
  await register(cfg,{
   p_user_id:user.id,p_checkout_id:session.id,
   p_campaign_id:body.campaign_id,p_frequency:body.frequency,
   p_amount_cents:body.amount_cents
  });
  return reply('test_donation_checkout_created',200,cfg.origin,{url:session.url});
 }catch{
  if(session?.id)try{await stripe.checkout.sessions.expire(session.id);}catch{}
  return reply('test_donations_unavailable',503,cfg.origin);
 }
});
