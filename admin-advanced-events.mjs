/** Step 87: real MFA-gated advanced event/booking-window administration.
 * All mutations execute a protected SQL RPC. No reservation, payment or QR.
 */
import {adminSessionStatus} from './admin-security.mjs';
import {eventDateInput} from './admin-event-rules.mjs';
const el=(tag,cls='',value=null)=>{
 const n=document.createElement(tag);if(cls)n.className=cls;
 if(value!==null)n.textContent=String(value);return n;
};
const input=(type='text')=>{const n=el('input','admin-form-control');n.type=type;return n;};
const selection=opts=>{const n=el('select','admin-form-control');
 for(const [value,label] of opts){const o=el('option','',label);o.value=value;n.append(o);}
 return n;
};
const field=(title,node)=>{const l=el('label','admin-form-field',title);l.append(node);return l;};
export function advancedEventEuros(value,{optional=false}={}){
 if(optional&&(value===null||value===undefined||String(value).trim()===''))return null;
 const valueText=String(value??'').trim().replace(',','.');
 if(!/^(?:0|[1-9]\d{0,4})(?:\.\d{1,2})?$/.test(valueText))
  throw new Error('Montant en euros invalide (de 0 à 10 000 €).');
 const [units,decimals='']=valueText.split('.');
 const cents=Number(units)*100+Number(decimals.padEnd(2,'0'));
 if(cents>1000000)throw new Error('Montant maximal : 10 000 €.');
 return cents;
}
const validDate=value=>!value||(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
 &&Number.isFinite(Date.parse(value)));
export function validateAdvancedEvent(d){
 if(!d||String(d.title||'').trim().length<4||
   String(d.title||'').trim().length>150)return 'Titre : 4 à 150 caractères.';
 if(typeof d.description!=='string'||d.description.length>4000)
  return 'Description trop longue.';
 if(!['club','sport','community','other'].includes(d.category))
  return 'Catégorie incorrecte.';
 if(String(d.location||'').length>160)return 'Lieu trop long.';
 if(!['public','premium'].includes(d.access))return 'Accès invalide.';
 if(!['free','paid'].includes(d.booking))return 'Type de billetterie invalide.';
 if(!['none','premium'].includes(d.priority))return 'Priorité invalide.';
 if(!['not_open','closed'].includes(d.status))
  return 'L’ouverture des réservations attend l’étape 88.';
 if(typeof d.published!=='boolean')return 'Publication invalide.';
 if(!validDate(d.start)||!validDate(d.end)||Boolean(d.start)!==Boolean(d.end)||
  (d.start&&Date.parse(d.end)<=Date.parse(d.start))||
  (d.published&&!d.start))return 'Dates de l’événement incohérentes.';
 if(!validDate(d.priorityStart)||!validDate(d.priorityEnd))return 'Fenêtre de priorité incorrecte.';
 if(d.priority==='none'&&(d.priorityStart||d.priorityEnd))
  return 'Efface les dates de priorité désactivée.';
 if(d.priority==='premium'&&
  (d.access!=='public'||!d.priorityStart||!d.priorityEnd||!d.start||
   Date.parse(d.priorityEnd)<=Date.parse(d.priorityStart)||
   Date.parse(d.priorityEnd)>Date.parse(d.start)))
  return 'La priorité Premium doit précéder le début d’un événement public.';
 const capacity=String(d.capacity??'').trim();
 if(capacity&&(!/^\d+$/.test(capacity)||Number(capacity)<1||Number(capacity)>100000))
  return 'Jauge : entier entre 1 et 100 000.';
 try{
  const price=advancedEventEuros(d.price);
  const premium=advancedEventEuros(d.premiumPrice,{optional:true});
  if((d.booking==='free'&&(price!==0||(premium!==null&&premium!==0)))||
   (d.booking==='paid'&&price<=0))
   return 'Un événement gratuit ne facture rien ; un événement payant exige un prix.';
  if(premium!==null&&premium>price)return 'Le prix Premium ne peut dépasser le tarif public.';
 }catch(e){return e.message;}
 return null;
}
export function advancedEventRpcArgs(d,row=null){
 const invalid=validateAdvancedEvent(d);
 if(invalid)throw new Error(invalid);
 return {
  p_id:row?.id||null,p_title:d.title.trim(),p_description:d.description,
  p_category:d.category,p_starts_at:d.start?new Date(d.start).toISOString():null,
  p_ends_at:d.end?new Date(d.end).toISOString():null,
  p_location_label:String(d.location||'').trim(),
  p_capacity:d.capacity===''?null:Number(d.capacity),
  p_access_kind:d.access,p_booking_kind:d.booking,
  p_price_cents:advancedEventEuros(d.price),
  p_premium_price_cents:advancedEventEuros(d.premiumPrice,{optional:true}),
  p_priority_kind:d.priority,
  p_priority_starts_at:d.priorityStart?new Date(d.priorityStart).toISOString():null,
  p_priority_ends_at:d.priorityEnd?new Date(d.priorityEnd).toISOString():null,
  p_booking_status:d.status,p_published:d.published,
  p_expected_updated_at:row?.updated_at||null
 };
}
export function validateReservationWindow(d,event){
 if(!event?.id||!Number.isInteger(event.capacity)||event.capacity<=0||
  !event.starts_at)return 'Définis la jauge et la date de l’événement avant les créneaux.';
 if(!validDate(d.opens)||!validDate(d.closes)||!d.opens||!d.closes||
  Date.parse(d.opens)>=Date.parse(d.closes)||
  Date.parse(d.closes)>Date.parse(event.starts_at))
  return 'La réservation doit ouvrir et fermer avant le début de l’événement.';
 if(!/^\d+$/.test(String(d.capacity))||Number(d.capacity)<1||
  Number(d.capacity)>event.capacity)return 'Quota supérieur à la jauge de l’événement.';
 if(!['public','premium'].includes(d.access))return 'Niveau d’accès inconnu.';
 if(!['draft','scheduled','closed'].includes(d.status))return 'Statut de créneau inconnu.';
 if(event.access_kind==='premium'&&d.access==='public')
  return 'Un événement Premium ne possède pas de créneau public.';
 if(event.access_kind==='public'&&d.access==='premium'&&
  (event.priority_kind!=='premium'||!event.priority_starts_at||
   !event.priority_ends_at||
   Date.parse(d.opens)<Date.parse(event.priority_starts_at)||
   Date.parse(d.closes)>Date.parse(event.priority_ends_at)))
  return 'Le créneau Premium doit appartenir à la période de priorité.';
 return null;
}
export function reservationWindowRpcArgs(d,event,row=null){
 const err=validateReservationWindow(d,event);
 if(err)throw new Error(err);
 return {p_id:row?.id||null,p_event_id:event.id,
  p_opens_at:new Date(d.opens).toISOString(),
  p_closes_at:new Date(d.closes).toISOString(),
  p_capacity:Number(d.capacity),p_access_kind:d.access,
  p_status:d.status,p_expected_updated_at:row?.updated_at||null};
}

export async function mountAdminAdvancedEvents(root,api,userId){
 root.replaceChildren(el('h2','','Événements avancés et créneaux'),
  el('p','admin-workflow-status',
   'Préparation du calendrier et des réservations, sans billet, débit ou QR actif.'));
 const state=el('p','admin-workflow-status','Chargement des événements…');
 state.setAttribute('role','status');
 const pick=selection([['new','+ Nouvel événement']]);
 const reload=el('button','admin-secondary-btn','Actualiser les événements');reload.type='button';
 const form=el('form','admin-operation-form');
 const title=input(),description=el('textarea','admin-form-control');
 title.maxLength=150;description.maxLength=4000;description.rows=5;
 const category=selection([['club','Vie du club'],['sport','Sport'],
  ['community','Communauté'],['other','Autre']]);
 const start=input('datetime-local'),end=input('datetime-local'),location=input();
 location.maxLength=160;
 const capacity=input('number');capacity.min='1';capacity.max='100000';capacity.step='1';
 const access=selection([['public','Public'],['premium','Premium']]);
 const booking=selection([['free','Gratuit'],['paid','Payant (sans encaissement)']]);
 const price=input(),premiumPrice=input();
 price.inputMode='decimal';premiumPrice.inputMode='decimal';price.value='0';
 const priority=selection([['none','Sans priorité'],['premium','Priorité Premium']]);
 const priorityStart=input('datetime-local'),priorityEnd=input('datetime-local');
 const bookingStatus=selection([['not_open','Réservations non ouvertes'],
  ['closed','Réservations closes']]);
 const published=input('checkbox');
 for(const [name,node] of [
  ['Titre',title],['Description',description],['Catégorie',category],
  ['Date et heure de début',start],['Date et heure de fin',end],
  ['Lieu (facultatif)',location],['Jauge totale',capacity],['Accès',access],
  ['Billetterie',booking],['Prix public (€)',price],
  ['Prix Premium (€ — facultatif)',premiumPrice],
  ['Priorité',priority],['Ouverture de la priorité',priorityStart],
  ['Fin de la priorité',priorityEnd],['Statut des réservations',bookingStatus],
  ['Publier la fiche événement',published]
 ])form.append(field(name,node));
 const save=el('button','admin-primary-btn','Enregistrer l’événement');save.type='submit';
 form.append(save);
 const windows=el('section','admin-event-windows');
 windows.append(el('h3','','Créneaux de réservation'));
 const slotNote=el('p','admin-workflow-status','Enregistre d’abord un événement avec une jauge.');
 slotNote.setAttribute('role','status');
 const slots=selection([['new','+ Nouveau créneau']]);
 const slotForm=el('form','admin-operation-form');
 const slotOpen=input('datetime-local'),slotClose=input('datetime-local');
 const slotCapacity=input('number');slotCapacity.min='1';slotCapacity.max='100000';slotCapacity.step='1';
 const slotAccess=selection([['public','Public'],['premium','Premium']]);
 const slotStatus=selection([['draft','Brouillon'],['scheduled','Préparé (non activé)'],
  ['closed','Clôturé']]);
 for(const [name,node] of [
  ['Ouverture des réservations',slotOpen],['Fermeture des réservations',slotClose],
  ['Quota du créneau',slotCapacity],['Accès au créneau',slotAccess],
  ['Statut du créneau',slotStatus]
 ])slotForm.append(field(name,node));
 const saveSlot=el('button','admin-primary-btn','Enregistrer le créneau');saveSlot.type='submit';
 slotForm.append(saveSlot);
 windows.append(slotNote,field('Choisir un créneau',slots),slotForm);
 root.append(state,field('Événement à modifier',pick),reload,form,windows);
 let records=[],slotRows=[],busy=false,version=0,slotVersion=0;
 let eventConfirmation=null,slotConfirmation=null;
 const selected=()=>records.find(e=>e.id===pick.value)||null;
 const selectedSlot=()=>slotRows.find(e=>e.id===slots.value)||null;
 const getDraft=()=>({
  title:title.value,description:description.value,category:category.value,
  start:start.value,end:end.value,location:location.value,
  capacity:capacity.value,access:access.value,booking:booking.value,
  price:price.value,premiumPrice:premiumPrice.value,priority:priority.value,
  priorityStart:priorityStart.value,priorityEnd:priorityEnd.value,
  status:bookingStatus.value,published:published.checked
 });
 const windowDraft=()=>({
  opens:slotOpen.value,closes:slotClose.value,capacity:slotCapacity.value,
  access:slotAccess.value,status:slotStatus.value
 });
 const permitted=async()=>{
  const x=await adminSessionStatus(api,userId);
  return root.isConnected&&x.status==='admin'&&x.level==='aal2'&&x.userId===userId;
 };
 function paintEvent(){
  const e=selected();
  title.value=e?.title||'';description.value=e?.description||'';
  category.value=e?.category||'club';
  start.value=eventDateInput(e?.starts_at);end.value=eventDateInput(e?.ends_at);
  location.value=e?.location_label||'';capacity.value=e?.capacity??'';
  access.value=e?.access_kind||'public';booking.value=e?.booking_kind||'free';
  price.value=String((e?.price_cents??0)/100);
  premiumPrice.value=e?.premium_price_cents==null?'':String(e.premium_price_cents/100);
  priority.value=e?.priority_kind||'none';
  priorityStart.value=eventDateInput(e?.priority_starts_at);
  priorityEnd.value=eventDateInput(e?.priority_ends_at);
  bookingStatus.value=['closed','not_open'].includes(e?.booking_status)
   ?e.booking_status:'not_open';
  published.checked=e?.published===true;
  eventConfirmation=null;slotConfirmation=null;
  void loadSlots(e);
 }
 function paintSlot(){
  const s=selectedSlot();
  slotOpen.value=eventDateInput(s?.opens_at);
  slotClose.value=eventDateInput(s?.closes_at);
  slotCapacity.value=s?.capacity??'';
  slotAccess.value=s?.access_kind||'public';
  slotStatus.value=s?.status||'draft';
  slotConfirmation=null;
 }
 async function loadSlots(event){
  const seq=++slotVersion;
  slots.replaceChildren(new Option('+ Nouveau créneau','new'));
  slotRows=[];paintSlot();
  slotForm.hidden=!event;slots.disabled=!event;
  if(!event){slotNote.textContent='Enregistre un événement avec jauge avant les créneaux.';return;}
  slotNote.textContent='Chargement des créneaux protégés…';
  try{
   if(!await permitted())throw new Error('MFA expired');
   const response=await api.rpc('admin_list_event_reservation_windows',{p_event_id:event.id});
   if(seq!==slotVersion||!root.isConnected||selected()?.id!==event.id)return;
   if(response.error||!Array.isArray(response.data))throw new Error('Slots unavailable');
   slotRows=response.data;
   slots.replaceChildren(new Option('+ Nouveau créneau','new'));
   for(const s of slotRows){
    const caption=new Date(s.opens_at).toLocaleDateString('fr-FR')+
     ' · '+s.status+' · '+s.capacity+' place(s)';
    slots.append(new Option(caption,s.id));
   }
   paintSlot();
   slotNote.textContent=slotRows.length+' créneau(x) enregistré(s). '+
    'Aucune réservation ouverte ni quota consommé.';
   saveSlot.disabled=false;
  }catch{
   if(seq!==slotVersion||!root.isConnected)return;
   slotNote.textContent='Créneaux indisponibles : vérifie les droits et réessaie.';
   saveSlot.disabled=true;
  }
 }
 async function loadEvents(focus=null){
  const seq=++version;
  save.disabled=true;reload.disabled=true;
  if(!await permitted()){
   state.textContent='Accès administrateur MFA AAL2 obligatoire.';return;
  }
  try{
   const response=await api.rpc('admin_list_advanced_events');
   if(seq!==version||!root.isConnected)return;
   if(response.error||!Array.isArray(response.data))throw new Error('Events unavailable');
   records=response.data;
   pick.replaceChildren(new Option('+ Nouvel événement','new'));
   for(const e of records)pick.append(new Option(e.title+' · '+
    (e.published?'Publié':'Brouillon')+' · '+e.booking_kind,e.id));
   pick.value=records.some(e=>e.id===focus)?focus:'new';
   paintEvent();save.disabled=false;reload.disabled=false;
   state.textContent=records.length+' événement(s) chargé(s), réservation désactivée.';
  }catch{
   if(root.isConnected)state.textContent='Lecture impossible, aucune modification autorisée.';
  }
 }
 pick.addEventListener('change',paintEvent);
 slots.addEventListener('change',paintSlot);
 reload.addEventListener('click',()=>{if(!busy)void loadEvents(selected()?.id);});
 for(const node of form.querySelectorAll('input,select,textarea'))
  node.addEventListener('input',()=>{eventConfirmation=null;});
 for(const node of slotForm.querySelectorAll('input,select'))
  node.addEventListener('input',()=>{slotConfirmation=null;});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||save.disabled)return;
  const old=selected();let args;
  try{args=advancedEventRpcArgs(getDraft(),old);}
  catch(e){state.textContent=e.message;return;}
  const key=JSON.stringify(args);
  if((args.p_published||old?.published||
   args.p_booking_kind==='paid'||args.p_priority_kind==='premium')&&
   eventConfirmation!==key){
   eventConfirmation=key;
   state.textContent='Action sensible : vérifie tarifs et accès, puis clique de nouveau pour confirmer.';
   return;
  }
  busy=true;save.disabled=true;
  try{
   if(!await permitted())throw new Error('MFA expired');
   const result=await api.rpc('admin_save_advanced_event',args);
   if(result.error||!result.data)throw new Error('Event conflict');
   if(root.isConnected)await loadEvents(result.data);
  }catch{
   if(root.isConnected)state.textContent='Modification refusée : conflit ou droits insuffisants. Actualise.';
  }finally{busy=false;if(root.isConnected)save.disabled=false;}
 });
 slotForm.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||saveSlot.disabled)return;
  const parent=selected();let args;
  try{args=reservationWindowRpcArgs(windowDraft(),parent,selectedSlot());}
  catch(e){slotNote.textContent=e.message;return;}
  const key=JSON.stringify(args);
  if((args.p_status==='scheduled'||selectedSlot()?.status==='scheduled')
   &&slotConfirmation!==key){
   slotConfirmation=key;
   slotNote.textContent='Créneau préparé : confirme en cliquant de nouveau. Cela ne permet pas de réserver.';
   return;
  }
  busy=true;saveSlot.disabled=true;
  try{
   if(!await permitted())throw new Error('MFA expired');
   const result=await api.rpc('admin_save_event_reservation_window',args);
   if(result.error||!result.data)throw new Error('Slot conflict');
   if(root.isConnected)await loadSlots(parent);
  }catch{
   if(root.isConnected)slotNote.textContent=
    'Créneau refusé : chevauchement, dépassement de jauge ou version périmée.';
  }finally{busy=false;if(root.isConnected)saveSlot.disabled=false;}
 });
 await loadEvents();
}
