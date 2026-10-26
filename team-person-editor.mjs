/**
 * Annuaire public des équipes, distinct des affiliations privées :
 * aucun nom importé, brouillons privés, publication après contrôle MFA admin.
 */
import {supabaseConfig} from './auth-config.mjs';
import {CLUB_TEAMS} from './club-teams.mjs';
import {mountAdminRosterDirectory} from './team-roster-admin.mjs';
import {mountAdminRosterReadiness} from './admin-roster-readiness.mjs';
import {PLAYER_POSITION_GROUPS,positionFromPublicRole} from './player-position-groups.mjs';

const make=(tag,cls='',value=null)=>{
 const n=document.createElement(tag);if(cls)n.className=cls;
 if(value!==null)n.textContent=String(value);return n;
};
const btn=(label)=>{const b=make('button','staff-action',label);b.type='button';return b;};
// Secondary admin controls must be real buttons; an undefined `button()` previously crashed the module.
const button=(label,cls='team-person-secondary-button')=>{const el=make('button',cls,label);el.type='button';return el;};
/** Explicit publication guidance; private assignments never silently become public. */
export function publicPositionForRole(kind,roleLabel){
 return kind==='player'?positionFromPublicRole(roleLabel):null;
}
export function canonicalPublicPlayerRole(group){
 const names={goalkeeper:'Gardien',defender:'Défenseur',midfielder:'Milieu',forward:'Attaquant'};
 return Object.hasOwn(names,group)?names[group]:null;
}
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
export function canEditTeamPublicPeople(expectedId,verifiedId,roles,aal,enabled=supabaseConfig.adminEnabled){
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
 f.position=make('select','club-editor-control');
 const positionBlank=make('option','','Choisir une catégorie…');positionBlank.value='';
 f.position.append(positionBlank);
 for(const group of PLAYER_POSITION_GROUPS){
  const opt=make('option','',group.label);opt.value=group.id;f.position.append(opt);
 }
 const positionField=labeled('Catégorie du joueur (rubrique du site)',f.position);
 const positionHelp=make('p','club-editor-help',
  'La catégorie détermine où le joueur apparaît. Son poste précis peut ensuite être indiqué dans « Rôle / poste ». La répartition privée des éducateurs n’est jamais publiée automatiquement.');
 f.number=make('input','club-editor-control');f.number.type='number';f.number.min='1';f.number.max='99';
 f.bio=make('textarea','club-editor-control');f.bio.rows=3;f.bio.maxLength=280;
 f.order=make('input','club-editor-control');f.order.type='number';f.order.min='0';f.order.max='10000';f.order.value='0';
 f.publish=make('input');f.publish.type='checkbox';
 f.consent=make('input');f.consent.type='checkbox';
 const publication=labeled('Demander la publication publique',f.publish);publication.classList.add('club-editor-check');
 const consent=labeled('Je confirme les accords applicables, la vérification des faits et des droits (y compris responsables légaux si nécessaires).',f.consent);consent.classList.add('club-editor-check');
 form.append(
  labeled('Équipe',f.team),labeled('Type de personne',f.kind),labeled('Nom public validé',f.name),
  positionField,positionHelp,labeled('Rôle / poste',f.role),labeled('Numéro de maillot (facultatif)',f.number),
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
 const syncPublicPosition=()=>{
  const player=f.kind.value==='player';
  positionField.hidden=!player;positionHelp.hidden=!player;
  f.position.value=publicPositionForRole(f.kind.value,f.role.value)||'';
 };
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
  if(v.personKind==='player'&&!publicPositionForRole(v.personKind,v.roleLabel))
   sample.append(make('small','club-editor-position-warning',
    'Poste non reconnu : la fiche apparaîtra dans « À classer » jusqu’à validation d’une catégorie.'));
  sample.append(make('small','',v.publish?'APERÇU · publication demandée':'APERÇU · brouillon privé'));
  preview.append(sample);
 };
 f.position.addEventListener('change',()=>{
  const role=canonicalPublicPlayerRole(f.position.value);
  if(f.kind.value==='player'&&role){f.role.value=role;draw();}
 });
 f.role.addEventListener('input',()=>{syncPublicPosition();draw();});
 f.kind.addEventListener('change',()=>{syncPublicPosition();draw();});
 for(const event of ['input','change'])form.addEventListener(event,draw);
 action.addEventListener('click',draw);
 const fill=(row,teams=[])=>{
  f.team.value=teams.find(t=>t.id===row?.team_id)?.code||CLUB_TEAMS[0].code;
  f.kind.value=row?.person_kind||'player';
  f.name.value=row?.display_name||'';
  f.role.value=row?.role_label||'';
  syncPublicPosition();
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
 if(!supabaseConfig.adminEnabled||!api||!expectedId)return false;
 const [u,m]=await Promise.all([api.auth.getUser(),api.auth.mfa.getAuthenticatorAssuranceLevel()]);
 if(u.error||m.error||u.data?.user?.id!==expectedId||m.data?.currentLevel!=='aal2')return false;
 const roles=await api.from('user_roles').select('role').eq('user_id',expectedId);
 if(roles.error)return false;
 return canEditTeamPublicPeople(expectedId,u.data.user.id,(roles.data||[]).map(r=>r.role),m.data.currentLevel);
}
export async function mountAuthenticatedTeamPeopleEditor(container,api,userId){
 if(!supabaseConfig.adminEnabled||!container?.isConnected||!api||!userId)return;
 if(!await verifyAdmin(api,userId)||!container.isConnected)return;
 const root=make('section','club-editor-private team-person-private');
 root.setAttribute('aria-label','Éditeur sécurisé des profils publics de joueurs et staff');
 container.append(root);
 const frameData=frame(root,false);
 const selectLabel=make('label','club-editor-field','Profil à modifier');
 const selector=make('select','club-editor-control');
 selectLabel.append(selector);frameData.form.insertBefore(selectLabel,frameData.form.firstChild);
 let teams=[],entries=[],loading=false,confirmation=null,profileConfirmation=null,rosterRevision=0,reloadRevision=0;
 const directory=make('section','team-roster-directory');
 directory.setAttribute('aria-label','Répertoire privé des fiches sportives');
 root.insertBefore(directory,frameData.form);
 const auditMount=make('div','team-roster-readiness-slot');
 root.insertBefore(auditMount,frameData.form);
 const rosterAudit=mountAdminRosterReadiness(auditMount,api,
  ()=>verifyAdmin(api,userId),()=>({teams,entries,revision:rosterRevision}));
 const controls=make('div','team-person-secondary-actions');
 const refresh=button('Actualiser les profils','team-person-secondary-button');
 const withdraw=button('Préparer la dépublication','team-person-secondary-button');
 controls.append(refresh,withdraw);
 frameData.form.append(controls);
 const profileArea=make('section','team-profile-publication');
 profileArea.setAttribute('aria-label','Publication de la fiche individuelle');
 const profileTitle=make('h3','','Fiche individuelle joueur / éducateur');
 const profileHelp=make('p','club-editor-help',
  'Le consentement à figurer dans l’effectif ne vaut pas autorisation pour une fiche personnelle. Publication séparée, révocable et journalisée. Les droits des mineurs doivent être vérifiés hors de cet écran.');
 const profileCheck=make('input');profileCheck.type='checkbox';
 const profileConsent=labeled('Je confirme avoir vérifié l’autorisation spécifique de publication de cette fiche individuelle et de sa présentation.',profileCheck);
 profileConsent.classList.add('club-editor-check');
 const profileButton=button('Autoriser la fiche individuelle');
 const profileStatus=make('p','club-editor-feedback');
 profileStatus.setAttribute('role','status');profileStatus.setAttribute('aria-live','polite');
 profileArea.append(profileTitle,profileHelp,profileConsent,profileButton,profileStatus);
 root.append(profileArea);
 const selected=()=>entries.find(r=>r.id===selector.value)||null;
 const browser=mountAdminRosterDirectory(directory,id=>{
   if(loading)return;
   selector.value=id;choose();
   frameData.f.name.focus();
 });
 const syncProfilePermissions=()=>{
  const person=selected();
  const published=person?.profile_visible===true&&person?.profile_consent_confirmed===true;
  profileArea.hidden=!person;
  profileConfirmation=null;
  profileCheck.checked=false;
  profileConsent.hidden=published;
  profileButton.textContent=published?'Préparer le retrait de la fiche individuelle':'Autoriser la fiche individuelle';
  profileButton.disabled=loading||!person||(!published&&
   (person.published!==true||person.consent_confirmed!==true));
  profileStatus.textContent=!person?'Enregistre d’abord le profil sportif.'
   :published?'Fiche individuelle publiée avec accord spécifique : retrait possible.'
   :person.published&&person.consent_confirmed?'Fiche individuelle privée. Vérifie l’accord spécifique avant publication.'
   :'Publie d’abord la fiche dans l’effectif avec les accords applicables.';
 };
 const choose=()=>{
  frameData.fill(selected(),teams);
  confirmation=null;
  frameData.feedback.textContent=selected()?'Profil chargé · modifications non enregistrées.':'Nouveau brouillon.';
  withdraw.hidden=selected()?.published!==true;
  browser.update(entries,teams,selected()?.id||null);
  syncProfilePermissions();
 };
 async function reload(preferred=null){
  const run=++reloadRevision;
  const current=()=>root.isConnected&&run===reloadRevision;
  // Clear confidential admin data BEFORE requesting a fresh MFA-gated snapshot.
  // This also prevents stale counts or identities from remaining visible if MFA expires.
  rosterRevision++;rosterAudit?.invalidate();
  confirmation=null;profileConfirmation=null;profileArea.hidden=true;teams=[];entries=[];
  browser.update([],[],null);
  selector.replaceChildren();selector.disabled=true;
  frameData.fill(null);
  frameData.action.disabled=true;withdraw.disabled=true;refresh.disabled=true;
  frameData.feedback.textContent='Vérification MFA et actualisation des profils…';
  try{
   if(!await verifyAdmin(api,userId)){
    if(current())root.replaceChildren(make('p','club-editor-feedback',
     'Accès refusé : vérification administrateur ou MFA insuffisante.'));
    return false;
   }
   if(!current())return false;
   const [teamData,peopleData]=await Promise.all([
    api.from('club_teams').select('id,code,name').order('sort_order'),
    api.rpc('admin_list_team_public_people')
   ]);
   if(!current())return false;
   if(teamData.error||peopleData.error||!Array.isArray(peopleData.data)
      ||!Array.isArray(teamData.data)){
    frameData.feedback.textContent='Chargement sécurisé indisponible. Aucune donnée modifiée. Utilise « Actualiser les profils » pour réessayer.';
    return false;
   }
   // A role/MFA revocation while a request was in flight MUST prevent
   // private names from ever being inserted into the document.
   if(!await verifyAdmin(api,userId)){
    if(current())root.replaceChildren(make('p','club-editor-feedback',
      'Session administrateur ou MFA expiré pendant le chargement. Reconnecte-toi.'));
    return false;
   }
   if(!current())return false;
   teams=teamData.data;entries=peopleData.data;
   rosterRevision++;rosterAudit?.invalidate();
   selector.replaceChildren();
   const fresh=make('option','','+ Nouveau profil');fresh.value='new';selector.append(fresh);
   for(const person of entries){
    const opt=make('option','',person.display_name+' · '+(person.published?'Publié':'Brouillon'));
    opt.value=person.id;selector.append(opt);
   }
   selector.value=entries.some(r=>r.id===preferred)?preferred:'new';
   selector.disabled=false;frameData.action.disabled=loading;
   choose();
   return true;
  }catch{
   if(current())frameData.feedback.textContent=
    'Service temporairement indisponible. Aucun profil privé chargé ou modifié.';
   return false;
  }finally{
   if(current())refresh.disabled=loading;
  }
 }
 profileCheck.addEventListener('change',()=>{profileConfirmation=null;});
 profileButton.addEventListener('click',async()=>{
  if(loading||!root.isConnected)return;
  const person=selected();
  if(!person){profileStatus.textContent='Enregistre d’abord le profil.';return;}
  const enabled=person.profile_visible===true&&person.profile_consent_confirmed===true;
  const grant=!enabled;
  if(grant&&(!person.published||!person.consent_confirmed||!profileCheck.checked)){
   profileStatus.textContent='Publication réservée à un profil d’effectif autorisé et à un accord individuel explicitement vérifié.';
   return;
  }
  const fingerprint=person.id+'|'+person.updated_at+'|'+String(grant);
  if(profileConfirmation!==fingerprint){
   profileConfirmation=fingerprint;
   profileButton.textContent=grant?'Confirmer la publication de la fiche individuelle':'Confirmer le retrait de la fiche individuelle';
   profileStatus.textContent=grant
    ?'Confirme la mise en ligne de la fiche complète (nom, équipe, rôle et biographie).'
    :'Confirme : ce lien public individuel cessera de présenter la fiche.';
   return;
  }
  profileConfirmation=null;loading=true;profileButton.disabled=true;profileCheck.disabled=true;
  profileStatus.textContent='Vérification MFA AAL2 et enregistrement de l’accord individuel…';
  try{
   if(!await verifyAdmin(api,userId))throw new Error('MFA required');
   if(!root.isConnected||selected()?.id!==person.id)return;
   const result=await api.rpc('admin_set_public_person_profile',{
    p_person_id:person.id,p_enable:grant,p_consent_reviewed:grant&&profileCheck.checked,
    p_expected_updated_at:person.updated_at
   });
   if(!root.isConnected||selected()?.id!==person.id)return;
   if(result.error||result.data!==true){
    profileStatus.textContent=result.error?.code==='40001'
     ?'Profil modifié entre-temps : recharge avant de confirmer.'
     :'Publication ou retrait refusé par Supabase. Vérifie les droits et actualise.';
    return;
   }
   const ok=await reload(person.id);
   if(root.isConnected&&ok)profileStatus.textContent=grant
    ?'Fiche individuelle publiée après consentement spécifique et validation serveur.'
    :'Fiche individuelle retirée : aucun nouveau lien public n’est autorisé.';
  }catch{
   if(root.isConnected)profileStatus.textContent=
    'Action non confirmée. Vérifie la session et actualise la liste des profils.';
  }finally{
   loading=false;if(profileCheck.isConnected)profileCheck.disabled=false;
   if(profileButton.isConnected&&!profileArea.hidden)syncProfilePermissions();
  }
 });
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
   const refreshed=await reload(result.data);
   if(root.isConnected&&refreshed)
    frameData.feedback.textContent='Profil enregistré et relu. Visibilité contrôlée par Supabase.';
  }catch{
   if(root.isConnected)frameData.feedback.textContent='Service temporairement indisponible. Aucun enregistrement confirmé.';
  }finally{
   loading=false;if(frameData.action.isConnected)frameData.action.disabled=false;
  }
 });
 frameData.feedback.textContent='Chargement des profils administrables…';
 await reload();
}
