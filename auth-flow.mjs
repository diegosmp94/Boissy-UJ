/** Helpers de compte sans effet secondaire ni dépendance navigateur. */
export function authRedirectUrl(location){
  const value=String(location.origin||'')+String(location.pathname||'/');
  const url=new URL(value);
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))
    throw new Error('Origine de redirection non autorisée');
  return url.origin+url.pathname;
}
export function hasAuthCallback(search=''){
  const params=new URLSearchParams(String(search).replace(/^\?/,''));
  return params.has('code')||params.has('error')||params.has('error_code');
}
export function authCallbackError(search=''){
  const params=new URLSearchParams(String(search).replace(/^\?/,''));
  if(!params.has('error')&&!params.has('error_code'))return '';
  const code=params.get('error_code')||'';
  if(code==='otp_expired'||code==='access_denied')return 'Le lien de connexion a expiré ou a déjà été utilisé. Demande un nouveau lien.';
  return 'Le lien de confirmation n’a pas pu être utilisé. Réessaie depuis Mon espace.';
}
export function validateAuthInput(mode,input={}){
  const errors=[];
  const email=String(input.email||'').trim();
  const password=String(input.password||'');
  const displayName=String(input.displayName||'').trim();
  if(!['login','register','reset','newPassword'].includes(mode))
    errors.push('Action de compte invalide.');
  if(mode!=='newPassword'&&(email.length>254||!/^\S+@\S+\.\S+$/.test(email)))
    errors.push('Saisis une adresse e-mail valide.');
  if(['login','register','newPassword'].includes(mode)
     &&(password.length<8||password.length>128))
    errors.push('Le mot de passe doit contenir entre 8 et 128 caractères.');
  if(mode==='register'&&(displayName.length<2||displayName.length>100))
    errors.push('Le nom d’affichage doit contenir entre 2 et 100 caractères.');
  return {valid:errors.length===0,errors,email,password,displayName};
}
