/** Test-only Stripe financial-event safety gate.
 * Events are classified only AFTER Stripe verified the raw webhook signature.
 * No transactions, identities, secrets, entitlement grants or web requests.
 *
 * Reversals have no verified checkout/invoice -> member reconciliation yet.
 * Acknowledging them as "ignored" would silently keep disputed Premium access.
 * Block and retry rather than inventing a member or revoking an unrelated grant.
 */
export const STRIPE_TEST_REVERSAL_EVENTS=Object.freeze([
 'refund.created','refund.updated','refund.failed','charge.refunded','charge.refund.updated',
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

/** Private financial RPCs may send a server key ONLY to an exact Supabase
 * test-project hostname. Call before constructing Stripe or any HTTP request.
 * Never guess the project ID from an Origin header or untrusted payload.
 */
export function verifiedStripeTestProjectOrigin(projectUrl,projectRef){
 if(typeof projectRef!=='string'||!/^[a-z0-9]{20}$/.test(projectRef)||
    projectRef==='dahzewvbybujqhogumte')
  throw new Error('A distinct acknowledged staging project is required');
 let url;
 try{url=new URL(projectUrl);}catch{throw new Error('Invalid TEST Supabase URL');}
 if(url.protocol!=='https:'||url.hostname!==projectRef+'.supabase.co'||
    (url.pathname!==''&&url.pathname!=='/')||url.search||url.hash||
    url.username||url.password||url.port||
    /:443(?:\/|$)/.test(projectUrl))
  throw new Error('Stripe TEST project endpoint is not an exact Supabase staging root');
 return url.origin;
}
