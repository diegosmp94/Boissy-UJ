/** Step 92: MFA AAL2 privacy operations are handoffs, not deletion shortcuts. */
import {adminSessionStatus} from './admin-security.mjs';
import {PRIVACY_RIGHTS,PRIVACY_STATES} from './member-privacy-rights.mjs';
const mk=(tag,cls='',text=null)=>{const n=document.createElement(tag);
 if(cls)n.className=cls;if(text!==null)n.textContent=String(text);return n;};
const field=(title,input)=>{const n=mk('label','admin-form-field',title);
 n.append(input);return n;};
const select=(options=[])=>{const n=mk('select','admin-form-control');
 for(const [value,label] of options){const option=mk('option','',label);
  option.value=value;n.append(option);}return n;};
export const PRIVACY_SCOPES=Object.freeze({
 auth_account:'Compte Auth et sessions',
 member_profile:'Profil membre',
 club_roles:'Licences et rôles',
 public_person_profiles:'Fiches publiques et consentements',
 private_media:'Médias et stockage privé',
 awards_ballots:'Votes privés Awards',
 payments_and_invoices:'Paiements et pièces comptables',
 external_processors:'Prestataires et copies externes'
});
export function privacyDecisionError(status,note){
 if(!['in_review','awaiting_action','completed','rejected'].includes(status))
  return 'Statut invalide.';
 if(typeof note!=='string')return 'Motif invalide.';
 if(['completed','rejected'].includes(status)&&
  (note.trim().length<25||note.trim().length>1000))
  return 'Motif de clôture obligatoire : 25 à 1 000 caractères.';
 if(!['completed','rejected'].includes(status)&&note.trim())
  return 'Le commentaire de décision est réservé à une clôture.';
 return null;
}
export function validPrivacyEvidence(x){
 return typeof x==='string'&&/^[A-Za-z0-9._:/-]{6,120}$/.test(x);
}
export function normalizePrivacyCases(rows){
 if(!Array.isArray(rows))return null;
 return rows.filter(x=>x&&typeof x.id==='string'&&
  Object.hasOwn(PRIVACY_RIGHTS,x.request_kind)&&
  Object.hasOwn(PRIVACY_STATES,x.status)&&
  Number.isFinite(Date.parse(x.received_at))&&
  Number.isFinite(Date.parse(x.due_at))&&
  Number.isFinite(Date.parse(x.updated_at))).slice(0,200);
}
const when=x=>new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',
 timeStyle:'short',timeZone:'Europe/Paris'}).format(new Date(x));
export async function mountAdminPrivacyRights(root,api,userId){
 root.replaceChildren(mk('h2','','RGPD — demandes et vérifications'));
 const warning=mk('p','admin-workflow-status',
  'Ce module trace la prise en charge des droits. Il ne supprime ni compte Auth, ni média Storage, ni factures. Une demande d’effacement ne peut être clôturée avant contrôle des huit postes et vérification que le compte Auth est effectivement supprimé.');
 const status=mk('p','admin-workflow-status','Lecture protégée…');
 status.setAttribute('role','status');
 const chooser=select([['','Sélectionner un dossier']]);
 chooser.setAttribute('aria-label','Dossier RGPD');
 const refresh=mk('button','admin-secondary-btn','Actualiser');refresh.type='button';
 const details=mk('section','admin-privacy-details');
 const ticket=mk('p','admin-workflow-status');
 const transition=mk('form','admin-operation-form');
 const next=select([
  ['in_review','En cours d’examen'],
  ['awaiting_action','Actions en cours'],
  ['completed','Traité'],
  ['rejected','Refus motivé']
 ]);
 const reason=mk('textarea','admin-form-control');reason.rows=3;reason.maxLength=1000;
 reason.placeholder='Justification documentée, sans document d’identité ou donnée sensible.';
 const update=mk('button','admin-primary-btn','Préparer la décision');
 update.type='submit';transition.append(field('Décision',next),field('Motif de clôture',reason),update);
 const extension=mk('form','admin-privacy-extension');
 const why=mk('textarea','admin-form-control');why.rows=2;why.maxLength=600;
 why.placeholder='Pourquoi ce dossier nécessite un délai supplémentaire ?';
 const extend=mk('button','admin-secondary-btn','Préparer la prolongation');
 extend.type='submit';extension.append(field('Prolongation exceptionnelle motivée',why),extend);
 const stepsBox=mk('section','admin-privacy-steps');
 stepsBox.append(mk('h3','','Vérifications avant effacement'));
 const checklist=mk('div','admin-privacy-checklist');
 stepsBox.append(checklist);
 const inventory=mk('section','admin-privacy-inventory');
 inventory.append(mk('h3','','Conservation et consentements'));
 const oversight=mk('p','admin-workflow-status','Vérification du registre…');
 const retention=mk('div','admin-privacy-retention');
 inventory.append(oversight,retention);
 details.append(ticket,transition,extension,stepsBox);
 root.append(warning,status,field('Dossier reçu',chooser),refresh,details,inventory);
 let cases=[],steps=[],busy=false,seq=0,stepSeq=0,confirmation=null;
 const selected=()=>cases.find(x=>x.id===chooser.value)||null;
 const can=async()=>{
  const v=await adminSessionStatus(api,userId);
  return root.isConnected&&v.status==='admin'&&v.level==='aal2'&&
   v.userId===userId&&v.roles?.includes('admin');
 };
 const protect=()=>{const c=selected(),open=c&&
  !['completed','rejected'].includes(c.status);
  details.hidden=!c;
  transition.hidden=!open;extension.hidden=!open||!!c?.extended_at;
  stepsBox.hidden=!c||c.request_kind!=='erasure';
  update.disabled=busy||!open;extend.disabled=busy||!open;
 };
 function display(){
  const c=selected();confirmation=null;steps=[];checklist.replaceChildren();
  if(!c){ticket.textContent='Sélectionnez un dossier.';protect();return;}
  const overdue=Date.now()>Date.parse(c.due_at)&&
    !['completed','rejected'].includes(c.status);
  ticket.textContent=PRIVACY_RIGHTS[c.request_kind]+' · '+PRIVACY_STATES[c.status]+
   ' · Reçue le '+when(c.received_at)+' · Échéance '+when(c.due_at)+
   (overdue?' · ÉCHÉANCE DÉPASSÉE':'')+
   (c.description?' · Demande : '+c.description:'');
  next.value=['completed','rejected'].includes(c.status)?'in_review':c.status;
  reason.value='';why.value='';protect();
  if(c.request_kind==='erasure')void loadSteps(c);
 }
 async function loadSteps(c){
  const stamp=++stepSeq;
  checklist.replaceChildren(mk('p','admin-workflow-status',
   'Vérification des postes dans le journal privé…'));
  try{
   if(!await can())throw Error('Access');
   const response=await api.rpc('admin_list_privacy_request_steps',{
    p_request_id:c.id});
   if(stamp!==stepSeq||!root.isConnected||selected()?.id!==c.id)return;
   if(response.error||!Array.isArray(response.data))throw Error('Unavailable');
   steps=response.data;checklist.replaceChildren();
   for(const item of steps){
    if(!Object.hasOwn(PRIVACY_SCOPES,item.scope))continue;
    const row=mk('article','admin-privacy-step');
    row.append(mk('strong','',PRIVACY_SCOPES[item.scope]),
     mk('p','admin-workflow-status',item.state==='pending'?
      'À vérifier' :item.state==='verified'?'Vérification enregistrée':'Hors périmètre justifié'));
    if(item.state==='pending'){
     const state=select([['verified','Vérifié avec preuve interne'],
      ['not_applicable','Non applicable — justificatif interne']]);
     if(item.scope==='auth_account')
      state.querySelector('option[value="not_applicable"]')?.remove();
     const evidence=mk('input','admin-form-control');
     evidence.placeholder='Référence interne sans donnée personnelle';
     evidence.maxLength=120; evidence.autocomplete='off';
     const button=mk('button','admin-secondary-btn','Vérifier ce poste');
     button.type='button';
     let confirm=null;
     button.addEventListener('click',async()=>{
      if(busy||!row.isConnected)return;
      if(!validPrivacyEvidence(evidence.value)){
       status.textContent='Saisir une référence interne (6–120 caractères, sans informations personnelles).';
       return;
      }
      const args={p_request_id:c.id,p_scope:item.scope,
       p_state:state.value,p_evidence_ref:evidence.value};
      const key=JSON.stringify(args);
      if(confirm!==key){
       confirm=key;status.textContent='Vérifier la preuve hors ligne puis confirmer ce poste.';
       button.textContent='Confirmer la vérification';return;
      }
      busy=true;protect();button.disabled=true;
      try{
       if(!await can())throw Error('MFA');
       const result=await api.rpc('admin_update_privacy_step',args);
       if(result.error||result.data!==true)throw Error('Denied');
       if(root.isConnected){status.textContent='Poste vérifié et journalisé par le serveur.';
        await loadSteps(c);}
      }catch{
       if(root.isConnected)status.textContent='Vérification refusée. Données et preuves à contrôler.';
      }finally{busy=false;if(row.isConnected)button.disabled=false;protect();}
     });
     row.append(field('Décision du poste',state),
      field('Référence de vérification interne',evidence),button);
    }else if(item.evidence_ref)
     row.append(mk('small','', 'Référence interne : '+item.evidence_ref));
    checklist.append(row);
   }
  }catch{
   if(root.isConnected&&stamp===stepSeq){
    checklist.replaceChildren(mk('p','admin-workflow-status',
     'Impossible de vérifier la checklist ; effacement non confirmable.'));
   }
  }
 }
 async function readCases(focus=null){
  const current=++seq;refresh.disabled=true;
  if(!await can()){
   if(root.isConnected){status.textContent='Accès MFA AAL2 requis.';details.hidden=true;}
   return;
  }
  try{
   const r=await api.rpc('admin_list_privacy_requests');
   if(current!==seq||!root.isConnected)return;
   const validated=r.error?null:normalizePrivacyCases(r.data);
   if(!validated)throw Error('Unavailable');
   cases=validated;chooser.replaceChildren();
   chooser.append(new Option('Sélectionner un dossier',''));
   for(const item of cases){
    const title=PRIVACY_RIGHTS[item.request_kind]+' · '+PRIVACY_STATES[item.status]+
     ' · '+when(item.received_at);
    chooser.append(new Option(title,item.id));
   }
   chooser.value=cases.some(x=>x.id===focus)?focus:'';
   display();refresh.disabled=false;
   const overdue=cases.filter(c=>!['completed','rejected'].includes(c.status)&&
    Date.now()>Date.parse(c.due_at)).length;
   status.textContent=cases.length+' dossier(s) RGPD vérifiés · '+overdue+
    ' échéance(s) dépassée(s), sans données personnelles affichées dans la navigation.';
  }catch{if(root.isConnected){
    details.hidden=true;status.textContent='Dossiers indisponibles. Aucune décision possible.';
  }}
 }
 async function readRegister(){
  retention.replaceChildren();oversight.textContent='Lecture des durées approuvées…';
  if(!await can())return;
  try{
   const r=await api.rpc('admin_privacy_retention_and_consent');
   if(r.error||!r.data||!Array.isArray(r.data.retention))throw Error('Unavailable');
   if(!root.isConnected)return;
   oversight.textContent='Fiches sportives à revoir : '+r.data.roster_consent_review_pending+
    ' · Profils individuels à revoir : '+r.data.individual_profile_review_pending+
    ' · Purges Storage en attente : '+r.data.media_purges_pending+
    '. Les mineurs nécessitent une vérification d’autorité parentale hors formulaire.';
   for(const entry of r.data.retention){
    const card=mk('article','admin-privacy-retention-card');
    card.append(mk('strong','',entry.dataset),
     mk('p','admin-workflow-status',entry.approved?
      'Règle approuvée et enregistrée par le club':'Durée et base légale à renseigner par le club.'));
    const form=mk('form','admin-operation-form');
    const rule=mk('textarea','admin-form-control');rule.maxLength=1200;
    rule.rows=2;rule.value=entry.rule||'';
    const basis=mk('textarea','admin-form-control');basis.rows=2;basis.maxLength=500;
    basis.value=entry.basis||'';
    const save=mk('button','admin-secondary-btn','Préparer la validation');
    save.type='submit';
    form.append(field('Règle de conservation validée',rule),
     field('Base légale validée',basis),save);
    let confirm=null;
    form.addEventListener('submit',async e=>{
     e.preventDefault();if(busy||!card.isConnected)return;
     const data={p_dataset:entry.dataset,p_rule:rule.value.trim(),
      p_basis:basis.value.trim(),p_expected_approved_at:entry.approved_at||null};
     if(data.p_rule.length<25||data.p_basis.length<10){
      status.textContent='Règle et base légale doivent être rédigées et vérifiées par le club.';return;
     }
     const key=JSON.stringify(data);
     if(confirm!==key){confirm=key;save.textContent='Confirmer les règles validées';
      status.textContent='Vérifiez la base légale et la durée puis confirmez.';return;}
     busy=true;save.disabled=true;
     try{
      if(!await can())throw Error('MFA');
      const res=await api.rpc('admin_approve_privacy_retention_rule',data);
      if(res.error||res.data!==true)throw Error('Denied');
      status.textContent='Règle de conservation approuvée et auditée.';
      await readRegister();
     }catch{status.textContent='Validation refusée, actualisez la version du registre.';}
     finally{busy=false;if(card.isConnected)save.disabled=false;}
    });
    card.append(form);retention.append(card);
   }
  }catch{if(root.isConnected)oversight.textContent='Registre de conservation inaccessible. Aucune durée présumée approuvée.';}
 }
 chooser.addEventListener('change',display);
 refresh.addEventListener('click',()=>{if(!busy){
  void readCases(selected()?.id);void readRegister();
 }});
 for(const input of [next,reason,why])
  input.addEventListener('input',()=>{confirmation=null;});
 transition.addEventListener('submit',async event=>{
  event.preventDefault();const c=selected();if(!c||busy||update.disabled)return;
  const value=next.value,note=reason.value.trim();
  const err=privacyDecisionError(value,note);
  if(err){status.textContent=err;return;}
  const args={p_request_id:c.id,p_status:value,p_resolution_note:note,
   p_expected_updated_at:c.updated_at};
  const key=JSON.stringify(args);
  if(confirmation!==key){
   confirmation=key;status.textContent='Une décision ne réalise pas elle-même l’effacement. Confirmez les preuves et cliquez à nouveau.';
   update.textContent='Confirmer la décision';return;
  }
  busy=true;protect();
  try{
   if(!await can())throw Error('MFA');
   const r=await api.rpc('admin_transition_privacy_request',args);
   if(r.error||r.data!==true)throw Error('Denied');
   await readCases(c.id);
  }catch{if(root.isConnected)status.textContent='Décision refusée : dossier modifié, checklist incomplète ou compte encore actif.';}
  finally{busy=false;confirmation=null;update.textContent='Préparer la décision';protect();}
 });
 extension.addEventListener('submit',async event=>{
  event.preventDefault();const c=selected();if(!c||busy||extend.disabled)return;
  const justification=why.value.trim();
  if(justification.length<25||justification.length>600){
   status.textContent='Justification de prolongation requise (25–600 caractères).';return;
  }
  const data={p_request_id:c.id,p_reason:justification,
   p_expected_updated_at:c.updated_at};
  const key=JSON.stringify(data);
  if(confirmation!==key){confirmation=key;
   status.textContent='Confirmer uniquement si la prolongation exceptionnelle est justifiée et notifiée au demandeur.';
   extend.textContent='Confirmer la prolongation';return;}
  busy=true;protect();
  try{
   if(!await can())throw Error('MFA');
   const r=await api.rpc('admin_extend_privacy_request',data);
   if(r.error||r.data!==true)throw Error('Denied');
   await readCases(c.id);
  }catch{if(root.isConnected)status.textContent='Prolongation refusée. Vérifier la date, les droits et la version.';}
  finally{busy=false;confirmation=null;extend.textContent='Préparer la prolongation';protect();}
 });
 await Promise.all([readCases(),readRegister()]);
}
