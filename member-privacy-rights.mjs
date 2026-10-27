/** GDPR rights requests: own authenticated identity only, no proxy/guardian guessing.
 * No deletion, sensitive file upload or identity document requested here.
 */
const mk=(tag,cls='',text=null)=>{const x=document.createElement(tag);
 if(cls)x.className=cls;if(text!==null)x.textContent=String(text);return x;};
export const PRIVACY_RIGHTS=Object.freeze({
 access:'Accès à mes données',rectification:'Rectification',
 erasure:'Effacement',restriction:'Limitation du traitement',
 portability:'Portabilité',objection:'Opposition',
 consent_withdrawal:'Retrait d’un consentement'
});
export const PRIVACY_STATES=Object.freeze({
 submitted:'Reçue',in_review:'En cours d’examen',
 awaiting_action:'Actions en cours',completed:'Traitée',rejected:'Réponse motivée'
});
export function privacyRequestInputError(kind,description){
 if(!Object.hasOwn(PRIVACY_RIGHTS,kind))return 'Type de demande invalide.';
 if(typeof description!=='string'||description.length>600||/[\x00-\x1f\x7f]/.test(description))
  return 'Précisez votre demande en 600 caractères maximum, sans pièces ni données sensibles.';
 return null;
}
export function safeMyPrivacyRequests(value){
 if(!Array.isArray(value))return null;
 return value.filter(r=>r&&typeof r.id==='string'&&
  Object.hasOwn(PRIVACY_RIGHTS,r.request_kind)&&
  Object.hasOwn(PRIVACY_STATES,r.status)&&
  Number.isFinite(Date.parse(r.received_at))&&
  Number.isFinite(Date.parse(r.due_at))).slice(0,100);
}
const d=x=>new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeZone:'Europe/Paris'})
 .format(new Date(x));
export async function mountMemberPrivacyRights(root,api,userId,alive){
 const section=mk('section','member-privacy-rights');
 section.append(mk('h3','','Mes droits sur mes données'));
 const intro=mk('p','auth-footnote',
  'Demandes d’accès, de correction et de suppression. Les démarches sont examinées par le club : envoyer la demande ne supprime pas automatiquement un compte ou un fichier.');
 const note=mk('p','auth-footnote',
  'N’envoyez ni document d’identité, ni information médicale dans ce formulaire. Pour une demande au nom d’un enfant, contactez directement le responsable du club afin qu’il vérifie l’autorité parentale et la demande sans collecter de pièces ici.');
 const status=mk('p','auth-footnote','Vérification des demandes…');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const form=mk('form','member-privacy-form');
 const rights=mk('select','admin-form-control');rights.setAttribute('aria-label','Droit à exercer');
 for(const [key,label] of Object.entries(PRIVACY_RIGHTS)){
  const opt=mk('option','',label);opt.value=key;rights.append(opt);
 }
 const request=mk('textarea','admin-form-control');
 request.rows=3;request.maxLength=600;request.setAttribute('aria-label','Précision facultative de ma demande');
 request.placeholder='Décrivez uniquement l’objet de la demande, sans détail sensible.';
 const button=mk('button','auth-text-button','Envoyer ma demande');
 button.type='submit';form.append(rights,request,button);
 const list=mk('div','member-privacy-history');
 section.append(intro,note,form,status,list);root.append(section);
 const active=()=>root.isConnected&&section.isConnected&&
  typeof alive==='function'&&alive();
 let busy=false,seq=0;
 const verified=async()=>{
  if(!active())return false;
  const r=await api.auth.getUser();
  return active()&&!r.error&&r.data?.user?.id===userId&&
   Boolean(r.data.user.email_confirmed_at);
 };
 async function reload(){
  const current=++seq;list.replaceChildren();
  if(!await verified()){
   if(active())status.textContent='Connexion vérifiée nécessaire.';
   return;
  }
  try{
   const r=await api.rpc('member_my_privacy_requests');
   if(!active()||current!==seq)return;
   const records=r.error?null:safeMyPrivacyRequests(r.data);
   if(!records)throw Error('Requests unavailable');
   status.textContent=records.length?'Historique de vos demandes vérifié par le serveur.':
    'Aucune demande enregistrée pour le moment.';
   for(const item of records){
    const card=mk('article','member-privacy-item');
    card.append(mk('strong','',PRIVACY_RIGHTS[item.request_kind]),
     mk('p','auth-footnote',PRIVACY_STATES[item.status]+' · Reçue le '+d(item.received_at)+
      ' · Échéance de suivi : '+d(item.due_at)));
    if(item.resolution_note&&['completed','rejected'].includes(item.status))
     card.append(mk('p','auth-footnote','Réponse du club : '+item.resolution_note));
    if(item.extended_at)
     card.append(mk('p','auth-footnote','Délai supplémentaire déclaré par le club.'));
    list.append(card);
   }
  }catch{
   if(active()&&current===seq){
    list.replaceChildren();status.textContent='Historique indisponible. Aucune demande présumée reçue.';
   }
  }
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!active())return;
  const invalid=privacyRequestInputError(rights.value,request.value);
  if(invalid){status.textContent=invalid;return;}
  busy=true;button.disabled=true;status.textContent='Transmission sécurisée de votre demande…';
  try{
   if(!await verified())throw Error('Identity expired');
   const r=await api.rpc('member_submit_privacy_request',{
    p_kind:rights.value,p_description:request.value.trim()
   });
   if(r.error||typeof r.data!=='string')throw Error('Denied');
   if(active()){request.value='';await reload();}
  }catch{
   if(active())status.textContent=
    'Enregistrement non confirmé. Vérifiez l’historique avant de réessayer ou contactez le club.';
  }finally{
   busy=false;if(active())button.disabled=false;
  }
 });
 await reload();
}
