/** Own Premium status, checked exclusively by a Supabase server RPC.
 * This module cannot create billing sessions or grant access.
 */
export const PREMIUM_STATUS_STATES=Object.freeze([
 'active','none','expired','revoked','upcoming','unverified'
]);
const fmt=validUntil=>new Intl.DateTimeFormat('fr-FR',{
 dateStyle:'long',timeZone:'Europe/Paris'
}).format(new Date(validUntil));

export function normalizePremiumStatus(data,now=Date.now()){
 if(!data||typeof data!=='object'||Array.isArray(data))return null;
 if(!PREMIUM_STATUS_STATES.includes(data.state))return null;
 const plan=['monthly','annual'].includes(data.plan)?data.plan:null;
 const expiry=typeof data.valid_until==='string'
  &&Number.isFinite(Date.parse(data.valid_until))?data.valid_until:null;
 if(data.state==='active'){
  // Browser time can only REMOVE a stale badge, never grant Premium.
  if(data.active!==true||!plan||!expiry)return null;
  if(Date.parse(expiry)<=now)return {state:'expired',active:false,plan,valid_until:expiry};
  return {state:'active',active:true,plan,valid_until:expiry};
 }
 if(data.active!==false)return null;
 if(data.state==='none'||data.state==='unverified'){
  if(plan!==null||expiry!==null)return null;
  return {state:data.state,active:false,plan:null,valid_until:null};
 }
 if(!plan||!expiry)return null;
 return {state:data.state,active:false,plan,valid_until:expiry};
}
export function premiumStatusText(result){
 switch(result?.state){
 case 'active':return 'Premium actif · '+(result.plan==='monthly'?'mensuel':'12 mois')
   +' · échéance le '+fmt(result.valid_until)+'.';
 case 'expired':return 'Premium expiré. Dernière échéance : '+fmt(result.valid_until)+'.';
 case 'revoked':return 'Premium révoqué. Les avantages ne sont plus accessibles.';
 case 'upcoming':return 'Droit enregistré pour une période future, non encore actif.';
 case 'unverified':return 'Confirme ton adresse e-mail pour consulter un éventuel droit Premium.';
 case 'none':return 'Aucun droit Premium actif. Les paiements ne sont pas ouverts.';
 default:return 'Statut Premium indisponible. Aucun avantage n’est attribué depuis le navigateur.';
 }
}
const el=(tag,cls='',content=null)=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(content!==null)node.textContent=String(content);
 return node;
};
export function mountMemberPremiumStatus(root,api,expectedUserId,isActive=()=>root?.isConnected){
 if(!root?.isConnected||!api?.rpc||!expectedUserId)return null;
 const area=el('section','member-premium-status');
 area.setAttribute('aria-label','État de mon abonnement Premium');
 area.append(el('h3','','Mon Premium'));
 const notice=el('p','member-premium-status-detail','Vérification sécurisée du statut Premium…');
 notice.setAttribute('role','status');
 notice.setAttribute('aria-live','polite');
 const refresh=el('button','auth-text-button','Actualiser mon statut Premium');
 refresh.type='button';
 const small=el('p','auth-footnote',
  'Lecture serveur uniquement. Cette rubrique ne donne aucun accès payant ni moyen de paiement.');
 area.append(notice,refresh,small);root.append(area);
 let seq=0;
 const alive=()=>area.isConnected&&isActive();
 async function reload(){
  const run=++seq;
  notice.textContent='Vérification sécurisée du statut Premium…';
  refresh.disabled=true;
  try{
   const user=await api.auth.getUser();
   if(!alive()||run!==seq)return;
   if(user.error||user.data?.user?.id!==expectedUserId){
    notice.textContent='Session expirée. Reconnecte-toi pour consulter ton statut.';
    return;
   }
   const response=await api.rpc('member_my_premium_status');
   if(!alive()||run!==seq)return;
   if(response.error){
    notice.textContent='Impossible de vérifier ton statut Premium auprès de Supabase.';
    return;
   }
   const normalized=normalizePremiumStatus(response.data);
   notice.textContent=premiumStatusText(normalized);
   area.dataset.premiumStatus=normalized?.state||'unknown';
  }catch{
   if(alive()&&run===seq)
    notice.textContent='Statut Premium momentanément indisponible. Aucun accès supplémentaire accordé.';
  }finally{
   if(alive()&&run===seq)refresh.disabled=false;
  }
 }
 refresh.addEventListener('click',()=>void reload());
 void reload();
 return {refresh:reload};
}
