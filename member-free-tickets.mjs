/**
 * Step 88 · Own free-event reservations with locally rendered opaque QR.
 * Production is read-only and never calls ticketing RPCs.
 * No bearer secret persisted in browser storage, URLs, remote services or logs.
 */
import {canUseFreeTickets} from './free-ticket-staging-config.mjs';
const el=(tag,cls='',value=null)=>{
 const node=document.createElement(tag);if(cls)node.className=cls;
 if(value!==null)node.textContent=String(value);return node;
};
const date=value=>new Intl.DateTimeFormat('fr-FR',{
 dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Paris'
}).format(new Date(value));
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function validPersonalTicketCode(code,eventId){
 return typeof code==='string'&&code.length===106&&
  typeof eventId==='string'&&UUID.test(eventId)&&
  code.startsWith('BUJ1:'+eventId+':')&&
  /^[0-9a-f]{64}$/.test(code.slice(-64));
}
export function ownFreeTicketEventEligible(e,now=Date.now()){
 return Boolean(e&&e.published===true&&e.booking_kind==='free'&&
  e.access_kind==='public'&&e.priority_kind==='none'&&
  e.price_cents===0&&e.booking_status==='open'&&
  Number.isSafeInteger(e.capacity)&&e.capacity>0&&
  Number.isFinite(Date.parse(e.starts_at))&&Date.parse(e.starts_at)>now);
}
let qrScriptPromise=null;
export async function ensureLocalTicketQr(){
 if(typeof window==='undefined'||typeof document==='undefined')
  throw new Error('Browser required');
 if(typeof window.QRCode==='function')return window.QRCode;
 if(!qrScriptPromise){
  qrScriptPromise=new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   script.src=new URL('./assets/vendor/qrcode.min.js',import.meta.url).href;
   script.async=true;
   script.onload=()=>typeof window.QRCode==='function'
    ?resolve(window.QRCode):reject(new Error('Local QR library unavailable'));
   script.onerror=()=>reject(new Error('Local QR library unavailable'));
   document.head.append(script);
  }).catch(error=>{qrScriptPromise=null;throw error;});
 }
 return qrScriptPromise;
}
export function normalizeMyFreeTicketRows(data){
 if(!Array.isArray(data))return null;
 return data.filter(row=>row&&typeof row.event_id==='string'&&
  UUID.test(row.event_id)&&typeof row.title==='string'&&
  typeof row.ticket_status==='string'&&
  ['issued','cancelled','checked_in'].includes(row.ticket_status)&&
  Number.isFinite(Date.parse(row.starts_at))&&
  Number.isFinite(Date.parse(row.issued_at))&&
  typeof row.can_reissue==='boolean')
 .slice(0,100);
}
const label=s=>({
 issued:'Réservation enregistrée',
 cancelled:'Réservation annulée',
 checked_in:'Entrée déjà utilisée'
})[s]||'Billet non vérifié';

export async function mountMemberFreeTickets(root,api,expectedUserId,alive){
 const section=el('section','member-free-tickets');
 section.append(el('h3','','Mes billets gratuits'));
 const status=el('p','auth-footnote');
 status.setAttribute('role','status');
 const note=el('p','auth-footnote',
  'Aucun paiement ni billet disponible sur le site public. Les réservations gratuites restent fermées tant que la recette multi-comptes n’est pas homologuée.');
 const area=el('div','member-free-tickets-list');
 section.append(status,note,area);root.append(section);
 if(!canUseFreeTickets()){
  status.textContent='Billetterie gratuite non activée.';
  return;
 }
 note.textContent='Préproduction uniquement : un QR est personnel. La régénération remplace et invalide l’ancien QR. Ne le partagez pas.';
 let generation=0,busy=false;
 const current=()=>root.isConnected&&section.isConnected&&
  typeof alive==='function'&&alive()&&canUseFreeTickets();
 const verified=async()=>{
  if(!current())return false;
  const response=await api.auth.getUser();
  return current()&&!response.error&&
   response.data?.user?.id===expectedUserId&&
   Boolean(response.data?.user?.email_confirmed_at);
 };
 async function displaySecret(container,eventId,code){
  if(!validPersonalTicketCode(code,eventId))
   throw new Error('Unexpected ticket payload');
  // QR library is bundled under ./assets, never remote.
  const QR=await ensureLocalTicketQr();
  if(!current())return;
  area.querySelectorAll('.member-ticket-secret').forEach(x=>x.remove());
  const holder=el('div','member-ticket-secret');
  const image=el('div','member-ticket-qr');
  image.setAttribute('role','img');
  image.setAttribute('aria-label','QR personnel confidentiel pour ce billet gratuit');
  holder.append(el('p','auth-footnote',
   'Votre QR temporairement affiché sur cet appareil. Ne le partagez pas.'),
   image);
  container.append(holder);
  new QR(image,{text:code,width:224,height:224,
   colorDark:'#111111',colorLight:'#ffffff',
   correctLevel:QR.CorrectLevel.M});
  // Never store or transmit code to another API.
 }
 async function load(){
  const gen=++generation;
  area.replaceChildren();
  status.textContent='Vérification serveur des réservations gratuites…';
  if(!await verified()||!current()||gen!==generation){
   status.textContent='Connexion vérifiée nécessaire.';
   return;
  }
  try{
   const [mine,events]=await Promise.all([
    api.rpc('member_my_free_event_tickets'),
    api.from('club_events')
     .select('id,title,starts_at,ends_at,published,booking_kind,access_kind,priority_kind,price_cents,booking_status,capacity')
     .eq('published',true).eq('booking_kind','free')
     .eq('access_kind','public').limit(60)
   ]);
   if(!current()||gen!==generation)return;
   const owned=mine.error?null:normalizeMyFreeTicketRows(mine.data);
   if(!owned||events.error||!Array.isArray(events.data))
    throw new Error('Read unavailable');
   const ownIds=new Set(owned.map(x=>x.event_id));
   let shown=0;
   for(const ticket of owned){
    const article=el('article','member-free-ticket-item');
    article.append(el('strong','',ticket.title),
     el('p','auth-footnote',date(ticket.starts_at)+' · '+label(ticket.ticket_status)));
    if(ticket.ticket_status==='issued'&&ticket.can_reissue){
     const recover=el('button','auth-text-button','Afficher un nouveau QR');
     recover.type='button';
     const cancel=el('button','auth-text-button','Annuler ma réservation');
     cancel.type='button';
     recover.addEventListener('click',()=>void perform('reissue',ticket.event_id,article));
     cancel.addEventListener('click',()=>{
      if(window.confirm('Annuler définitivement ce billet gratuit ? Il ne pourra pas être réservé une deuxième fois.'))
       void perform('cancel',ticket.event_id,article);
     });
     article.append(recover,cancel);
    }
    area.append(article);shown++;
   }
   for(const event of events.data.filter(e=>ownFreeTicketEventEligible(e)&&!ownIds.has(e.id))){
    const article=el('article','member-free-ticket-item');
    article.append(el('strong','',event.title),
     el('p','auth-footnote',date(event.starts_at)+' · Gratuit · disponibilité confirmée lors de la réservation'));
    const action=el('button','auth-text-button','Réserver une place gratuite');
    action.type='button';
    action.addEventListener('click',()=>void perform('reserve',event.id,article));
    article.append(action);area.append(article);shown++;
   }
   status.textContent=shown
    ?'Réservations personnelles vérifiées par le serveur.'
    :'Aucun billet ou événement réservable vérifié pour le moment.';
  }catch{
   if(current()&&gen===generation){
    area.replaceChildren();
    status.textContent='Impossible de vérifier les billets pour le moment. Aucun QR inventé.';
   }
  }
 }
 async function perform(kind,eventId,article){
  if(busy||!current()||!UUID.test(eventId))return;
  busy=true;generation++;
  const buttons=area.querySelectorAll('button');
  buttons.forEach(b=>b.disabled=true);
  area.querySelectorAll('.member-ticket-secret').forEach(x=>x.remove());
  status.textContent='Validation du billet par Supabase…';
  try{
   if(!await verified())throw new Error('Identity mismatch');
   const rpc=({
    reserve:'request_free_event_ticket',
    reissue:'member_reissue_free_event_ticket',
    cancel:'cancel_my_free_event_ticket'
   })[kind];
   if(!rpc)throw new Error('Unknown operation');
   const response=await api.rpc(rpc,{p_event_id:eventId});
   if(!current()||response.error||!response.data)
    throw new Error('Ticket operation refused');
   if(kind==='cancel'){
    await load();
    return;
   }
   await displaySecret(article,eventId,response.data);
   if(current())status.textContent=
    'QR personnel affiché. Une nouvelle génération invalidera immédiatement ce code.';
   // Do not reload here: it would discard the just-issued QR.
  }catch{
   if(current())status.textContent=
    'Opération indisponible ou refusée. Réactualisez votre espace avant de réessayer.';
  }finally{
   busy=false;
   if(current())buttons.forEach(b=>b.disabled=false);
  }
 }
 await load();
}
