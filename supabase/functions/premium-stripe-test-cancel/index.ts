/**
 * Stripe TEST only: authenticated supporter cancellation of the next monthly
 * renewal. Never terminates a paid interval early, never enables purchases.
 * THIS MUST ONLY BE DEPLOYED ON AN ISOLATED SUPABASE STAGING PROJECT.
 */
import Stripe from 'npm:stripe@22.6.0';
import {verifiedStripeTestProjectOrigin} from '../_shared/stripe-test-financial-guards.mjs';

const reply=(status,http,origin=null)=>new Response(JSON.stringify({status}),{
 status:http,headers:{'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store','x-content-type-options':'nosniff',
  ...(origin?{'access-control-allow-origin':origin,'vary':'Origin'}:{})}
});
function config(){
 const projectRef=Deno.env.get('BOISSY_STAGING_PROJECT_REF')||'';
 const url=verifiedStripeTestProjectOrigin(Deno.env.get('SUPABASE_URL')||'',projectRef);
 const origin=Deno.env.get('BOISSY_STAGING_ORIGIN')||'';
 const apiKey=Deno.env.get('STRIPE_TEST_RESTRICTED_KEY')||'';
 const anon=Deno.env.get('SUPABASE_ANON_KEY')||'';
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 const gate=Deno.env.get('BOISSY_TEST_CANCEL_ACK');
 if(gate!=='YES_ALLOW_VERIFIED_TEST_MONTHLY_CANCEL_ON_ISOLATED_STAGING'
  ||!/^rk_test_[a-zA-Z0-9_]{12,}$/.test(apiKey)||!anon||!service||
  new URL(origin).origin!==origin||!origin.startsWith('https://'))
  throw new Error('TEST self-service cancellation is not configured');
 return {url,origin,apiKey,anon,service};
}
async function postRpc(cfg,name,data){
 const response=await fetch(cfg.url+'/rest/v1/rpc/'+name,{
  method:'POST',headers:{apikey:cfg.service,
   Authorization:'Bearer '+cfg.service,
   Accept:'application/json','content-type':'application/json'},
  body:JSON.stringify(data),signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw new Error('Verified staging RPC refused');
 return response.json();
}
const stringId=(prefix,id)=>typeof id==='string'&&
 new RegExp('^'+prefix+'_[a-zA-Z0-9_]{6,100}$').test(id);
const ref=id=>typeof id==='string'?id:id?.id||null;
function validateStripeTestSubscription(sub,target){
 const items=sub?.items?.data;
 const item=Array.isArray(items)&&items.length===1?items[0]:null;
 if(sub?.livemode!==false||sub.status!=='active'||
  sub.id!==target.subscription_id||
  !stringId('sub',sub.id)||ref(sub.customer)!==target.customer_id||
  item?.price?.livemode!==false||item.price.id!==target.price_id||
  item.price.currency!=='eur'||item.price.unit_amount!==1000||
  item.price.recurring?.interval!=='month'||
  item.price.recurring?.interval_count!==1||item.quantity!==1||
  !Number.isSafeInteger(item.current_period_end)||
  item.current_period_end<=Math.floor(Date.now()/1000)||
  item.current_period_end>Math.floor(Date.now()/1000)+45*86400)
  throw new Error('Invalid TEST subscription, amount or billing period');
 return item.current_period_end;
}
Deno.serve(async req=>{
 let cfg;
 try{cfg=config();}catch{return reply('test_cancellation_unavailable',503);}
 const origin=req.headers.get('origin');
 if(origin!==cfg.origin)return reply('forbidden_origin',403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{
  'access-control-allow-origin':cfg.origin,'vary':'Origin',
  'access-control-allow-headers':'authorization, apikey, content-type',
  'access-control-allow-methods':'POST, OPTIONS',
  'access-control-max-age':'600'
 }});
 if(req.method!=='POST')return reply('method_not_allowed',405,cfg.origin);
 if(!req.headers.get('content-type')?.startsWith('application/json'))
  return reply('unsupported_media_type',415,cfg.origin);
 const token=req.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
 if(!token)return reply('authentication_required',401,cfg.origin);
 try{
  const raw=await req.text();
  if(raw.length>256||!raw)throw new Error('Invalid body');
  const body=JSON.parse(raw);
  if(!body||Array.isArray(body)||typeof body!=='object'||
   Object.keys(body).length!==1||body.action!=='cancel_renewal')
   throw new Error('Invalid operation');
 }catch{return reply('invalid_request',400,cfg.origin);}
 let user;
 try{
  const response=await fetch(cfg.url+'/auth/v1/user',{
   headers:{apikey:cfg.anon,Authorization:'Bearer '+token},
   signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)throw new Error('No verified user');
  user=await response.json();
  if(!user?.id||!user.email_confirmed_at)throw new Error('Unverified email');
 }catch{return reply('verified_test_account_required',401,cfg.origin);}
 try{
  // The member NEVER supplies a subscription/customer/plan id.
  const target=await postRpc(cfg,'billing_get_member_test_renewal_target',
   {p_user_id:user.id});
  if(!target||!stringId('sub',target.subscription_id)||
   !stringId('cus',target.customer_id)||!stringId('price',target.price_id))
   throw new Error('No unique verified TEST plan');
  const stripe=new Stripe(cfg.apiKey,{apiVersion:'2026-08-26.dahlia'});
  let sub=await stripe.subscriptions.retrieve(target.subscription_id);
  validateStripeTestSubscription(sub,target);
  if(sub.cancel_at_period_end!==true){
   // Scheduling the period end does not stop the already-paid entitlement.
   sub=await stripe.subscriptions.update(target.subscription_id,
    {cancel_at_period_end:true});
  }
  if(sub.cancel_at_period_end!==true)
   throw new Error('TEST cancellation not confirmed by Stripe');
  const unix=validateStripeTestSubscription(sub,target);
  await postRpc(cfg,'billing_confirm_member_test_cancellation',{
   p_user_id:user.id,p_subscription_id:target.subscription_id,
   p_effective_at:new Date(unix*1000).toISOString()
  });
  return reply('renewal_cancellation_scheduled',200,cfg.origin);
 }catch{
  // When Stripe succeeds and storage fails, retry is safe: request idempotently
  // writes the scheduled cancellation into the private staging ledger.
  return reply('test_cancellation_unavailable',503,cfg.origin);
 }
});
