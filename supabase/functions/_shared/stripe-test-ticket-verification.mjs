/** Stripe TEST ticket event verification, pure functions. No network or DB. */
const id=(p,x)=>typeof x==='string'&&new RegExp('^'+p+'_[a-zA-Z0-9_]{6,180}$').test(x);
export const stripeId=v=>typeof v==='string'?v:v?.id||null;
export function verifiedTestTicketCheckout(event,items,product){
 const c=event?.data?.object;
 if(event?.livemode!==false||!id('evt',event?.id)||
  !['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)||
  c?.livemode!==false||!id('cs_test',c?.id)||c.mode!=='payment'||
  c.currency!=='eur'||!id('cus',stripeId(c.customer))||
  !Number.isSafeInteger(c.amount_total)||c.amount_total<50||
  c.amount_total>1000000||!id('prod',product)||
  !Array.isArray(items)||items.length!==1)throw Error('Invalid signed TEST ticket checkout');
 const line=items[0],price=line?.price;
 if(line.quantity!==1||line.amount_total!==c.amount_total||
  price?.livemode!==false||stripeId(price?.product)!==product||
  price.currency!=='eur'||price.unit_amount!==c.amount_total||
  price.type!=='one_time'||price.recurring)
  throw Error('Ticket amount and product mismatch');
 return {checkoutId:c.id,amountCents:c.amount_total,
  customerId:stripeId(c.customer),paymentIntentId:stripeId(c.payment_intent),
  paid:c.payment_status==='paid'};
}
export function verifyTestTicketCharge(intent,charge,amount,customer){
 if(!id('pi',intent?.id)||intent.livemode!==false||
  intent.status!=='succeeded'||intent.currency!=='eur'||
  intent.amount_received!==amount||stripeId(intent.customer)!==customer||
  !id('ch',charge?.id)||charge.livemode!==false||
  charge.paid!==true||charge.currency!=='eur'||
  charge.amount!==amount||stripeId(charge.customer)!==customer||
  stripeId(intent.latest_charge)!==charge.id||
  stripeId(charge.payment_intent)!==intent.id)
  throw Error('No verified TEST ticket card payment');
 return {paymentIntentId:intent.id,chargeId:charge.id,
  reversed:charge.refunded===true||charge.disputed===true||
   (Number.isInteger(charge.amount_refunded)&&charge.amount_refunded>0)};
}
export function verifyTestTicketReversal(event,charge){
 const obj=event?.data?.object;
 if(event?.livemode!==false||!id('evt',event?.id)||
  obj?.livemode!==false||charge?.livemode!==false||
  !id('ch',charge.id)||
  !['refund.created','refund.updated','charge.refunded',
   'charge.dispute.created'].includes(event.type))
  throw Error('Invalid signed TEST reversal');
 if((event.type==='charge.refunded'?obj.id:stripeId(obj.charge))!==charge.id)
  throw Error('Reversal references unrelated charge');
 if(event.type.startsWith('refund.')&&!id('re',obj.id))
  throw Error('Missing verified refund ID');
 if(event.type==='charge.dispute.created'&&!id('du',obj.id))
  throw Error('Missing verified dispute ID');
 return event.type==='charge.dispute.created'||
  charge.disputed===true||charge.refunded===true||
  (Number.isInteger(charge.amount_refunded)&&charge.amount_refunded>0);
}
