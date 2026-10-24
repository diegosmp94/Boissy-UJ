import {validPremiumTestAmount} from './stripe-test-financial-guards.mjs';
/** Pure Stripe TEST webhook projection; no service keys, no DB access.
 * All money and identities are checked on the server, never from browser data.
 * The database binds stripe objects to user IDs via private checkout links.
 */
export const STRIPE_TEST_EVENTS=Object.freeze([
 'checkout.session.completed',
 'checkout.session.async_payment_succeeded',
 'invoice.paid','invoice.payment_failed','customer.subscription.deleted'
]);
const isId=(prefix,v)=>typeof v==='string'&&new RegExp('^'+prefix+'_[a-zA-Z0-9_]{6,180}$').test(v);
const stripeId=(v)=>typeof v==='string'?v:v?.id||null;
const getPriceId=(line)=>line?.pricing?.price_details?.price??line?.price?.id??null;
const getPriceAmount=(line)=>line?.price?.unit_amount??line?.pricing?.unit_amount_decimal??null;
const getPeriod=(line)=>line?.period;
const getSubscriptionId=(invoice)=>stripeId(
 invoice?.parent?.subscription_details?.subscription??invoice?.subscription
);
function stamp(unix){
 if(!Number.isSafeInteger(unix)||unix<1_600_000_000||unix>4_000_000_000)
  throw new Error('Invalid signed event date');
 return new Date(unix*1000).toISOString();
}
function priceFromLines(lines,priceId){
 if(!Array.isArray(lines)||lines.length!==1)throw new Error('Single recognized billing item required');
 const line=lines[0];
 if(getPriceId(line)!==priceId)throw new Error('Configured plan price mismatch');
 const quantity=line.quantity??1;
 if(quantity!==1)throw new Error('Multiple premium seats are not supported');
 return line;
}
function requireLiveOff(event){
 if(!event||event.livemode!==false||!isId('evt',event.id))
  throw new Error('Only signed TEST mode Stripe events can be reconciled');
 if(!STRIPE_TEST_EVENTS.includes(event.type))return false;
 if(!event.data?.object||typeof event.data.object!=='object')
  throw new Error('Missing verified Stripe event object');
 return true;
}
/** Normalize ONLY verified event data and read-only Stripe API lookups into the
 * service_role-only RPC shape. The edge route MUST verify the signature first.
 */
export function projectStripeTestEvent(event,options={}){
 if(!requireLiveOff(event))return null;
 const {monthlyPriceId,annualPriceId,lines}=options;
 if(!isId('price',monthlyPriceId)||!isId('price',annualPriceId)||
    monthlyPriceId===annualPriceId)
  throw new Error('Stripe TEST price configuration incomplete');
 const obj=event.data.object;
 const base={
  p_event_id:event.id,p_event_type:event.type,
  p_event_created_at:stamp(event.created),
  p_checkout_id:null,p_subscription_id:null,p_customer_id:null,
  p_price_id:null,p_source_id:null,p_period_start:null,
  p_period_end:null,p_paid:false
 };
 if(event.type.startsWith('checkout.session.')){
  if(!isId('cs_test',obj.id)||obj.livemode!==false||obj.currency!=='eur'||
     !isId('cus',stripeId(obj.customer)))throw new Error('Invalid TEST checkout');
  const kind=obj.mode==='subscription'?'monthly':obj.mode==='payment'?'annual':null;
  if(!kind)throw new Error('Unexpected checkout billing mode');
  const wanted=kind==='monthly'?monthlyPriceId:annualPriceId;
  const item=priceFromLines(lines,wanted);
  if(item.price?.currency&&item.price.currency!=='eur')
   throw new Error('Checkout currency mismatch');
  if(!validPremiumTestAmount({
   kind,amount:obj.amount_total,currency:obj.currency
  }))throw new Error(kind==='annual'
   ?'Annual plan amount must be 100 EUR'
   :'Monthly plan amount must be exactly 10 EUR');
  const sub=stripeId(obj.subscription);
  if(kind==='monthly'&&!isId('sub',sub))
   throw new Error('Monthly checkout must identify Stripe Subscription');
  if(kind==='annual'&&sub!==null)throw new Error('Annual checkout must not recur');
  return {
   ...base,p_checkout_id:obj.id,p_customer_id:stripeId(obj.customer),
   p_subscription_id:sub,p_price_id:wanted,
   p_source_id:kind==='annual'?obj.id:null,
   p_paid:obj.payment_status==='paid'&&kind==='annual',
   p_period_start:kind==='annual'?stamp(obj.created):null
  };
 }
 if(event.type==='customer.subscription.deleted'){
  if(obj.livemode!==false||!isId('sub',obj.id)||
     !isId('cus',stripeId(obj.customer)))throw new Error('Invalid TEST cancellation');
  const item=priceFromLines(obj.items?.data,monthlyPriceId);
  if(item.price?.currency&&item.price.currency!=='eur')
   throw new Error('Subscription currency mismatch');
  return {...base,p_subscription_id:obj.id,p_customer_id:stripeId(obj.customer),
   p_price_id:monthlyPriceId};
 }
 if(obj.livemode!==false||!isId('in',obj.id)||obj.currency!=='eur'||
    !isId('cus',stripeId(obj.customer)))throw new Error('Invalid TEST invoice');
 const sub=getSubscriptionId(obj);
 if(!isId('sub',sub))throw new Error('Subscription invoice association unavailable');
 const item=priceFromLines(lines,monthlyPriceId);
 if(item.price?.currency&&item.price.currency!=='eur')
  throw new Error('Invoice currency mismatch');
 const paid=event.type==='invoice.paid'&&obj.status==='paid'&&
   validPremiumTestAmount({
    kind:'monthly',amount:obj.amount_paid,currency:obj.currency
   });
 if(event.type==='invoice.paid'&&!paid)
  throw new Error('Only paid monthly invoices of exactly 10 EUR can grant access');
 const period=getPeriod(item);
 if(event.type==='invoice.paid'&&(!period||!Number.isSafeInteger(period.start)||
   !Number.isSafeInteger(period.end)||period.end<=period.start))
  throw new Error('Paid monthly invoice must have a verified service period');
 return {
  ...base,p_subscription_id:sub,p_customer_id:stripeId(obj.customer),
  p_price_id:monthlyPriceId,p_source_id:obj.id,p_paid:paid,
  p_period_start:paid?stamp(period.start):null,
  p_period_end:paid?stamp(period.end):null
 };
}
