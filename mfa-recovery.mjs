/** Pure MFA factor helpers. All factors include unfinished enrolments; totp alone
 * contains only verified factors in Supabase JS.
 */
export const ADMIN_FACTOR_NAME='Boissy-UJ Administration';

export function findAdminTotpFactors(data,name=ADMIN_FACTOR_NAME){
  const all=Array.isArray(data?.all)?data.all:[];
  const typed=Array.isArray(data?.totp)?data.totp:[];
  const byId=new Map([...all,...typed].filter(f=>f&&typeof f.id==='string').map(f=>[f.id,f]));
  const factors=Array.from(byId.values()).filter(f=>f.factor_type==='totp');
  const verified=factors.find(f=>f.status==='verified')||null;
  // Never remove any other MFA factor. Unfinished Boissy-UJ TOTP only.
  const pending=factors.find(f=>f.status==='unverified'&&f.friendly_name===name)||null;
  return {verified,pending};
}

export function mfaErrorMessage(error,stage='setup'){
  const code=String(error?.code||'').toLowerCase();
  const status=Number(error?.status||0);
  if(code==='mfa_factor_name_conflict')
    return 'Une configuration MFA inachevée existe déjà. Réessaie pour la reprendre ou la remplacer.';
  if(code==='mfa_factor_limit_exceeded')
    return 'Le nombre maximal de facteurs MFA est atteint. Un administrateur devra vérifier les facteurs enregistrés.';
  if(code==='mfa_totp_enroll_disabled'||code==='mfa_totp_verify_disabled')
    return 'Le MFA TOTP est désactivé dans Supabase Auth. Il doit être autorisé dans le tableau de bord Supabase.';
  if(code==='mfa_challenge_expired'||code==='mfa_verification_failed'||code==='invalid_otp')
    return 'Le code est incorrect ou expiré. Utilise le code actuel de ton application.';
  if(status===401||code==='bad_jwt'||code==='session_not_found'||code==='refresh_token_not_found')
    return 'La session a expiré. Reconnecte-toi dans Mon espace avant de recommencer.';
  if(status===429||code.includes('rate_limit'))
    return 'Trop de tentatives MFA. Réessaie après le délai indiqué par Supabase.';
  if(stage==='remove')
    return 'Impossible de remplacer le facteur MFA non vérifié. Aucun facteur déjà validé n’a été supprimé.';
  if(stage==='verify')
    return 'Le code MFA n’a pas pu être validé. Vérifie ton application et réessaie.';
  if(stage==='listing')
    return 'Impossible de lire les facteurs MFA depuis Supabase. Réessaie avec une session connectée.';
  return 'Impossible de préparer le MFA. Réessaie depuis ta session connectée.';
}
