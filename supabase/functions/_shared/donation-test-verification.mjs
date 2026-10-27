/** Validate signed Stripe TEST donation line items and settled charge.
 * No user IDs or privileges can be derived from frontend metadata.
 * Receipts are private and cannot grant Premium or fiscal deductions.
 */
const id=(prefix,value)=>typeof value==='string'&&
 new RegExp('^'+prefix+'_[a-zA-Z0-9_]{6,180}$').test(value);
export const stripeRef=value=>typeof value==='string'?value:value?.id||null;
export function checkTestDonationLine(lines,product,amount,frequency){
 if(!Array.isArray(lines)||lines.length!==1||
  !id('prod',product)||!Number.isSafeInteger(amount)||
  amount<100||amount>100000||!['once','monthly'].includes(frequency))
  throw new Error('Invalid TEST donation line or amount');
 const item=lines[0],price=item?.price;
 if(item?.quantity!==1||stripeRef(price?.product)!==product||
  price?.livemode!==false||price.currency!=='eur'||
  price.unit_amount!==amount||
  (frequency==='monthly'?
   (price.type!=='recurring'||price.recurring?.interval!=='month'||
    price.recurring?.interval_count!==1):
   (price.type!=='one_time')))
  throw new Error('Unrecognized TEST donation price or line');
 return true;
}
export function checkDonationCharge(paymentIntent,charge,amount,customerId){
 if(!id('pi',paymentIntent?.id)||paymentIntent.livemode!==false||
  paymentIntent.status!=='succeeded'||paymentIntent.currency!=='eur'||
  paymentIntent.amount_received!==amount||
  stripeRef(paymentIntent.customer)!==customerId||
  !id('ch',charge?.id)||charge.livemode!==false||charge.paid!==true||
  charge.currency!=='eur'||charge.amount!==amount||
  stripeRef(charge.customer)!==customerId||
  stripeRef(paymentIntent.latest_charge)!==charge.id||
  stripeRef(charge.payment_intent)!==paymentIntent.id)
  throw new Error('TEST donation lacks a verified paid charge');
 return {paymentIntentId:paymentIntent.id,chargeId:charge.id,
  reversed:charge.refunded===true||charge.disputed===true||
   (Number.isInteger(charge.amount_refunded)&&charge.amount_refunded>0)};
}
export function requireSingleTestInvoicePayment(list,invoiceId){
 if(!id('in',invoiceId)||list?.has_more!==false||
  !Array.isArray(list.data)||list.data.length!==1)
  throw new Error('Unexpected invoice payment cardinality');
 const item=list.data[0],pi=stripeRef(item?.payment?.payment_intent);
 if(item.status!=='paid'||item.payment?.type!=='payment_intent'||
  !id('pi',pi)||
  (item.invoice&&stripeRef(item.invoice)!==invoiceId))
  throw new Error('Invoice has no verified paid PaymentIntent');
 return pi;
}
export function acceptTestDonationReversal(event,charge){
 const obj=event?.data?.object;
 if(event?.livemode!==false||obj?.livemode!==false||
  charge?.livemode!==false||!id('evt',event?.id)||
  !id('ch',charge?.id))
  throw new Error('Unsigned or invalid TEST reversal');
 const type=event.type;
 if(!['charge.refunded','charge.dispute.created','refund.created','refund.updated'].includes(type))
  throw new Error('Unsupported donation reversal');
 if((type==='charge.refunded'?obj.id:stripeRef(obj.charge))!==charge.id)
  throw new Error('Reversal points to another charge');
 if(type.startsWith('refund.')&&!id('re',obj.id))
  throw new Error('Invalid refund ID');
 if(type==='charge.dispute.created'&&!id('du',obj.id))
  throw new Error('Invalid dispute ID');
 return charge.refunded===true||charge.disputed===true||
  (Number.isInteger(charge.amount_refunded)&&charge.amount_refunded>0);
}
