/** Stage 90: member paid-event TEST offers, discounts and owned order states.
 * Hard OFF on public production. No browser-calculated pricing or checkout ID.
 */
import {canUseFreeTickets} from './free-ticket-staging-config.mjs';
import {ensureLocalTicketQr,validPersonalTicketCode}
 from './member-free-tickets.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const el=(tag,cls='',text=null)=>{const e=document.createElement(tag);
 if(cls)e.className=cls;
 if(text!==null)e.textContent=String(text);
 return e;};
export function normalizeTestTicketOffer(r){
 if(!r||typeof r!=='object'||!UUID.test(r.event_id)||
  typeof r.title!=='string'||!r.title.trim()||
  !Number.isFinite(Date.parse(r.starts_at))||
  !Number.isSafeInteger(r.amount_cents)||
  r.amount_cents<0||r.amount_cents>1000000||
  !['public','premium'].includes(r.tier))return null;
 return {eventId:r.event_id,title:r.title,startsAt:r.starts_at,
  amountCents:r.amount_cents,tier:r.tier};
}
export function normalizeTestTicketOrder(r){
 if(!r||typeof r!=='object'||!UUID.test(r.event_id)||
  typeof r.title!=='string'||!Number.isSafeInteger(r.amount_cents)||
  r.amount_cents<50||r.amount_cents>1000000||
  !['issued','paid_unfulfilled','reversed','expired'].includes(r.status)||
  typeof r.can_reissue!=='boolean')return null;
 return {eventId:r.event_id,title:r.title,status:r.status,
  amountCents:r.amount_cents,canReissue:r.can_reissue};
}
export function safeStripeTestCheckoutUrl(input){
 try{
  const u=new URL(input);
  return u.protocol==='https:'&&u.hostname==='checkout.stripe.com'&&
   u.username===''&&u.password===''&&u.port===''&&
   /^\/c\/pay\/cs_test_[a-zA-Z0-9_\-]+/.test(u.pathname)&&
   u.pathname.length<250?u.href:null;
 }catch{return null;}
}
const euros=x=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'})
 .format(x/100);
const date=x=>new Intl.DateTimeFormat('fr-FR',{
 dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Paris'
}).format(new Date(x));
const orderLabel=status=>({
 issued:'Paiement TEST vérifié · billet délivré : régénérez le QR dans « Mes billets »',
 paid_unfulfilled:'Débit TEST enregistré mais billet non délivré : demander la réconciliation ou le remboursement au club',
 reversed:'Paiement TEST inversé · billet révoqué si inutilisé',
 expired:'Session TEST expirée'
})[status]||'Statut indisponible';

export async function mountMemberPaidTicketTest(root,api,userId,alive){
 const section=el('section','member-ticket-test');
 section.append(el('h3','','Billetterie événementielle · TEST'));
 const message=el('p','auth-footnote');
 message.setAttribute('role','status');
 const panel=el('div','member-ticket-test-offers');
 section.append(message,panel);root.append(section);
 if(!canUseFreeTickets()){
  message.textContent='Billetterie payante et réductions Premium non activées sur le site public.';
  return;
 }
 let busy=false;
 const active=()=>canUseFreeTickets()&&root.isConnected&&section.isConnected&&alive();
 const verified=async()=>{
  if(!active())return false;
  const r=await api.auth.getUser();
  return active()&&!r.error&&r.data?.user?.id===userId&&
   Boolean(r.data.user.email_confirmed_at);
 };
 async function refresh(){
  panel.replaceChildren();message.textContent='Lecture des tarifs et droits TEST depuis Supabase…';
  if(!await verified()){
   message.textContent='Connexion vérifiée requise.';
   return;
  }
  try{
   const [offers,orders]=await Promise.all([
    api.rpc('member_list_eligible_test_ticket_events'),
    api.rpc('member_my_test_paid_tickets')
   ]);
   if(!active())return;
   if(offers.error||orders.error||!Array.isArray(offers.data)||
    !Array.isArray(orders.data))throw Error('Unavailable');
   const rows=offers.data.map(normalizeTestTicketOffer).filter(Boolean);
   const owned=orders.data.map(normalizeTestTicketOrder).filter(Boolean);
   const ownedIds=new Set(owned.filter(x=>x.status!=='expired').map(x=>x.eventId));
   if(!rows.length&&!owned.length){
    message.textContent='Aucun billet payant ou événement TEST éligible actuellement.';
    return;
   }
   message.textContent='Préproduction uniquement · billets et tarifs calculés par le serveur.';
   for(const order of owned){
    const article=el('article','member-ticket-test-card');
    article.append(el('strong','',order.title),
     el('p','auth-footnote',orderLabel(order.status)+
      ' · montant confirmé : '+euros(order.amountCents)));
    panel.append(article);
   }
   for(const offer of rows.filter(x=>!ownedIds.has(x.eventId))){
    const article=el('article','member-ticket-test-card');
    article.append(el('strong','',offer.title),
     el('p','auth-footnote',date(offer.startsAt)+
       ' · '+(offer.tier==='premium'?'Tarif Premium vérifié':'Tarif public')+
       ' : '+euros(offer.amountCents)));
    const action=el('button','auth-text-button',
     offer.amountCents===0?'Obtenir mon billet Premium gratuit (TEST)'
      :'Accéder au paiement Stripe TEST');
    action.type='button';
    action.addEventListener('click',async()=>{
     if(busy||!active())return;
     busy=true;action.disabled=true;message.textContent='Vérification côté serveur…';
     try{
      if(!await verified())throw Error('Identity unavailable');
      if(offer.amountCents===0){
       const ticket=await api.rpc('member_request_premium_test_comp_ticket',
        {p_event_id:offer.eventId});
       if(ticket.error||!validPersonalTicketCode(ticket.data,offer.eventId))
        throw Error('Ticket not granted');
       const QR=await ensureLocalTicketQr();
       if(!active())return;
       panel.querySelectorAll('.member-ticket-secret').forEach(x=>x.remove());
       const holder=el('div','member-ticket-secret');
       const qr=el('div','member-ticket-qr');
       qr.setAttribute('role','img');qr.setAttribute('aria-label','QR personnel Premium TEST');
       holder.append(el('p','auth-footnote',
        'Billet gratuit délivré. Régénérez-le depuis Mes billets si besoin.'),qr);
       article.append(holder);
       new QR(qr,{text:ticket.data,width:224,height:224,
        colorDark:'#111111',colorLight:'#ffffff',
        correctLevel:QR.CorrectLevel.M});
       message.textContent='QR Premium TEST vérifié et affiché sur cet appareil.';
      }else{
       const result=await api.functions.invoke('event-ticket-stripe-test-checkout',{
        body:{event_id:offer.eventId}
       });
       if(result.error||result.data?.status!=='test_checkout_created')
        throw Error('Checkout not created');
       const destination=safeStripeTestCheckoutUrl(result.data.url);
       if(!destination)throw Error('Invalid TEST payment destination');
       if(active())window.location.assign(destination);
      }
     }catch{
      if(active())message.textContent=
       'Opération TEST indisponible. Aucun billet ou paiement n’est confirmé par cette page.';
     }finally{busy=false;if(active())action.disabled=false;}
    });
    article.append(action);panel.append(article);
   }
  }catch{
   if(active()){panel.replaceChildren();message.textContent=
    'Tarifs et billets TEST momentanément indisponibles. Aucune transaction supposée.';}
  }
 }
 await refresh();
}
