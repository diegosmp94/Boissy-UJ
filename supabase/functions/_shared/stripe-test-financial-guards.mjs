/** Test-only Stripe financial-event safety gate.
 * Events are classified only AFTER Stripe verified the raw webhook signature.
 * No transactions, identities, secrets, entitlement grants or web requests.
 *
 * Reversals have no verified checkout/invoice -> member reconciliation yet.
 * Acknowledging them as "ignored" would silently keep disputed Premium access.
 * Block and retry rather than inventing a member or revoking an unrelated grant.
 */
export const STRIPE_TEST_REVERSAL_EVENTS=Object.freeze([
 'refund.created','refund.updated','charge.refunded','charge.refund.updated',
 'charge.dispute.created','charge.dispute.updated','charge.dispute.closed',
 'charge.dispute.funds_withdrawn','charge.dispute.funds_reinstated'
]);
export function classifyStripeTestFinancialEvent(event,recognizedBillingEvents){
 if(!event||event.livemode!==false||
   !/^evt_[a-zA-Z0-9_]{6,180}$/.test(String(event.id||''))||
   typeof event.type!=='string')
  throw new Error('Signed Stripe TEST event required');
 if(!Array.isArray(recognizedBillingEvents))
  throw new Error('Expected a fixed reviewed billing event allowlist');
 if(STRIPE_TEST_REVERSAL_EVENTS.includes(event.type)){
  if(!event.data?.object||event.data.object.livemode!==false)
   throw new Error('Reversal object must originate from Stripe TEST');
  return 'financial_hold';
 }
 if(recognizedBillingEvents.includes(event.type))return 'billing';
 return 'ignore';
}
/** Strict published offer, no partial/discounted/prorated Stripe TEST grants.
 * Integer minor currency units only. Does not calculate tax or collect money.
 */
export function validPremiumTestAmount({kind,amount,currency}){
 return currency==='eur'&&Number.isSafeInteger(amount)&&
   ((kind==='monthly'&&amount===1000)||(kind==='annual'&&amount===10000));
}
