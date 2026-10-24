/**
 * Isolated Stripe TEST Checkout creator, NOT hooked to the production website.
 * Only accepts a real, email-verified STAGING Supabase Auth session.
 * A session URL is returned only AFTER the private server-side session->user
 * binding is committed. This route grants ZERO Premium entitlements.
 */
import Stripe from 'npm:stripe@22.6.0';
import {verifiedStripeTestProjectOrigin} from '../_shared/stripe-test-financial-guards.mjs';

const reply=(code,status,origin=null,extra={})=>new Response(
 JSON.stringify({status:code,...extra}),{status,headers:{
  'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff',
  ...(origin?{'access-control-allow-origin':origin,
   'vary':'Origin'}:{})
 }});
function settings(){
 const stripeKey=Deno.env.get('STRIPE_TEST_RESTRICTED_KEY')||'';
 const url=Deno.env.get('SUPABASE_URL')||'';
 const projectRef=Deno.env.get('BOISSY_STAGING_PROJECT_REF')||'';
 const pubKey=Deno.env.get('SUPABASE_ANON_KEY')||'';
 const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 const origin=Deno.env.get('BOISSY_STAGING_ORIGIN')||'';
 const priceMonthly=Deno.env.get('STRIPE_TEST_PRICE_MONTHLY')||'';
 const priceAnnual=Deno.env.get('STRIPE_TEST_PRICE_ANNUAL')||'';
 const gate=Deno.env.get('BOISSY_TEST_CHECKOUT_ACK');
 let stageOrigin,isolatedUrl;
 try{
  stageOrigin=new URL(origin);
  isolatedUrl=verifiedStripeTestProjectOrigin(url,projectRef);
 }catch{throw new Error('Invalid isolated staging configuration');}
 if(gate!=='YES_ENABLE_CHECKOUT_ONLY_ON_ISOLATED_STAGING'||
  !/^rk_test_[a-zA-Z0-9_]{12,}$/.test(stripeKey)||
  !pubKey||!serviceKey||
  stageOrigin.protocol!=='https:'||stageOrigin.origin!==origin||
  !/^price_[a-zA-Z0-9_]{6,100}$/.test(priceMonthly)||
  !/^price_[a-zA-Z0-9_]{6,100}$/.test(priceAnnual)||
  priceMonthly===priceAnnual)
  throw new Error('Isolated Stripe TEST checkout configuration incomplete');
 return {stripeKey,url:isolatedUrl,pubKey,serviceKey,origin,
  priceMonthly,priceAnnual};
}
async function verifiedUser(config,token){
 const r=await fetch(config.url+'/auth/v1/user',{
  headers:{apikey:config.pubKey,Authorization:'Bearer '+token},
  signal:AbortSignal.timeout(10000)
 });
 if(!r.ok)throw new Error('No valid staging user');
 const user=await r.json();
 if(!user.id||!user.email||!(user.email_confirmed_at||user.confirmed_at))
  throw new Error('A confirmed staging account is required');
 return user;
}
function integrationId(){
 const bytes=new Uint8Array(8);crypto.getRandomValues(bytes);
 return 'boissyujstage_'+[...bytes].map(x=>String.fromCharCode(97+x%26)).join('');
}
Deno.serve(async req=>{
 let config;
 try{config=settings();}catch{return reply('test_checkout_unavailable',503);}
 const origin=req.headers.get('origin');
 if(origin!==config.origin)return reply('forbidden_origin',403);
 if(req.method==='OPTIONS'){
  return new Response(null,{status:204,headers:{
   'access-control-allow-origin':config.origin,'vary':'Origin',
   'access-control-allow-methods':'POST, OPTIONS',
   'access-control-allow-headers':'authorization, content-type',
   'access-control-max-age':'600'
  }});
 }
 if(req.method!=='POST')return reply('method_not_allowed',405,config.origin);
 if(!req.headers.get('content-type')?.startsWith('application/json'))
  return reply('unsupported_media_type',415,config.origin);
 const token=req.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
 if(!token)return reply('auth_required',401,config.origin);
 const length=Number(req.headers.get('content-length')||0);
 if(!Number.isFinite(length)||length>1024)return reply('invalid_request',413,config.origin);
 let body;
 try{const raw=await req.text();
  if(raw.length>1024)throw new Error('Too large');
  body=JSON.parse(raw);
 }catch{return reply('invalid_request',400,config.origin);}
 if(!body||typeof body!=='object'||Array.isArray(body)||
  !['monthly','annual'].includes(body.period)||
  Object.keys(body).length!==1)return reply('invalid_plan',400,config.origin);
 let user;
 try{user=await verifiedUser(config,token);}
 catch{return reply('verified_staging_account_required',401,config.origin);}
 const mode=body.period==='monthly'?'subscription':'payment';
 const priceId=body.period==='monthly'?config.priceMonthly:config.priceAnnual;
 const stripe=new Stripe(config.stripeKey,{apiVersion:'2026-08-26.dahlia'});
 let session;
 try{
  const price=await stripe.prices.retrieve(priceId);
  if(price.active!==true||price.livemode!==false||price.currency!=='eur'||
    price.unit_amount!==(mode==='subscription'?1000:10000)||
    (mode==='subscription'?
      (price.type!=='recurring'||price.recurring?.interval!=='month'||
       price.recurring?.interval_count!==1):
      price.type!=='one_time'))
    throw new Error('Unapproved price');
  // URLs are fixed server-side: an HTTP request cannot supply a redirect.
  const returnTo=config.origin+'/#/communaute';
  session=await stripe.checkout.sessions.create({
   mode,line_items:[{price:priceId,quantity:1}],
   customer_email:user.email,
   ...(mode==='payment'?{customer_creation:'always'}:{}),
   success_url:returnTo,cancel_url:returnTo,
   integration_identifier:integrationId()
  });
  if(!session.id?.startsWith('cs_test_')||!session.url)
   throw new Error('Checkout not in Stripe TEST mode');
  const response=await fetch(config.url+'/rest/v1/rpc/billing_register_test_checkout',{
   method:'POST',headers:{apikey:config.serviceKey,
    Authorization:'Bearer '+config.serviceKey,
    'content-type':'application/json',Accept:'application/json'},
   body:JSON.stringify({
    p_user_id:user.id,p_checkout_id:session.id,p_price_id:priceId,
    p_plan_kind:body.period
   }),signal:AbortSignal.timeout(15000)
  });
  if(!response.ok)throw new Error('Private checkout registration failed');
  return reply('test_checkout_created',200,config.origin,{
   // Only an official Stripe-hosted URL is returned, never sensitive details.
   url:session.url
  });
 }catch{
  if(session?.id){
   try{await stripe.checkout.sessions.expire(session.id);}catch{}
  }
  return reply('test_checkout_unavailable',503,config.origin);
 }
});
