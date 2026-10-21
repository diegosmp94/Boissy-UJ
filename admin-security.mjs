/** Admin authentication bootstrap. No privilege inferred from the user's email or metadata.
 * Server checks (app_private.is_admin) remain authoritative for all sensitive RPCs.
 */
import {supabaseConfig} from './auth-config.mjs';

const el=(tag,cls='',text=null)=>{
 const n=document.createElement(tag);if(cls)n.className=cls;
 if(text!==null)n.textContent=String(text);return n;
};
export function isVerifiedAdmin(userId,verifiedId,roles,level){
 return Boolean(supabaseConfig.adminEnabled&&userId&&userId===verifiedId
  &&Array.isArray(roles)&&roles.includes('admin')&&level==='aal2');
}
export async function adminSessionStatus(api,expectedId=null){
 const [userResult,mfaResult]=await Promise.all([
  api.auth.getUser(),api.auth.mfa.getAuthenticatorAssuranceLevel()
 ]);
 const user=userResult.data?.user;
 if(userResult.error||mfaResult.error||!user?.id||expectedId&&user.id!==expectedId)
  return {status:'signed-out',userId:null,level:null,roles:[]};
 const rolesResult=await api.from('user_roles').select('role').eq('user_id',user.id);
 if(rolesResult.error)return {status:'unverified',userId:user.id,level:null,roles:[]};
 const roles=(rolesResult.data||[]).map(r=>r.role);
 const level=mfaResult.data?.currentLevel||'aal1';
 return {status:!roles.includes('admin')?'supporter':level==='aal2'?'admin':'mfa-required',
  userId:user.id,level,roles};
}
function status(root,message,isError=false){
 const out=root.querySelector('[data-mfa-message]');
 if(out){out.textContent=message;out.dataset.error=String(isError);}
}
/** Render QR only for a verified admin account. Never persist TOTP secrets in browser storage. */
export async function mountAdminMfaSetup(container,api,userId){
 if(!supabaseConfig.adminEnabled||!container?.isConnected||!api||!userId)return;
 const current=await adminSessionStatus(api,userId);
 if(!container.isConnected||!['admin','mfa-required'].includes(current.status))return;
 const root=el('section','admin-mfa-card');
 root.setAttribute('aria-label','Sécuriser la connexion administrateur');
 root.append(el('span','tiny-label','DOUBLE AUTHENTIFICATION'),el('h3','','Accès administrateur'));
 const message=el('p','admin-mfa-message');message.dataset.mfaMessage='';
 message.setAttribute('role','status');message.setAttribute('aria-live','polite');
 root.append(message);container.append(root);
 if(current.status==='admin'){
  status(root,'Compte administrateur vérifié avec MFA AAL2. Les outils de gestion sont accessibles.');
  const link=el('a','admin-mfa-open','Ouvrir l’administration →');link.href='#/control-center';root.append(link);
  return;
 }
 status(root,'Le rôle administrateur est attribué, mais les outils restent verrouillés tant que ton application d’authentification n’a pas validé un code.');
 const area=el('div','admin-mfa-workflow');root.append(area);
 let factorId=null,loading=false;
 const begin=el('button','auth-submit','Configurer ou vérifier le second facteur');
 begin.type='button';area.append(begin);
 const inputLabel=el('label','auth-field','Code à 6 chiffres de l’application');
 const code=el('input');code.type='text';code.inputMode='numeric';
 code.autocomplete='one-time-code';code.maxLength=6;
 code.pattern='[0-9]{6}';code.placeholder='000000';inputLabel.append(code);
 const verify=el('button','auth-submit','Vérifier le code et ouvrir l’accès');
 verify.type='button';verify.disabled=true;
 const qrHolder=el('div','admin-mfa-qr');
 async function loadFactor(){
  if(loading)return;
  loading=true;begin.disabled=true;
  status(root,'Vérification des facteurs de sécurité…');
  try{
   const session=await adminSessionStatus(api,userId);
   if(!root.isConnected||session.status!=='mfa-required')return;
   const existing=await api.auth.mfa.listFactors();
   if(existing.error)throw existing.error;
   const verified=(existing.data?.totp||[]).find(f=>f.status==='verified');
   qrHolder.replaceChildren();
   if(verified){
    factorId=verified.id;
    status(root,'Un second facteur est déjà associé à ton compte. Entre le code de ton application.');
   }else{
    const pending=(existing.data?.totp||[]).find(f=>f.status==='unverified');
    if(pending){
      // A previously unverified factor has no safely recoverable QR; remove it before enrolling.
      const removal=await api.auth.mfa.unenroll({factorId:pending.id});
      if(removal.error)throw removal.error;
    }
    const enrollment=await api.auth.mfa.enroll({factorType:'totp',friendlyName:'Boissy-UJ Administration'});
    if(enrollment.error||!enrollment.data?.id)throw enrollment.error||new Error('Factor unavailable');
    factorId=enrollment.data.id;
    const qr=enrollment.data.totp?.qr_code;
    if(typeof qr==='string'&&/^data:image\/svg\+xml(?:;base64|;utf8)?,/i.test(qr)){
      const img=el('img');img.src=qr;img.alt='QR à scanner dans une application d’authentification';
      img.width=175;img.height=175;qrHolder.append(img);
    }
    const secret=enrollment.data.totp?.secret;
    if(secret){
     const details=el('details');
     details.append(el('summary','','Saisir manuellement le code de configuration'));
     const key=el('code','',secret);details.append(key);qrHolder.append(details);
    }
    status(root,'Scanne le QR dans ton application d’authentification, puis indique son code à six chiffres. Ne partage pas ce QR.');
   }
   if(root.isConnected){
    area.append(qrHolder,inputLabel,verify);
    verify.disabled=false;begin.disabled=true;code.focus();
   }
  }catch{
   if(root.isConnected){status(root,'Impossible de préparer le MFA. Réessaie depuis ta session connectée.',true);begin.disabled=false;}
  }finally{loading=false;}
 }
 begin.addEventListener('click',()=>void loadFactor());
 verify.addEventListener('click',async()=>{
  if(loading||!factorId)return;
  const value=code.value.trim();
  if(!/^[0-9]{6}$/.test(value)){status(root,'Entre un code numérique de six chiffres.',true);return;}
  loading=true;verify.disabled=true;code.value='';
  status(root,'Vérification du second facteur…');
  try{
   const currentUser=await api.auth.getUser();
   if(currentUser.error||currentUser.data?.user?.id!==userId)throw new Error('Wrong account');
   const challenge=await api.auth.mfa.challenge({factorId});
   if(challenge.error||!challenge.data?.id)throw new Error('Challenge failed');
   const checked=await api.auth.mfa.verify({factorId,challengeId:challenge.data.id,code:value});
   if(checked.error)throw checked.error;
   const secured=await adminSessionStatus(api,userId);
   if(!root.isConnected)return;
   if(secured.status!=='admin')throw new Error('AAL2 not confirmed');
   qrHolder.replaceChildren();
   status(root,'Double authentification réussie : le panneau administrateur est maintenant disponible.');
   area.replaceChildren();
   const link=el('a','admin-mfa-open','Accéder au panneau de gestion →');link.href='#/control-center';area.append(link);
  }catch{
   if(root.isConnected){status(root,'Code refusé ou expiré. Vérifie l’heure de ton téléphone puis réessaie.',true);verify.disabled=false;}
  }finally{loading=false;}
 });
}
