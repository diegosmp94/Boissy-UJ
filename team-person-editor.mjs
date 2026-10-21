/**
 * Annuaire public des équipes, distinct des affiliations privées :
 * aucun nom importé, brouillons privés, publication après contrôle MFA admin.
 */
import {supabaseConfig} from './auth-config.mjs';
import {CLUB_TEAMS} from './club-teams.mjs';
import {mountAdminRosterDirectory} from './team-roster-admin.mjs';

const make=(tag,cls='',value=null)=>{
 const n=document.createElement(tag);if(cls)n.className=cls;
 if(value!==null)n.textContent=String(value);return n;
};
const btn=(label)=>{const b=make('button','staff-action',label);b.type='button';return b;};
export function validateTeamPersonDraft(raw){
 const code=String(raw.teamCode||'');
 const kind=String(raw.personKind||'');
 const displayName=String(raw.displayName||'').trim();
 const roleLabel=String(raw.roleLabel||'').trim();
 const biography=String(raw.biography||'').trim();
 const shirtNumber=raw.shirtNumber===''||raw.shirtNumber==null?null:Number(raw.shirtNumber);
 const sortOrder=raw.sortOrder===''?NaN:Number(raw.sortOrder);
 const publish=raw.publish===true;
 const consentConfirmed=raw.consentConfirmed===true;
 const errors=[];
 if(!CLUB_TEAMS.some(t=>t.code===code))errors.push('Sélectionne une équipe.');
 if(!['player','coach','staff'].includes(kind))errors.push('Choisis joueur, éducateur ou encadrement.');
 if(displayName.length<2||displayName.length>100)errors.push('Le nom public doit contenir entre 2 et 100 caractères.');
 if(roleLabel.length<2||roleLabel.length>80)errors.push('La fonction doit contenir entre 2 et 80 caractères.');
 if(biography.length>280)errors.push('La présentation publique ne peut dépasser 280 caractères.');
 if(shirtNumber!==null&&(!Number.isInteger(shirtNumber)||shirtNumber<1||shirtNumber>99||kind!=='player'))errors.push('Numéro valide de 1 à 99, réservé aux joueurs.');
 if(!Number.isInteger(sortOrder)||sortOrder<0||sortOrder>10000)errors.push('L’ordre doit être un entier de 0 à 10 000.');
 if(publish&&!consentConfirmed)errors.push('La publication exige le consentement vérifié et les droits nécessaires.');
 return {valid:errors.length===0,errors,teamCode:code,personKind:kind,displayName,roleLabel,
  biography,shirtNumber,sortOrder,publish,consentConfirmed};
}
export function teamPersonRpcArgs(review,teamId,selected=null){
 if(!review.valid||!teamId)throw new Error('Validation et équipe requises');
 return {p_id:selected?.id||null,p_team_id:teamId,
  p_display_name:review.displayName,p_person_kind:review.personKind,
  p_role_label:review.roleLabel,p_shirt_number:review.shirtNumber,
  p_biography:review.biography,p_sort_order:review.sortOrder,
  p_publish:review.publish,p_consent_confirmed:review.consentConfirmed,
  p_expected_updated_at:selected?.updated_at||null};
}
export function canEditTeamPublicPeople(expectedId,verifiedId,roles,aal,enabled=supabaseConfig.enabled){
 return Boolean(enabled&&expectedId&&expectedId===verifiedId
  &&Array.isArray(roles)&&roles.includes('admin')&&aal==='aal2');
}
function labeled(label,control){
 const l=make('label','club-editor-field',label);l.append(control);return l;
}
function frame(root,local=false){
 root.append(make('h2','','Équipes · effectifs publics'),
  make('p','club-editor-help',local
   ?'Atelier local uniquement : aucune identité réelle, sauvegarde ou publication. Ne saisis pas de donnée personnelle.'
   :'Brouillons privés, publication conditionnée par les autorisations vérifiées. Les personnes mineures nécessitent les accords applicables. Accès admin MFA et journal d’audit.'));
 const form=make('form','club-editor-form');form.noValidate=true;
 const f={};
 f.team=make('select','club-editor-control');
 for(const team of CLUB_TEAMS){
  const opt=make('option','',team.name+' · '+team.division);opt.value=team.code;f.team.append(opt);
 }
 f.kind=make('select','club-editor-control');
 for(const [value,label] of [['player','Joueur'],['coach','Entraîneur'],['staff','Encadrement']]){
  const opt=make('option','',label);opt.value=value;f.kind.append(opt);
 }
 f.name=make('input','club-editor-control');f.name.maxLength=100;
 f.role=make('input','club-editor-control');f.role.maxLength=80;
 f.role.placeholder='Ex. Gardien, Défenseur, Entraîneur';
 f.number=make('input','club-editor-control');f.number.type='number';f.number.min='1';f.number.max='99';
 f.bio=make('textarea','club-editor-control');f.bio.rows=3;f.bio.maxLength=280;
 f.order=make('input','club-editor-control');f.order.type='number';f.order.min='0';f.order.max='10000';f.order.value='0';
 f.publish=make('input');f.publish.type='checkbox';
 f.consent=make('input');f.consent.type='checkbox';
 const publication=labeled('Demander la publication publique',f.publish);publication.classList.add('club-editor-check');
 const consent=labeled('Je confirme les accords applicables, la vérification des faits et des droits (y compris responsables légaux si nécessaires).',f.consent);consent.classList.add('club-editor-check');
 form.append(
  labeled('Équipe',f.team),labeled('Type de personne',f.kind),labeled('Nom public validé',f.name),
  labeled('Rôle / poste',f.role),labeled('Numéro de maillot (facultatif)',f.number),
  labeled('Présentation publique facultative',f.bio),labeled('Ordre de présentation',f.order),
  publication,consent
 );
 const preview=make('div','club-editor-preview');preview.setAttribute('aria-live','polite');
 const feedback=make('p','club-editor-feedback');feedback.setAttribute('role','status');
 const action=btn(local?'Prévisualiser':'Enregistrer en sécurité');
 form.append(action);root.append(form,feedback,preview);
 const values=()=>({teamCode:f.team.value,personKind:f.kind.value,displayName:f.name.value,
  roleLabel:f.role.value,shirtNumber:f.number.value,biography:f.bio.value,
  sortOrder:f.order.value,publish:f.publish.checked,consentConfirmed:f.consent.checked});
 const draw=()=>{
  const v=validateTeamPersonDraft(values());
  preview.replaceChildren();
  if(!v.valid){
   const ul=make('ul','club-editor-errors');
   for(const error of v.errors)ul.append(make('li','',error));
   preview.append(ul);return;
  }
  const sample=make('article','club-editor-sample');
  sample.append(make('span','tiny-label',CLUB_TEAMS.find(t=>t.code===v.teamCode)?.name+' · '+v.personKind),
   make('h3','',v.displayName),make('p','',v.roleLabel));
  if(v.biography)sample.append(make('p','',v.biography));
  sample.append(make('small','',v.publish?'APERÇU · publication demandée':'APERÇU · brouillon privé'));
  preview.append(sample);
 };
 for(const event of ['input','change'])form.addEventListener(event,draw);
 action.addEventListener('click',draw);
 const fill=(row,teams=[])=>{
  f.team.value=teams.find(t=>t.id===row?.team_id)?.code||CLUB_TEAMS[0].code;
  f.kind.value=row?.person_kind||'player';
  f.name.value=row?.display_name||'';
  f.role.value=row?.role_label||'';
  f.number.value=row?.shirt_number==null?'':String(row.shirt_number);
  f.bio.value=row?.biography||'';
  f.order.value=String(row?.sort_order??0);
  f.publish.checked=row?.published===true;
  f.consent.checked=false;draw();
 };
 fill(null);
 return {f,form,feedback,preview,action,values,draw,fill};
}
export function mountTeamPeoplePreview(root){
 root.replaceChildren();
 const r=frame(root,true);r.feedback.textContent='Aperçu local uniquement — aucune donnée transmise ni enregistrée.';
 return r;
}
async function verifyAdmin(api,expectedId){
 if(!supabaseConfig.enabled||!api||!expectedId)return false;
 const [u,m]=await Promise.all([api.auth.getUser(),api.auth.mfa.getAuthenticatorAssuranceLevel()]);
 if(u.error||m.error||u.data?.user?.id!==expectedId||m.data?.currentLevel!=='aal2')return false;
 const roles=await api.from('user_roles').select('role').eq('user_id',expectedId);
 if(roles.error)return false;
 return canEditTeamPublicPeople(expectedId,u.data.user.id,(roles.data||[]).map(r=>r.role),m.data.currentLevel);
}
export async function mountAuthenticatedTeamPeopleEditor(container,api,userId){
 if(!supabaseConfig.enabled||!container?.isConnected||!api||!userId)return;
 if(!await verifyAdmin(api,userId)||!container.isConnected)return;
 const root=make('section','club-editor-private team-person-private');
 root.setAttribute('aria-label','Éditeur sécurisé des profils publics de joueurs et staff');
 container.append(root);
 const frameData=frame(root,false);
 const selectLabel=make('label','club-editor-field','Profil à modifier');
 const selector=make('select','club-editor-control');
 selectLabel.append(selector);frameData.form.insertBefore(selectLabel,frameData.form.firstChild);
 let teams=[],entries=[],loading=false,confirmation=null;
 const directory=make('section','team-roster-directory');
 directory.setAttribute('aria-label','Répertoire privé des fiches sportives');
 root.insertBefore(directory,frameData.form);
 const controls=make('div','team-person-secondary-actions');
 const refresh=button('Actualiser les profils','team-person-secondary-button');
 const withdraw=button('Préparer la dépublication','team-person-secondary-button');
 controls.append(refresh,withdraw);
 frameData.form.append(controls);
 const selected=()=>entries.find(r=>r.id===selector.value)||null;
 const browser=mountAdminRosterDirectory(directory,id=>{
   if(loading)return;
   selector.value=id;choose();
   frameData.f.name.focus();
 });
 const choose=()=>{
  frameData.fill(selected(),teams);
  confirmation=null;
  frameData.feedback.textContent=selected()?'Profil chargé · modifications non enregistrées.':'Nouveau brouillon.';
  withdraw.hidden=selected()?.published!==true;
  browser.update(entries,teams,selected()?.id||null);
 };
 async function reload(preferred=null){
  if(!await verifyAdmin(api,userId)){
   if(root.isConnected)root.replaceChildren(make('p','club-editor-feedback','Accès refusé : vérification administrateur ou MFA insuffisante.'));
   return;
  }
  const [teamData,peopleData]=await Promise.all([
   api.from('club_teams').select('id,code,name').order('sort_order'),
   api.rpc('admin_list_team_public_people')
  ]);
  if(!root.isConnected)return;
  if(teamData.error||peopleData.error||!Array.isArray(peopleData.data)){
   frameData.action.disabled=true;
   frameData.feedback.textContent='Chargement sécurisé indisponible. Aucune donnée modifiée. Utilise « Actualiser les profils » pour réessayer.';
   return;
  }
  teams=teamData.data||[];entries=peopleData.data;
  frameData.action.disabled=false;
  selector.replaceChildren();
  const fresh=make('option','','+ Nouveau profil');fresh.value='new';selector.append(fresh);
  for(const person of entries){
   const opt=make('option','',person.display_name+' · '+(person.published?'Publié':'Brouillon'));
   opt.value=person.id;selector.append(opt);
  }
  selector.value=entries.some(r=>r.id===preferred)?preferred:'new';choose();
 }
 selector.addEventListener('change',choose);
 refresh.addEventListener('click',async()=>{
   if(loading)return;
   refresh.disabled=true;
   try{await reload(selected()?.id||null);}
   finally{refresh.disabled=false;}
 });
 withdraw.addEventListener('click',()=>{
   if(loading||selected()?.published!==true)return;
   frameData.f.publish.checked=false;
   frameData.f.consent.checked=false;
   confirmation=null;frameData.draw();
   frameData.feedback.textContent='Retrait préparé. Vérifie la fiche, puis utilise « Enregistrer en sécurité » deux fois pour confirmer la dépublication.';
   frameData.action.focus();
 });
 for(const ev of ['input','change'])frameData.form.addEventListener(ev,()=>{confirmation=null});
 frameData.action.addEventListener('click',async()=>{
  if(loading||!root.isConnected)return;
  const review=validateTeamPersonDraft(frameData.values());frameData.draw();
  if(!review.valid){frameData.feedback.textContent='Corrige la fiche avant de l’enregistrer.';return}
  const teamId=teams.find(t=>t.code===review.teamCode)?.id;
  if(!teamId){frameData.feedback.textContent='L’équipe demandée n’est pas disponible.';return}
  const old=selected(),args=teamPersonRpcArgs(review,teamId,old);
  const fingerprint=JSON.stringify(args);
  if((review.publish||old?.published===true)&&confirmation!==fingerprint){
   confirmation=fingerprint;
   frameData.feedback.textContent=review.publish
    ?'Vérifie les autorisations et clique de nouveau pour confirmer la publication.'
    :'Ce profil sera retiré du public. Clique de nouveau pour confirmer.';
   return;
  }
  confirmation=null;loading=true;frameData.action.disabled=true;
  frameData.feedback.textContent='Vérification MFA et enregistrement…';
  try{
   if(!await verifyAdmin(api,userId)){frameData.feedback.textContent='Accès refusé : droits ou MFA expirés.';return}
   if(!root.isConnected)return;
   const result=await api.rpc('admin_save_team_public_person',args);
   if(!root.isConnected)return;
   if(result.error){
    frameData.feedback.textContent=result.error.code==='40001'
     ?'Cette fiche a changé. Recharge avant de modifier.':'Enregistrement refusé par le serveur.';
    return;
   }
   await reload(result.data);
   if(root.isConnected)frameData.feedback.textContent='Profil enregistré. Visibilité contrôlée par Supabase.';
  }catch{
   if(root.isConnected)frameData.feedback.textContent='Service temporairement indisponible. Aucun enregistrement confirmé.';
  }finally{
   loading=false;if(frameData.action.isConnected)frameData.action.disabled=false;
  }
 });
 frameData.feedback.textContent='Chargement des profils administrables…';
 await reload();
}
