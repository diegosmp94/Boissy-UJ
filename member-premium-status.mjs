import {premiumTestMemberConfig,canUseTestPremiumManagement} from './premium-test-member-config.mjs';

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
/** Staging-only renewal projection. Unknown or conflicting input never creates a button. */
export function normalizePremiumRenewalStatus(data){
 if(!data||typeof data!=='object'||Array.isArray(data))return null;
 const states=['none','unverified','annual_no_renewal','renews','cancel_scheduled','multiple_monthly'];
 if(!states.includes(data.renewal)||typeof data.can_cancel!=='boolean')return null;
 const stamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?x:null;
 const month=stamp(data.monthly_paid_until);
 const annual=stamp(data.annual_paid_until);
 const effective=stamp(data.cancellation_effective_at);
 if(data.can_cancel!==(data.renewal==='renews')||
    (['renews','cancel_scheduled','multiple_monthly'].includes(data.renewal)&&!month))
  return null;
 return {renewal:data.renewal,can_cancel:data.can_cancel,
  monthly_paid_until:month,annual_paid_until:annual,cancellation_effective_at:effective};
}
export function premiumLifecycleText(status,renewal=null){
 if(status?.state==='active'&&status.plan==='annual'){
  const extra=renewal?.renewal==='renews'
   ?' Un abonnement mensuel TEST distinct reste renouvelable.'
   :renewal?.renewal==='cancel_scheduled'
    ?' Le renouvellement mensuel TEST distinct est programmé pour s’arrêter.'
    :'';
  return 'Formule de 12 mois : pas de reconduction automatique. '+
   'Au terme de la période payée, le droit expire sans nouveau débit.'+extra;
 }
 if(status?.state==='active'&&status.plan==='monthly'){
  if(renewal?.renewal==='cancel_scheduled')
   return 'Renouvellement mensuel arrêté en mode TEST. '+
    'L’accès déjà payé reste valable jusqu’à son échéance'+
    (renewal.cancellation_effective_at?' ; arrêt prévu le '+fmt(renewal.cancellation_effective_at):'')+'.';
  if(renewal?.renewal==='renews')
   return 'Renouvellement mensuel encore prévu en mode TEST. '+
    'Un arrêt demandé à échéance ne rembourse ni n’interrompt la période déjà réglée.';
  if(renewal?.renewal==='multiple_monthly')
   return 'Plusieurs abonnements mensuels actifs : contactez le club pour une vérification individuelle.';
  return 'Les abonnements mensuels se renouvelleraient après leur activation. '+
   'La gestion du renouvellement n’est pas ouverte sur ce site.';
 }
 if(status?.state==='expired')
  return 'L’échéance est passée : aucun renouvellement annuel automatique.';
 if(status?.state==='revoked')
  return 'L’accès a été retiré ; contactez le club pour une vérification.';
 return 'Les paiements et renouvellements ne sont pas encore disponibles sur le site public.';
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
 const cycle=el('p','member-premium-cycle',
  'La gestion des échéances Premium reste indisponible sans vérification du compte.');
 const cancel=el('button','auth-text-button member-premium-cancel',
  'Arrêter le renouvellement mensuel TEST');
 cancel.type='button';cancel.hidden=true;
 const support=el('a','member-premium-support','Besoin d’aide ? Contacter le club');
 support.href='#/contact';
 const small=el('p','auth-footnote',
  'Lecture serveur uniquement · aucun débit réel ni achat activé.');
 area.append(notice,cycle,cancel,refresh,support,small);root.append(area);
 let seq=0;
 const alive=()=>area.isConnected&&isActive();
 async function reload(){
  const run=++seq;
  notice.textContent='Vérification sécurisée du statut Premium…';
  cycle.textContent='Vérification de la période et du renouvellement…';
  cancel.hidden=true;
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
   cycle.textContent=premiumLifecycleText(normalized);
   // Staging management is opt-in and MUST match a different Supabase project.
   if(normalized?.active&&canUseTestPremiumManagement()){
    try{
     const renewalResponse=await api.rpc('member_my_premium_renewal');
     if(!alive()||run!==seq)return;
     const renewal=renewalResponse.error?null:
      normalizePremiumRenewalStatus(renewalResponse.data);
     cycle.textContent=premiumLifecycleText(normalized,renewal);
     cancel.hidden=!(renewal?.renewal==='renews'&&renewal.can_cancel);
    }catch{
     if(!alive()||run!==seq)return;
     cycle.textContent='Gestion du renouvellement TEST momentanément indisponible.';
    }
   }
  }catch{
   if(alive()&&run===seq)
    notice.textContent='Statut Premium momentanément indisponible. Aucun accès supplémentaire accordé.';
  }finally{
   if(alive()&&run===seq)refresh.disabled=false;
  }
 }
 refresh.addEventListener('click',()=>void reload());
 cancel.addEventListener('click',async()=>{
  if(cancel.disabled||cancel.hidden||!alive()||!canUseTestPremiumManagement())return;
  const confirmed=window.confirm(
   'Confirmer l’arrêt du prochain renouvellement mensuel en mode TEST ? '+
   'La période déjà payée reste valable jusqu’à son échéance.');
  if(!confirmed)return;
  cancel.disabled=true;cancel.hidden=true;refresh.disabled=true;
  cycle.textContent='Demande sécurisée d’arrêt du renouvellement TEST…';
  try{
   const user=await api.auth.getUser();
   if(!alive()||user.error||user.data?.user?.id!==expectedUserId)throw new Error('Identity');
   const response=await api.functions.invoke('premium-stripe-test-cancel',{
    body:{action:'cancel_renewal'}
   });
   if(!alive()||response.error||
     response.data?.status!=='renewal_cancellation_scheduled')
    throw new Error('Cancellation not confirmed');
   if(alive())await reload();
  }catch{
   if(alive())cycle.textContent=
    'L’arrêt du renouvellement TEST n’a pas été confirmé. Réessaie ou contacte le club.';
  }finally{
   if(alive()){cancel.disabled=false;refresh.disabled=false;}
  }
 });
 void reload();
 return {refresh:reload};
}
