/** Client-side UX decision for switching to a TOTP app on the same phone.
 * No authentication state, secrets or TOTP codes are stored here.
 */
export function mfaCodeEntryOpen(root){
 const panel=root?.querySelector?.('.admin-mfa-card[data-mfa-code-ready="true"]');
 return Boolean(panel?.isConnected&&
   panel.querySelector?.('input[autocomplete="one-time-code"]')?.isConnected);
}
/** Independent from admin permissions; every actual action is checked by Supabase. */
export function mfaReturnDisposition(status,ownerId){
 if(!ownerId||typeof ownerId!=='string'||!status)return 'clear';
 if(status.status==='unverified')return 'retry';
 if(status.userId!==ownerId)return 'clear';
 if(status.status==='mfa-required'||status.status==='admin')return 'preserve';
 return 'clear';
}
