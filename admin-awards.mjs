/** Awards Control Center. All writes via protected AAL2 RPC, zero mock content. */
import {adminSessionStatus} from './admin-security.mjs';
const el=(tag,cls='',text=null)=>{const n=document.createElement(tag);
 if(cls)n.className=cls;if(text!==null)n.textContent=String(text);return n;};
const field=(txt,node)=>{const l=el('label','admin-form-field',txt);l.append(node);return l;};
const input=(type='text')=>{const x=el('input','admin-form-control');x.type=type;return x;};
const select=options=>{const x=el('select','admin-form-control');
 for(const [value,label] of options){const o=el('option','',label);o.value=value;x.append(o);}return x;};
export const AWARDS_STATUS_LABELS=Object.freeze({
 coming:'Brouillon / à venir',open:'Vote ouvert',closed:'Vote clôturé',finished:'Résultats publiés'
});
export function awardsDraftError(d){
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.slug||'')||
  d.slug.length>100)return 'Identifiant : lettres minuscules, chiffres et tirets.';
 if(typeof d.title!=='string'||d.title.trim().length<4||d.title.trim().length>120)
  return 'Titre requis, de 4 à 120 caractères.';
 if(typeof d.description!=='string'||d.description.length>1600)
  return 'Description limitée à 1 600 caractères.';
 if(!['a','b','c'].includes(d.team_code))return 'Équipe incorrecte.';
 if(d.season_label&&!/^\d{4}\/\d{4}$/.test(d.season_label))
  return 'Saison au format AAAA/AAAA.';
 if(Boolean(d.opens_at)!==Boolean(d.closes_at)||
   d.opens_at&&(Number.isNaN(Date.parse(d.opens_at))||
   Number.isNaN(Date.parse(d.closes_at))||
   Date.parse(d.opens_at)>=Date.parse(d.closes_at)))
  return 'Période de vote incorrecte.';
 if(typeof d.published!=='boolean')return 'Publication invalide.';
 return null;
}
export function awardSaveArgs(d,old=null){
 const error=awardsDraftError(d);if(error)throw Error(error);
 return {p_id:old?.id||null,p_slug:d.slug,p_title:d.title.trim(),
  p_description:d.description,p_team_code:d.team_code,
  p_season_label:d.season_label||null,
  p_opens_at:d.opens_at?new Date(d.opens_at).toISOString():null,
  p_closes_at:d.closes_at?new Date(d.closes_at).toISOString():null,
  p_published:d.published,p_expected_updated_at:old?.updated_at||null};
}
export function nomineeDraftError(d){
 if(typeof d.label!=='string'||d.label.trim().length<2||
  d.label.trim().length>100)return 'Nomination : 2 à 100 caractères.';
 if(typeof d.consent!=='boolean'||typeof d.published!=='boolean'||
  d.published&&!d.consent)return 'Vérification du consentement obligatoire pour publier.';
 if(!Number.isSafeInteger(d.order)||d.order<0||d.order>10000)
  return 'Ordre incorrect.';return null;
}
const toLocal=value=>{
 if(!value||!Number.isFinite(Date.parse(value)))return '';
 const d=new Date(value);
 return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);
};
export async function mountAdminAwards(root,api,userId){
 root.replaceChildren(el('h2','','Awards — catégories, nominations et résultats'));
 const notice=el('p','admin-workflow-status',
  'Aucun vote ou gagnant prérempli. Les bulletins privés ne sont jamais visibles ici. Les résultats ne sont publiés que si un leader unique est établi.');
 const status=el('p','admin-workflow-status','Chargement sécurisé…');status.setAttribute('role','status');
 const choices=select([['new','+ Nouvelle catégorie']]);
 const reload=el('button','admin-secondary-btn','Actualiser les catégories');reload.type='button';
 const form=el('form','admin-operation-form');
 const slug=input(),title=input(),description=el('textarea','admin-form-control');
 slug.maxLength=100;title.maxLength=120;description.maxLength=1600;description.rows=4;
 const team=select([['a','Seniors A'],['b','Seniors B'],['c','Seniors C']]);
 const season=input(),opens=input('datetime-local'),closes=input('datetime-local');
 season.maxLength=9;season.placeholder='2026/2027';
 const published=input('checkbox');
 for(const [label,node] of [
  ['Identifiant court, unique',slug],['Titre',title],['Description',description],
  ['Équipe',team],['Saison (facultatif)',season],
  ['Ouverture du vote',opens],['Fermeture du vote',closes],
  ['Publier la catégorie',published]
 ])form.append(field(label,node));
 const save=el('button','admin-primary-btn','Enregistrer la catégorie');save.type='submit';
 form.append(save);
 const nomineesSection=el('section','admin-awards-nominees');
 nomineesSection.append(el('h3','','Candidatures officielles'));
 const nomineeStatus=el('p','admin-workflow-status',
  'Enregistrez d’abord une catégorie, puis ajoutez les candidatures validées.');
 const nomineePick=select([['new','+ Nouveau candidat']]);
 const nomineeForm=el('form','admin-operation-form');
 const nomineeLabel=input(),consent=input('checkbox'),nomineePublish=input('checkbox'),
  order=input('number');
 nomineeLabel.maxLength=100;order.min=0;order.max=10000;order.value='0';
 for(const [label,node] of [
  ['Nom publié (vérifié par le club)',nomineeLabel],
  ['Consentement à la publication contrôlé',consent],
  ['Publier ce nominé',nomineePublish],['Ordre d’affichage',order]
 ])nomineeForm.append(field(label,node));
 const nomineeSave=el('button','admin-primary-btn','Enregistrer le nominé');
 nomineeSave.type='submit';nomineeForm.append(nomineeSave);
 nomineesSection.append(nomineeStatus,field('Nominé',nomineePick),nomineeForm);
 const actionSection=el('section','admin-awards-actions');
 actionSection.append(el('h3','','Cycle de vote'));
 const actionNote=el('p','admin-workflow-status','Sélectionnez une catégorie officielle.');
 const open=el('button','admin-secondary-btn','Ouvrir le vote');
 const close=el('button','admin-secondary-btn','Clôturer le vote');
 const publishResult=el('button','admin-primary-btn','Publier le résultat vérifié');
 for(const b of [open,close,publishResult]){b.type='button';actionSection.append(b);}
 actionSection.append(actionNote);
 root.append(notice,status,field('Catégorie Awards',choices),reload,
  form,nomineesSection,actionSection);
 let rows=[],nominees=[],busy=false,run=0,nomineeRun=0,confirmation=null;
 const selected=()=>rows.find(r=>r.id===choices.value)||null;
 const selectedNominee=()=>nominees.find(r=>r.id===nomineePick.value)||null;
 const permitted=async()=>{
  const v=await adminSessionStatus(api,userId);
  return root.isConnected&&v.status==='admin'&&v.level==='aal2'&&
   v.userId===userId&&v.roles?.includes('admin');
 };
 const lock=()=>{
  const a=selected(),editable=!busy&&(!a||a.voting_status==='coming');
  for(const n of form.querySelectorAll('input,select,textarea'))n.disabled=!editable;
  save.disabled=!editable;nomineeForm.hidden=!a;
  nomineeSave.disabled=!editable||!a;nomineePick.disabled=!editable||!a;
  open.disabled=busy||!a||a.voting_status!=='coming'||!a.published;
  close.disabled=busy||!a||a.voting_status!=='open';
  publishResult.disabled=busy||!a||a.voting_status!=='closed';
 };
 function paint(){
  const a=selected();
  slug.value=a?.slug||'';title.value=a?.title||'';
  description.value=a?.description||'';team.value=a?.team_code||'a';
  season.value=a?.season_label||'';
  opens.value=toLocal(a?.opens_at);closes.value=toLocal(a?.closes_at);
  published.checked=a?.published===true;
  confirmation=null;
  actionNote.textContent=a?
   'État : '+(AWARDS_STATUS_LABELS[a.voting_status]||'Non connu')+
   '. Ouverture conditionnée par la validation serveur des droits et des candidatures.':
   'Aucune catégorie encore sélectionnée.';
  void readNominees(a);
  lock();
 }
 function paintNominee(){
  const n=selectedNominee();nomineeLabel.value=n?.display_label||'';
  consent.checked=n?.consent_reviewed===true;
  nomineePublish.checked=n?.published===true;order.value=String(n?.sort_order??0);
  confirmation=null;
 }
 async function readNominees(a){
  const seq=++nomineeRun;nominees=[];
  nomineePick.replaceChildren(new Option('+ Nouveau candidat','new'));
  paintNominee();
  if(!a){nomineeStatus.textContent='Créer une catégorie avant les nominations.';return;}
  nomineeStatus.textContent='Chargement des nominés…';
  try{
   if(!await permitted())throw Error('Access expired');
   const r=await api.rpc('admin_list_award_nominees',{p_award_id:a.id});
   if(seq!==nomineeRun||!root.isConnected||selected()?.id!==a.id)return;
   if(r.error||!Array.isArray(r.data))throw Error('Unavailable');
   nominees=r.data;
   for(const n of nominees)nomineePick.append(new Option(n.display_label+
    (n.published?' · publié':' · brouillon'),n.id));
   nomineeStatus.textContent=nominees.length+' nomination(s) enregistrée(s) ; '+
    nominees.filter(n=>n.published&&n.consent_reviewed).length+' validée(s).';
   paintNominee();
  }catch{
   if(seq!==nomineeRun||!root.isConnected)return;
   nomineeStatus.textContent='Liste des nominés indisponible.';
   nomineeSave.disabled=true;
  }
 }
 async function readAwards(focus=null){
  const seq=++run;save.disabled=true;reload.disabled=true;
  if(!await permitted()){status.textContent='Administrateur MFA AAL2 requis.';return;}
  try{
   const result=await api.rpc('admin_list_awards');
   if(seq!==run||!root.isConnected)return;
   if(result.error||!Array.isArray(result.data))throw Error('Unavailable');
   rows=result.data;
   choices.replaceChildren(new Option('+ Nouvelle catégorie','new'));
   for(const a of rows)choices.append(new Option(a.title+' · '+
    (AWARDS_STATUS_LABELS[a.voting_status]||a.voting_status),a.id));
   choices.value=rows.some(a=>a.id===focus)?focus:'new';paint();
   reload.disabled=false;
   status.textContent=rows.length+' catégorie(s) officielles. Aucun bulletin consultable par l’administration.';
  }catch{
   if(root.isConnected)status.textContent='Lecture refusée, aucune modification réalisée.';
  }
 }
 choices.addEventListener('change',paint);
 nomineePick.addEventListener('change',paintNominee);
 reload.addEventListener('click',()=>{if(!busy)void readAwards(selected()?.id);});
 for(const n of form.querySelectorAll('input,select,textarea'))
  n.addEventListener('input',()=>{confirmation=null;});
 for(const n of nomineeForm.querySelectorAll('input,select'))
  n.addEventListener('input',()=>{confirmation=null;});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||save.disabled)return;
  let args;const a=selected();
  try{args=awardSaveArgs({slug:slug.value,title:title.value,
   description:description.value,team_code:team.value,season_label:season.value,
   opens_at:opens.value,closes_at:closes.value,published:published.checked},a);}
  catch(e){status.textContent=e.message;return;}
  const key=JSON.stringify(args);
  if((args.p_published||a?.published)&&confirmation!==key){
   confirmation=key;status.textContent='Publication sensible : vérifier et cliquer à nouveau pour confirmer.';return;
  }
  busy=true;lock();
  try{
   if(!await permitted())throw Error('Unauthorized');
   const r=await api.rpc('admin_save_award',args);
   if(r.error||!r.data)throw Error('Conflict');
   if(root.isConnected)await readAwards(r.data);
  }catch{if(root.isConnected)status.textContent='Enregistrement refusé : conflit, droits ou données invalides.';}
  finally{busy=false;if(root.isConnected)lock();}
 });
 nomineeForm.addEventListener('submit',async event=>{
  event.preventDefault();const a=selected();
  if(busy||!a||nomineeSave.disabled)return;
  const d={label:nomineeLabel.value,consent:consent.checked,
   published:nomineePublish.checked,order:Number(order.value)};
  const error=nomineeDraftError(d);
  if(error){nomineeStatus.textContent=error;return;}
  const args={p_id:selectedNominee()?.id||null,p_award_id:a.id,
   p_display_label:d.label.trim(),p_consent_reviewed:d.consent,
   p_published:d.published,p_sort_order:d.order,
   p_expected_updated_at:selectedNominee()?.updated_at||null};
  const key=JSON.stringify(args);
  if(d.published&&confirmation!==key){
   confirmation=key;
   nomineeStatus.textContent='Consentement et publication : vérifier puis confirmer à nouveau.';
   return;
  }
  busy=true;lock();
  try{
   if(!await permitted())throw Error('Unauthorized');
   const r=await api.rpc('admin_save_award_nominee',args);
   if(r.error||!r.data)throw Error('Nominee unavailable');
   if(root.isConnected)await readNominees(a);
  }catch{
   if(root.isConnected)nomineeStatus.textContent='Nomination non enregistrée.';
  }finally{busy=false;if(root.isConnected)lock();}
 });
 for(const [button,action] of [
  [open,'open'],[close,'close'],[publishResult,'publish_results']
 ]){
  button.addEventListener('click',async()=>{
   const a=selected();if(busy||!a||button.disabled)return;
   const key=a.id+':'+action;
   if(confirmation!==key){
    confirmation=key;
    actionNote.textContent='Action irréversible ou sensible : '+
     action+' — vérifier les dates et cliquer une seconde fois.';
    return;
   }
   busy=true;lock();
   try{
    if(!await permitted())throw Error('Unauthorized');
    const r=await api.rpc('admin_transition_award',{
     p_award_id:a.id,p_action:action});
    if(r.error||r.data!==action)throw Error('Denied');
    if(root.isConnected)await readAwards(a.id);
   }catch{
    if(root.isConnected)actionNote.textContent=
     'Transition refusée par Supabase : votes verrouillés, dates, quorum, égalité ou MFA.';
   }finally{busy=false;if(root.isConnected)lock();}
  });
 }
 await readAwards();
}
