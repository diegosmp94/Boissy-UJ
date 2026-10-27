/**
 * Stage 89: MFA AAL2 staging-only QR entry control for free club events.
 * Every admission goes through the server. Camera frames/QR never leave
 * this device except the selected QR sent to its own Supabase RPC via TLS.
 */
import {adminSessionStatus} from './admin-security.mjs';
import {canUseFreeTickets} from './free-ticket-staging-config.mjs';

const el=(tag,cls='',content=null)=>{
 const n=document.createElement(tag);if(cls)n.className=cls;
 if(content!==null)n.textContent=String(content);
 return n;
};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const QR=/^BUJ1:([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):[0-9a-f]{64}$/;
export const SCAN_OUTCOMES=Object.freeze({
 accepted:{success:true,label:'Entrée confirmée par le serveur · billet consommé'},
 already_used:{success:false,label:'Billet déjà utilisé · entrée refusée'},
 cancelled:{success:false,label:'Billet annulé · entrée refusée'},
 invalid_code:{success:false,label:'Code invalide · entrée refusée'},
 not_found:{success:false,label:'Billet inconnu ou QR périmé · entrée refusée'},
 event_unavailable:{success:false,label:'Événement indisponible au contrôle · entrée refusée'},
 rate_limited:{success:false,label:'Trop de contrôles ; réessaie ultérieurement'},
 rejected:{success:false,label:'Entrée refusée par le serveur'}
});
export function normalizeFreeTicketScan(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||
  !Object.hasOwn(SCAN_OUTCOMES,value.status))return null;
 return Object.freeze({...SCAN_OUTCOMES[value.status],status:value.status});
}
export function validScannedFreeTicket(code,eventId){
 const match=typeof code==='string'?QR.exec(code):null;
 return Boolean(match&&UUID.test(eventId)&&match[1]===eventId);
}
export function normalizeScanReport(row,eventId){
 if(!row||typeof row!=='object'||Array.isArray(row)||
  !UUID.test(eventId)||row.event_id!==eventId||
  typeof row.title!=='string'||
  !Number.isSafeInteger(row.capacity)||row.capacity<1||
  !['issued','checked_in','cancelled'].every(key=>
   Number.isSafeInteger(row[key])&&row[key]>=0)||
  row.issued+row.checked_in>row.capacity||
  !Array.isArray(row.recent))return null;
 return {
  title:row.title,capacity:row.capacity,
  issued:row.issued,checked_in:row.checked_in,cancelled:row.cancelled,
  recent:row.recent.filter(item=>
   item&&Object.hasOwn(SCAN_OUTCOMES,item.status)&&
   Number.isFinite(Date.parse(item.at))
  ).slice(0,20).map(item=>({
   at:item.at,status:item.status
  }))
 };
}
export async function scanCameraAvailable(environment=globalThis){
 if(typeof environment?.BarcodeDetector!=='function'||
  typeof environment.BarcodeDetector.getSupportedFormats!=='function')return false;
 try{
  const formats=await environment.BarcodeDetector.getSupportedFormats();
  return Array.isArray(formats)&&formats.includes('qr_code');
 }catch{return false;}
}
const dt=x=>new Intl.DateTimeFormat('fr-FR',{
 dateStyle:'short',timeStyle:'short',timeZone:'Europe/Paris'
}).format(new Date(x));

export async function mountAdminFreeTicketScanner(root,api,expectedUserId){
 root.replaceChildren(el('h2','','Contrôle d’entrée QR · billets gratuits'));
 const intro=el('p','admin-workflow-status',
  'Contrôle réservé au personnel administrateur MFA. Un QR n’autorise une entrée qu’après confirmation de Supabase.');
 const message=el('p','admin-workflow-status','Vérification sécurisée du dispositif…');
 message.setAttribute('role','status');
 message.setAttribute('aria-live','polite');
 const eventPicker=el('select','admin-form-control');
 eventPicker.setAttribute('aria-label','Événement à contrôler');
 const eventsLabel=el('label','admin-form-field','Événement du club');
 eventsLabel.append(eventPicker);
 const stats=el('section','admin-scan-stats');
 stats.setAttribute('aria-label','État des entrées');
 const camera=el('video','admin-scan-video');
 camera.autoplay=true;camera.playsInline=true;camera.muted=true;
 camera.setAttribute('aria-label','Caméra de contrôle des QR');
 camera.hidden=true;
 const start=el('button','admin-secondary-btn','Ouvrir la caméra');
 const stop=el('button','admin-secondary-btn','Fermer la caméra');
 start.type='button';stop.type='button';stop.disabled=true;
 const controls=el('div','admin-scan-actions');controls.append(start,stop);
 const manual=el('form','admin-scan-manual');
 const label=el('label','admin-form-field','Saisir ou coller un code de billet');
 const qrInput=el('input','admin-form-control');
 qrInput.type='password';qrInput.autocomplete='off';
 qrInput.spellcheck=false;qrInput.maxLength=106;
 qrInput.placeholder='BUJ1:…';qrInput.setAttribute('aria-label','Code QR privé du billet');
 label.append(qrInput);
 const verify=el('button','admin-primary-btn','Vérifier et enregistrer l’entrée');
 verify.type='submit';manual.append(label,verify);
 const last=el('section','admin-scan-history');
 last.append(el('h3','','Journal récent, sans données personnelles'));
 const history=el('div','admin-scan-history-items');
 const refresh=el('button','admin-secondary-btn','Actualiser les entrées');
 refresh.type='button';last.append(refresh,history);
 root.append(intro,message,eventsLabel,controls,camera,manual,stats,last);
 let stream=null,frame=null,scanning=false,busy=false,closing=false;
 let selectedEvent='',generation=0,detector=null,observer=null;
 const active=()=>root.isConnected&&!closing&&canUseFreeTickets();
 const authorized=async()=>{
  if(!active())return false;
  const result=await adminSessionStatus(api,expectedUserId);
  return active()&&result.status==='admin'&&result.level==='aal2'&&
   result.userId===expectedUserId&&result.roles?.includes('admin');
 };
 function stopCamera(){
  scanning=false;
  if(frame!==null&&typeof cancelAnimationFrame==='function'){
   cancelAnimationFrame(frame);frame=null;
  }
  const old=stream;stream=null;
  if(old)for(const track of old.getTracks())track.stop();
  camera.pause();camera.srcObject=null;camera.hidden=true;
  stop.disabled=true;start.disabled=false;
 }
 function cleanup(){
  if(closing)return;
  closing=true;generation++;
  stopCamera();qrInput.value='';
  observer?.disconnect();
  document.removeEventListener('visibilitychange',onHidden);
 }
 function onHidden(){if(document.visibilityState==='hidden')stopCamera();}
 document.addEventListener('visibilitychange',onHidden);
 observer=new MutationObserver(()=>{if(!root.isConnected)cleanup();});
 observer.observe(document.body,{subtree:true,childList:true});
 function block(msg){
  stopCamera();message.textContent=msg;
  verify.disabled=true;start.disabled=true;
  refresh.disabled=true;eventPicker.disabled=true;
  qrInput.value='';
 }
 if(!canUseFreeTickets()){
  block('Contrôle QR désactivé sur le site principal ; préproduction indépendante obligatoire.');
  return cleanup;
 }
 if(!await authorized()){
  block('Administrateur MFA AAL2 requis. Aucune entrée accordée.');
  return cleanup;
 }
 async function loadEvents(){
  const gen=++generation;
  stopCamera();qrInput.value='';eventPicker.disabled=true;
  message.textContent='Lecture des événements depuis Supabase…';
  if(!await authorized())return block('Autorisation MFA expirée.');
  try{
   const result=await api.rpc('admin_list_free_ticket_scan_events');
   if(!active()||gen!==generation)return;
   if(result.error||!Array.isArray(result.data))
    throw Error('Event list unavailable');
   const valid=result.data.filter(e=>e&&UUID.test(e.event_id)&&
    typeof e.title==='string'&&e.title.length<=150&&
    Number.isSafeInteger(e.capacity)&&e.capacity>0);
   eventPicker.replaceChildren();
   for(const e of valid){
    const option=el('option','',e.title+' · '+dt(e.starts_at));
    option.value=e.event_id;eventPicker.append(option);
   }
   if(!valid.length)return block('Aucun événement gratuit vérifiable.');
   eventPicker.disabled=false;
   selectedEvent=valid.some(e=>e.event_id===selectedEvent)?
    selectedEvent:valid[0].event_id;
   eventPicker.value=selectedEvent;
   verify.disabled=false;start.disabled=false;refresh.disabled=false;
   message.textContent='Choisissez un événement, puis contrôlez les billets auprès du serveur.';
   await loadReport();
  }catch{
   if(active()&&gen===generation)block('Impossible de charger les événements. Aucun contrôle autorisé.');
  }
 }
 async function loadReport(){
  const eventId=selectedEvent;
  if(!active()||!UUID.test(eventId))return;
  stats.replaceChildren();history.replaceChildren();
  try{
   if(!await authorized())return block('Autorisation MFA expirée.');
   const r=await api.rpc('admin_free_ticket_entry_report',{p_event_id:eventId});
   if(!active()||eventId!==selectedEvent)return;
   const report=r.error?null:normalizeScanReport(r.data,eventId);
   if(!report)throw Error('Invalid report');
   stats.append(el('h3','',report.title),
    el('p','','Jauge : '+report.capacity+' · Billets en attente : '+
     report.issued+' · Entrées confirmées : '+report.checked_in+
     ' · Annulés : '+report.cancelled));
   if(!report.recent.length){
    history.append(el('p','admin-workflow-status','Aucun contrôle enregistré.'));
   }
   for(const item of report.recent){
    history.append(el('p','admin-scan-history-row',
     dt(item.at)+' · '+SCAN_OUTCOMES[item.status].label));
   }
  }catch{
   if(active())stats.append(el('p','admin-workflow-status',
    'Journal momentanément indisponible. Aucun chiffre présumé.'));
  }
 }
 async function sendCode(code){
  if(busy||!active())return;
  busy=true;const id=selectedEvent;
  stopCamera();qrInput.value='';
  verify.disabled=true;eventPicker.disabled=true;
  message.textContent='Vérification serveur en cours… aucune entrée encore confirmée.';
  try{
   if(!validScannedFreeTicket(code,id)){
    message.textContent='QR illisible ou lié à un autre événement. Entrée refusée.';
    return;
   }
   if(!await authorized())return block('Accès révoqué ou MFA expiré. Entrée refusée.');
   // Never trust the client result unless RPC succeeds with an exact status.
   const r=await api.rpc('admin_scan_free_event_ticket',{
    p_event_id:id,p_qr:code
   });
   if(!active()||selectedEvent!==id)return;
   const outcome=r.error?null:normalizeFreeTicketScan(r.data);
   if(!outcome)throw Error('Unconfirmed scan');
   message.textContent=outcome.label;
   message.dataset.scanResult=outcome.success?'accepted':'rejected';
  }catch{
   if(active()){
    message.dataset.scanResult='unconfirmed';
    message.textContent='Connexion interrompue ou réponse incertaine : NE PAS laisser entrer. Consultez le journal serveur avant de recommencer.';
   }
  }finally{
   busy=false;
   if(active()){
    verify.disabled=false;eventPicker.disabled=false;
    void loadReport();
   }
  }
 }
 manual.addEventListener('submit',event=>{
  event.preventDefault();
  const code=qrInput.value;
  qrInput.value='';
  void sendCode(code);
 });
 async function loop(){
  if(!scanning||!active()||!stream||busy)return;
  try{
   if(camera.readyState>=2&&detector){
    const codes=await detector.detect(camera);
    if(!scanning||!active()||busy)return;
    const found=Array.isArray(codes)
     ?codes.find(c=>typeof c.rawValue==='string'&&QR.test(c.rawValue)):null;
    if(found){const code=found.rawValue;stopCamera();void sendCode(code);return;}
   }
  }catch{
   stopCamera();
   if(active())message.textContent='Lecture caméra indisponible. Utilisez la saisie manuelle.';
   return;
  }
  if(scanning&&active())frame=requestAnimationFrame(()=>void loop());
 }
 start.addEventListener('click',async()=>{
  if(busy||scanning||!active())return;
  if(!await authorized())return block('MFA requis pour utiliser la caméra.');
  if(!await scanCameraAvailable(window)||!navigator.mediaDevices?.getUserMedia){
   message.textContent='Scanner QR non disponible dans ce navigateur : utilisez la saisie manuelle.';
   return;
  }
  try{
   const opened=await navigator.mediaDevices.getUserMedia({
    audio:false,video:{facingMode:{ideal:'environment'}}
   });
   if(!active()){opened.getTracks().forEach(x=>x.stop());return;}
   stream=opened;detector=new window.BarcodeDetector({formats:['qr_code']});
   camera.srcObject=opened;camera.hidden=false;
   await camera.play();
   if(!active()){stopCamera();return;}
   scanning=true;start.disabled=true;stop.disabled=false;
   message.textContent='Caméra active : présentez le QR. Aucune entrée ne sera accordée hors ligne.';
   frame=requestAnimationFrame(()=>void loop());
  }catch{
   stopCamera();
   if(active())message.textContent=
    'Accès caméra indisponible ou refusé. Utilisez la saisie manuelle.';
  }
 });
 stop.addEventListener('click',()=>{
  stopCamera();
  if(active())message.textContent='Caméra arrêtée. Aucune entrée validée.';
 });
 eventPicker.addEventListener('change',()=>{
  selectedEvent=eventPicker.value;stopCamera();qrInput.value='';
  message.dataset.scanResult='';void loadReport();
 });
 refresh.addEventListener('click',()=>{if(!busy)void loadEvents();});
 await loadEvents();
 return cleanup;
}
