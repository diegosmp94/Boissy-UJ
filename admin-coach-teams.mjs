/** Admin-only coach/team assignments. Never grants roles, changes accounts or exposes contacts. */
import {adminSessionStatus} from './admin-security.mjs';
const create=(tag,cls='',value=null)=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(value!==null)node.textContent=String(value);
 return node;
};
export function coachAssignmentAction(coach,adminId){
 if(!coach?.coach_user_id||!adminId||coach.coach_user_id===adminId)return null;
 return coach.active===true?'deactivate':'activate';
}
export function searchApprovedCoaches(coaches,query=''){
 const n=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLocaleLowerCase('fr').trim();
 const term=n(query);
 return !term?[...coaches]:coaches.filter(coach=>n(coach.display_name).includes(term));
}
export function coachAssignmentPayload(teamId,coach,adminId){
 const action=coachAssignmentAction(coach,adminId);
 if(!teamId||!action)throw new Error('Invalid team or coach assignment');
 return {p_team_id:teamId,p_coach_user_id:coach.coach_user_id,p_active:action==='activate'};
}
export async function mountAdminCoachTeams(root,api,userId){
 if(!root?.isConnected||!api||!userId)return;
 root.replaceChildren(create('h2','','Affectations des entraîneurs aux équipes'));
 const explanation=create('p','admin-workflow-status',
  'Seuls les comptes ayant déjà le rôle Entraîneur validé sont proposés. Chaque changement nécessite une confirmation et est journalisé.');
 const status=create('p','admin-workflow-status','Vérification des droits administrateur…');
 status.setAttribute('role','status');
 const teamLabel=create('label','admin-form-field','Équipe à administrer');
 const select=create('select','admin-form-control');teamLabel.append(select);
 const searchLabel=create('label','admin-form-field','Rechercher un entraîneur');
 const search=create('input','admin-form-control');search.type='search';
 search.maxLength=80;search.placeholder='Nom du compte Entraîneur…';
 searchLabel.append(search);
 const refresh=create('button','admin-secondary-btn','Actualiser les affectations');
 refresh.type='button';
 const listing=create('div','admin-member-list');
 root.append(explanation,status,teamLabel,searchLabel,refresh,listing);
 let items=[],revision=0,busy=false,teams=[];
 const isAdmin=async()=>{
  const gate=await adminSessionStatus(api,userId);
  return gate.status==='admin'&&gate.level==='aal2';
 };
 const render=()=>{
  if(!root.isConnected)return;
  listing.replaceChildren();
  const found=searchApprovedCoaches(items,search.value);
  status.textContent=found.length+' compte(s) Entraîneur affiché(s) sur '+items.length+' éligible(s) (maximum 250).';
  if(!found.length){
   listing.append(create('p','admin-empty',items.length
    ?'Aucun entraîneur ne correspond à ta recherche.'
    :'Aucun compte Entraîneur approuvé. Les rôles se demandent et sont validés séparément.'));
   return;
  }
  for(const coach of found){
   const card=create('article','admin-member-card');
   const meta=create('div','admin-player-team-meta');
   meta.append(create('strong','',coach.display_name),
    create('small','',coach.active?'Affectation active':'Non affecté à cette équipe'));
   card.append(meta);
   const action=coachAssignmentAction(coach,userId);
   if(!action){
    card.append(create('p','admin-empty','L’affectation de son propre compte est interdite.'));
    listing.append(card);continue;
   }
   const add=action==='activate';
   const label=add?'Attribuer cette équipe':'Retirer cette équipe';
   const button=create('button','admin-secondary-btn',label);button.type='button';
   const feedback=create('p','admin-workflow-status','');feedback.hidden=true;
   let intentKey=null;
   button.addEventListener('click',async()=>{
    if(busy||!root.isConnected)return;
    const key=select.value+'|'+coach.coach_user_id+'|'+action;
    if(intentKey!==key){
     intentKey=key;button.textContent='Confirmer : '+label;
     feedback.hidden=false;
     feedback.textContent='Confirme le compte et l’équipe ; cette opération modifie ses accès sportifs.';
     return;
    }
    intentKey=null;busy=true;button.disabled=true;select.disabled=true;refresh.disabled=true;
    const expectedTeam=select.value;
    feedback.textContent='Vérification du MFA et des permissions…';
    try{
     if(!await isAdmin()){
      if(root.isConnected)feedback.textContent='Rôle administrateur ou MFA expiré. Opération annulée.';
      return;
     }
     if(!root.isConnected||select.value!==expectedTeam)return;
     const args=coachAssignmentPayload(expectedTeam,coach,userId);
     const result=await api.rpc('admin_set_coach_team_assignment',args);
     if(!root.isConnected||select.value!==expectedTeam)return;
     if(result.error||result.data!==true){
      feedback.textContent='Le serveur a refusé ce changement. Actualise les affectations.';
      return;
     }
     feedback.textContent='Affectation enregistrée et journalisée.';
     await reload(expectedTeam);
    }catch{
     if(root.isConnected)feedback.textContent='Service momentanément indisponible : aucun changement confirmé.';
    }finally{
     busy=false;if(select.isConnected)select.disabled=false;
     if(refresh.isConnected)refresh.disabled=false;
     if(button.isConnected){button.disabled=false;button.textContent=label;}
    }
   });
   card.append(button,feedback);listing.append(card);
  }
 };
 async function reload(expectedTeam=null){
  const run=++revision;
  items=[];listing.replaceChildren();
  refresh.disabled=true;status.textContent='Vérification de la session et des affectations…';
  try{
   if(!await isAdmin()){
    if(root.isConnected&&run===revision)status.textContent='Seul un administrateur avec MFA AAL2 peut voir ces affectations.';
    return;
   }
   if(!root.isConnected||run!==revision)return;
   const id=expectedTeam||select.value;
   if(!teams.some(t=>t.id===id)){status.textContent='Choisis une équipe valide.';return;}
   const result=await api.rpc('admin_list_team_coaches',{p_team_id:id});
   if(!root.isConnected||run!==revision||select.value!==id)return;
   if(result.error||!Array.isArray(result.data)){
    status.textContent='Liste privée indisponible : les affectations sont verrouillées.';
    return;
   }
   items=result.data.filter(c=>typeof c.coach_user_id==='string'
    &&typeof c.display_name==='string'&&typeof c.active==='boolean');
   render();
  }catch{
   if(root.isConnected&&run===revision)status.textContent='Impossible de vérifier les affectations.';
  }finally{if(refresh.isConnected)refresh.disabled=false;}
 }
 search.addEventListener('input',render);
 select.addEventListener('change',()=>{if(!busy)void reload();});
 refresh.addEventListener('click',()=>{if(!busy)void reload();});
 try{
  if(!await isAdmin()){if(root.isConnected)status.textContent='Session administrateur MFA AAL2 requise.';return;}
  const response=await api.from('club_teams').select('id,name').order('sort_order',{ascending:true});
  if(!root.isConnected)return;
  if(response.error||!response.data?.length){status.textContent='Catalogue des équipes indisponible.';return;}
  teams=response.data;
  for(const t of teams){const o=create('option','',t.name);o.value=t.id;select.append(o);}
  await reload();
 }catch{if(root.isConnected)status.textContent='Impossible de démarrer la gestion sécurisée des entraîneurs.';}
}
