/** Step 94: real read-only health counters plus manually classified incidents.
 * No raw server error string, IP address, actor identity, or payload in UI.
 */
import {adminSessionStatus} from './admin-security.mjs';
import {OPS_CHECKS,OPS_SERVICES,OPS_COMPONENTS,OPS_CATEGORIES,
 OPS_SEVERITIES,OPS_RESOLUTIONS,safeOpsSnapshot,
 safeOpsReportInput,safeOpsResolutionInput} from './ops-diagnostics.mjs';
const el=(tag,cls='',val=null)=>{
 const x=document.createElement(tag);if(cls)x.className=cls;
 if(val!==null)x.textContent=String(val);return x;
};
const chooser=(obj,title)=>{
 const label=el('label','admin-form-field',title);
 const input=el('select','admin-form-control');
 for(const [code,name] of Object.entries(obj)){
  const opt=el('option','',name);opt.value=code;input.append(opt);
 }
 label.append(input);return {label,input};
};
const date=x=>new Intl.DateTimeFormat('fr-FR',{
 dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Paris'
}).format(new Date(x));
export async function mountAdminOperations(root,api,userId){
 root.replaceChildren(el('h2','','Suivi d’exploitation et incidents'));
 const guide=el('p','admin-workflow-status',
  'Diagnostic privé des traitements : valeurs agrégées seulement. Le statut de la base et des droits MFA est vérifié lors de chaque lecture ; les autres services ne sont PAS testés automatiquement.');
 const message=el('p','admin-workflow-status','Chargement des contrôles serveur…');
 message.setAttribute('role','status');message.setAttribute('aria-live','polite');
 const refresh=el('button','admin-secondary-btn','Rafraîchir le diagnostic');
 refresh.type='button';
 const checked=el('p','admin-workflow-status','Aucun état confirmé.');
 const services=el('section','admin-ops-services');
 services.append(el('h3','','État des services'));
 const serviceRows=el('div','admin-ops-service-grid');services.append(serviceRows);
 const alerts=el('section','admin-ops-alerts');
 alerts.append(el('h3','','Traitements différés et incohérences'));
 const alertRows=el('div','admin-ops-alert-grid');alerts.append(alertRows);
 const incidents=el('section','admin-ops-incidents');
 incidents.append(el('h3','','Signalements catégorisés (sans journaux bruts)'));
 const totals=el('p','admin-workflow-status');
 const incidentRows=el('div','admin-ops-incidents-list');
 const form=el('form','admin-ops-incident-form');
 const c=chooser(OPS_COMPONENTS,'Composant');
 const kind=chooser(OPS_CATEGORIES,'Type de problème');
 const severity=chooser(OPS_SEVERITIES,'Priorité');
 const send=el('button','admin-primary-btn','Signaler un incident');
 send.type='submit';
 form.append(c.label,kind.label,severity.label,send);
 incidents.append(totals,incidentRows,form);
 root.append(guide,message,refresh,checked,services,alerts,incidents);
 let busy=false,readId=0,confirmKey=null,destroyed=false;
 const active=()=>!destroyed&&root.isConnected;
 const authorized=async()=>{
  if(!active())return false;
  const s=await adminSessionStatus(api,userId);
  return active()&&s.status==='admin'&&s.level==='aal2'&&
   s.userId===userId&&s.roles?.includes('admin');
 };
 function disable(){
  refresh.disabled=true;send.disabled=true;
  serviceRows.replaceChildren();alertRows.replaceChildren();
  incidentRows.replaceChildren();checked.textContent='Diagnostic non confirmé.';
 }
 async function update(){
  const stamp=++readId;
  refresh.disabled=true;message.dataset.opsState='unknown';
  message.textContent='Vérification d’identité et lecture des indicateurs…';
  // Never leave previously healthy state visible during an outage.
  serviceRows.replaceChildren();alertRows.replaceChildren();incidentRows.replaceChildren();
  checked.textContent='Données en cours de vérification.';
  if(!await authorized()){
   if(active()&&stamp===readId){disable();message.textContent=
    'Accès suspendu : rôle administrateur ou MFA AAL2 requis.';}
   return;
  }
  try{
   const response=await api.rpc('admin_ops_snapshot');
   if(!active()||stamp!==readId)return;
   const state=response.error?null:safeOpsSnapshot(response.data);
   if(!state)throw Error('Snapshot unavailable');
   checked.textContent='Dernier diagnostic du serveur : '+date(state.checkedAt)+
    '. Aucun fournisseur externe testé par cette opération.';
   for(const [key,label] of Object.entries(OPS_SERVICES)){
    const item=el('article','admin-ops-item');
    item.append(el('strong','',label),
     el('span','',state.services[key]==='verified_now'?
      'Vérifié maintenant':'Non vérifié'));
    item.dataset.opsState=state.services[key]==='verified_now'?'ok':'unknown';
    serviceRows.append(item);
   }
   for(const check of state.checks){
    const item=el('article','admin-ops-item');
    item.dataset.opsState=check.state==='ok'?'ok':check.state==='attention'?'warning':'unknown';
    item.append(el('strong','',check.label),
     el('span','',check.count+' signalement(s) agrégé(s)'),
     el('small','',check.state==='review'?
      'Validation du club nécessaire':check.count?'À examiner':'Aucun écart détecté dans la requête'));
    alertRows.append(item);
   }
   totals.textContent=state.openIncidents+' incident(s) ouvert(s), dont '+
    state.highIncidents+' prioritaires. Les événements ci-dessous sont classés manuellement, sans données de personnes.';
   for(const event of state.incidents){
    const item=el('article','admin-ops-incident');
    const isOpen=event.resolvedAt===null;
    item.append(el('strong','',OPS_COMPONENTS[event.component]),
     el('p','admin-workflow-status',
      OPS_CATEGORIES[event.category]+' · '+OPS_SEVERITIES[event.severity]+
      ' · '+(isOpen?'Ouvert':'Résolu')+' · '+date(event.openedAt)));
    if(!isOpen){
     item.append(el('small','',
      'Résolution : '+OPS_RESOLUTIONS[event.resolution]+' · '+date(event.resolvedAt)));
    }else{
     const resolveOptions=chooser(OPS_RESOLUTIONS,'Décision de clôture');
     const done=el('button','admin-secondary-btn','Clôturer le signalement');
     done.type='button';
     let confirm=null;
     resolveOptions.input.addEventListener('change',()=>{confirm=null;});
     done.addEventListener('click',async()=>{
      if(busy||!active())return;
      const args={p_id:event.id,p_resolution:resolveOptions.input.value,
       p_expected_opened_at:event.openedAt};
      if(!safeOpsResolutionInput(event.id,args.p_resolution,event.openedAt)){
       message.textContent='Données de résolution invalides.';return;
      }
      const key=JSON.stringify(args);
      if(confirm!==key){
       confirm=key;done.textContent='Confirmer la résolution';
       message.textContent='Vérifiez la résolution réellement effectuée, puis confirmez.';
       return;
      }
      busy=true;done.disabled=true;
      try{
       if(!await authorized())throw Error('Unauthorized');
       const res=await api.rpc('admin_ops_resolve_incident',args);
       if(res.error||res.data!==true)throw Error('Resolution denied');
       if(active())await update();
      }catch{
       if(active())message.textContent='Résolution non confirmée. Vérifiez l’état du serveur.';
      }finally{
       busy=false;if(active())done.disabled=false;
      }
     });
     item.append(resolveOptions.label,done);
    }
    incidentRows.append(item);
   }
   if(!state.incidents.length)
    incidentRows.append(el('p','admin-workflow-status','Aucun signalement manuel enregistré.'));
   message.textContent='Diagnostic vérifié ; attention aux services marqués « Non vérifié ».';
   message.dataset.opsState='ok';
   refresh.disabled=false;send.disabled=false;
  }catch{
   if(active()&&stamp===readId){
    disable();message.textContent=
     'Diagnostic indisponible : aucun service considéré comme sain tant que la lecture n’a pas réussi.';
   }
  }
 }
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(busy||send.disabled||!active())return;
  const component=c.input.value,category=kind.input.value,priority=severity.input.value;
  if(!safeOpsReportInput(component,category,priority)){
   message.textContent='Catégorie de signalement invalide.';return;
  }
  const args={p_component:component,p_category:category,p_severity:priority};
  const key=JSON.stringify(args);
  if(confirmKey!==key){
   confirmKey=key;
   send.textContent='Confirmer le signalement';
   message.textContent='Ne signalez que les événements constatés, sans données personnelles. Confirmez pour enregistrer.';
   return;
  }
  busy=true;send.disabled=true;
  try{
   if(!await authorized())throw Error('Identity expired');
   const res=await api.rpc('admin_ops_report_incident',args);
   if(res.error||typeof res.data!=='string')throw Error('Not registered');
   if(active())await update();
  }catch{
   if(active())message.textContent=
    'Signalement non confirmé ; consultez la liste avant de réessayer.';
  }finally{
   busy=false;confirmKey=null;
   send.textContent='Signaler un incident';
   if(active())send.disabled=false;
  }
 });
 refresh.addEventListener('click',()=>{if(!busy)void update();});
 const obs=typeof MutationObserver==='function'?new MutationObserver(()=>{
  if(!root.isConnected){destroyed=true;readId++;obs.disconnect();}
 }):null;
 if(obs&&document.body)obs.observe(document.body,{subtree:true,childList:true});
 await update();
}
