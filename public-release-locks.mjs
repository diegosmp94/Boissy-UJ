/** Public Pages safety policy: static compile-time release locks only.
 * NOT an entitlement oracle: private Supabase gates and Stripe keys must be
 * audited separately before any future product activation.
 */
export const BOISSY_PUBLIC_URL='https://diegosmp94.github.io/Boissy-UJ/';
export const PUBLIC_RELEASE_LOCKS=Object.freeze({
 indexing:false,
 livePayments:false,
 testPaymentsOnPublic:false,
 freeTicketingOnPublic:false,
 premiumVotingOnPublic:false,
 fffAutomaticSync:false
});
export const PUBLIC_RELEASE_MODE='technical-preview-noindex';
