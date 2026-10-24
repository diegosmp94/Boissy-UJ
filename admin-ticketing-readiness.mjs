/**
 * Real free-event preparation checker. A protected admin read is available,
 * but reservations / QR issuance / scans are NOT enabled: they require a
 * separately approved atomic server-side backend and a real capacity recipe.
 */
import {adminSessionStatus} from './admin-security.mjs';

const el=(tag,cls='',text=null)=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(text!==null)node.textContent=String(text);
 return node;
};
export function freeTicketReadiness(event,now=Date.now()){
 if(event?.booking_kind!=='free'||event?.access_kind!=='public')
  return Object.freeze({ready:false,label:'Billetterie payante ou accès privé non pris en charge'});
 if(!event?.published)return Object.freeze({ready:false,label:'Événement non publié'});
 if(!Number.isSafeInteger(event.capacity)||event.capacity<1)
  return Object.freeze({ready:false,label:'Jauge à définir avant toute réservation'});
 const start=Date.parse(event.starts_at||'');
 const end=Date.parse(event.ends_at||'');
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)
  return Object.freeze({ready:false,label:'Dates à corriger'});
 if(start<=now)return Object.freeze({ready:false,label:'Événement commencé ou passé'});
 if(event.booking_status!=='open')
  return Object.freeze({ready:false,label:'Réservations non ouvertes par le club'});
 return Object.freeze({
  // "ready" means only the *catalogue metadata* could be used by a future
  // ticketing backend; never a real booking or entry entitlement.
  ready:true,label:'Préparation possible · aucun billet QR émis'
 });
}
export async function readFreeTicketingReadiness(api,now=Date.now()){
 let result;
 try{result=await api.rpc('admin_list_free_events');}
 catch{return {available:false,events:[]};}
 if(result?.error||!Array.isArray(result?.data))
  return {available:false,events:[]};
 const events=result.data
  .filter(item=>item&&typeof item.id==='string')
  .map(item=>Object.freeze({
   id:item.id,title:String(item.title||'Événement sans titre').slice(0,150),
   capacity:item.capacity,
   ...freeTicketReadiness(item,now)
  }));
 return Object.freeze({available:true,events,
  metadataReady:events.filter(event=>event.ready).length,
  total:events.length,liveIssuance:false,liveQrScanning:false});
}
export async function mountAdminTicketingReadiness(root,api,userId,navigate){
 root.replaceChildren(el('h2','','Billetterie gratuite · préparation'));
 const status=el('p','admin-workflow-status','Vérification MFA…');
 status.setAttribute('role','status');
 root.append(status);
 let check;
 try{check=await adminSessionStatus(api,userId);}
 catch{check=null;}
 if(!root.isConnected)return;
 if(check?.status!=='admin'){
  status.textContent='Administrateur MFA AAL2 requis. Aucun billet accessible.';
  return;
 }
 const notice=el('p','admin-fff-info',
  'Aucune réservation ou entrée par QR n’est encore activée. Ce diagnostic examine uniquement les événements du club, sans collecter de visiteurs ni générer de code. Une jauge confirmée, les règles d’annulation et un serveur de contrôle à usage unique seront obligatoires.');
 root.append(notice);
 const refresh=el('button','admin-secondary-btn','Actualiser les prérequis');
 refresh.type='button';
 const actions=el('div','admin-overview-shortcuts');
 const openEvent=el('button','admin-shortcut','Ouvrir les événements gratuits');
 openEvent.type='button';
 openEvent.addEventListener('click',()=>{
  if(root.isConnected&&typeof navigate==='function')navigate('events');
 });
 actions.append(openEvent);
 const list=el('div','admin-active-chantiers');
 root.append(refresh,actions,list);
 let busy=false,version=0;
 const draw=async()=>{
  if(busy||!root.isConnected)return;
  busy=true;refresh.disabled=true;const serial=++version;
  status.textContent='Lecture des événements autorisés…';
  try{
   const verified=await adminSessionStatus(api,userId);
   if(!root.isConnected||serial!==version)return;
   if(verified.status!=='admin'){
    list.replaceChildren();
    status.textContent='Accès interrompu : MFA ou rôle administrateur expiré.';
    return;
   }
   const report=await readFreeTicketingReadiness(api);
   if(!root.isConnected||serial!==version)return;
   list.replaceChildren();
   if(!report.available){
    status.textContent='Impossible de consulter les événements : aucune billetterie disponible.';
    return;
   }
   status.textContent=report.metadataReady+' / '+report.total+
     ' événements préparent les prérequis catalogue. Zéro réservation et zéro validation QR activées.';
   if(!report.events.length){
    list.append(el('p','admin-workflow-status',
      'Aucun événement gratuit enregistré. Crée et valide d’abord un événement officiel.'));
   }
   for(const event of report.events){
    const article=el('article','admin-active-workstream');
    article.append(el('strong','',event.title),
      el('p','',event.label),
      el('p','','Jauge : '+(Number.isSafeInteger(event.capacity)&&event.capacity>0
       ?String(event.capacity):'non confirmée')));
    list.append(article);
   }
  }catch{
   if(root.isConnected)status.textContent='Lecture temporairement indisponible.';
  }finally{busy=false;if(refresh.isConnected)refresh.disabled=false;}
 };
 refresh.addEventListener('click',()=>void draw());
 void draw();
}
