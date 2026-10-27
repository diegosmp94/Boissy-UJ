/**
 * Pure TEST financial identity verifiers. Called only after Stripe's raw
 * webhook signature is verified. Never take member IDs or client metadata.
 * No charges are granted in JS; the server binds exact IDs in a private RPC.
 */
export const TEST_REVERSAL_EVENT_TYPES=Object.freeze([
 'refund.created','refund.updated','refund.failed','charge.refunded',
 'charge.refund.updated','charge.dispute.created','charge.dispute.updated',
 'charge.dispute.closed','charge.dispute.funds_withdrawn',
 'charge.dispute.funds_reinstated'
]);
const id=(prefix,s)=>typeof s==='string'&&
 new RegExp('^'+prefix+'_[a-zA-Z0-9_]{6,180}$').test(s);
const ref=x=>typeof x==='string'?x:x?.id||null;
const time=t=>{
 if(!Number.isSafeInteger(t)||t<1_600_000_000||t>4_000_000_000)
  throw new Error('Invalid signed Stripe TEST time');
 return new Date(t*1000).toISOString();
};
export function projectTestReversal(event,charge){
 const obj=event?.data?.object;
 if(event?.livemode!==false||obj?.livemode!==false||
   !id('evt',event?.id)||!TEST_REVERSAL_EVENT_TYPES.includes(event?.type)||
   !charge||charge.livemode!==false||!id('ch',charge.id)||
   !id('cus',ref(charge.customer))||!id('pi',ref(charge.payment_intent)))
  throw new Error('Verified TEST reversal charge required');
 const objectCharge=event.type==='charge.refunded'?obj.id:ref(obj.charge);
 const objectPI=ref(obj.payment_intent);
 if(objectCharge&&objectCharge!==charge.id)
  throw new Error('TEST reversal refers to another charge');
 if(objectPI&&objectPI!==ref(charge.payment_intent))
  throw new Error('TEST reversal refers to another PaymentIntent');
 if(event.type==='charge.refunded'&&objectCharge!==charge.id)
  throw new Error('Unexpected charge.refunded object');
 if(event.type.startsWith('refund.')||event.type==='charge.refund.updated'){
  if(!id('re',obj.id))throw new Error('Refund ID missing');
 }else if(event.type.startsWith('charge.dispute.')){
  if(!id('dp',obj.id))throw new Error('Dispute ID missing');
 }
 return {
  p_event_id:event.id,p_event_type:event.type,
  p_event_created_at:time(event.created),
  p_charge_id:charge.id,p_customer_id:ref(charge.customer)
 };
}
export function requirePaidInvoicePaymentIntent(payments,invoiceId){
 if(!id('in',invoiceId)||!payments||!Array.isArray(payments.data)||
    payments.has_more!==false||payments.data.length!==1)
  throw new Error('Exactly one paid invoice payment is required');
 const item=payments.data[0];
 const intent=ref(item?.payment?.payment_intent);
 if(item.invoice&&ref(item.invoice)!==invoiceId)
  throw new Error('Invoice payment belongs to another invoice');
 if(item.status!=='paid'||item.payment?.type!=='payment_intent'||
    !id('pi',intent))
  throw new Error('Only an attributed successful TEST PaymentIntent is accepted');
 return intent;
}
export function projectPaidTestCharge(command,paymentIntent,charge){
 if(!command?.p_paid||!['invoice.paid','checkout.session.completed',
  'checkout.session.async_payment_succeeded'].includes(command?.p_event_type))
  throw new Error('No eligible TEST paid billing event');
 const monthly=command.p_event_type==='invoice.paid';
 const amount=monthly?1000:10000;
 const source=command.p_source_id;
 if(!id(monthly?'in':'cs_test',source)||
  paymentIntent?.livemode!==false||paymentIntent.status!=='succeeded'||
  paymentIntent.currency!=='eur'||paymentIntent.amount_received!==amount||
  !id('pi',paymentIntent.id)||
  !id('cus',ref(paymentIntent.customer))||
  ref(paymentIntent.customer)!==command.p_customer_id||
  charge?.livemode!==false||charge?.paid!==true||!id('ch',charge.id)||
  ref(charge.payment_intent)!==paymentIntent.id||
  ref(paymentIntent.latest_charge)!==charge.id||
  ref(charge.customer)!==command.p_customer_id||
  charge.currency!=='eur'||charge.amount!==amount)
  throw new Error('Paid event has no matching successful Stripe TEST charge');
 return {
  p_source_reference:source,
  p_charge_id:charge.id,
  p_payment_intent_id:paymentIntent.id,
  p_customer_id:command.p_customer_id,
  p_reversed:charge.refunded===true||charge.disputed===true||
   (Number.isInteger(charge.amount_refunded)&&charge.amount_refunded>0)
 };
}
