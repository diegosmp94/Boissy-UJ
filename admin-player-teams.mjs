/** Administrative team affiliations. Never elevates roles or publishes player identities.
 * Auth server is sole authority. Browser only presents MFA-protected RPC results.
 */
import {adminSessionStatus} from './admin-security.mjs';

const el=(tag,cls='',value=null)=>{
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(value!==null)n.textContent=String(value);
 return n;
};
export function membershipAction(player,currentUserId){
 if(!player?.player_user_id||player.player_user_id===currentUserId)return null;
 return player.active===true?'remove':'add';
}
export function filterEligiblePlayers(rows,q=''){
 const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
 const needle=norm(q).trim();
 return !needle?[...rows]:rows.filter(p=>norm(p.display_name).includes(needle));
}
export async function mountAdminPlayerTeams(root,api,userId){
 root.replaceChildren(el('h2','','Affectation des joueurs aux équipes'));
 const intro=el('p','admin-workflow-status',
  'Seuls les comptes ayant déjà obtenu le rôle Joueur peuvent être rattachés à une équipe. Chaque ajout ou retrait est validé par Supabase et journalisé.');
 const status=el('p','admin-workflow-status','Vérification des droits administrateur…');
 status.setAttribute('role','status');
 const teamLabel=el('label','admin-form-field','Équipe');
 const team=el('select','admin-form-control');
 teamLabel.append(team);
 const filterLabel=el('label','admin-form-field','Rechercher un joueur');
 const search=el('input','admin-form-control');search.type='search';
 search.maxLength=80;search.placeholder='Nom du joueur autorisé…';
 filterLabel.append(search);
 const reloadBtn=el('button','admin-secondary-btn','Actualiser les affiliations');
 reloadBtn.type='button';
 const list=el('div','admin-member-list');
 root.append(intro,status,teamLabel,filterLabel,reloadBtn,list);
 let generation=0,busy=false,rows=[];
 const verified=async()=>{
  const result=await adminSessionStatus(api,userId);
  return result.status==='admin'&&result.level==='aal2';
 };
 const render=()=>{
  if(!root.isConnected)return;
  list.replaceChildren();
  const chosen=filterEligiblePlayers(rows,search.value);
  status.textContent=chosen.length+' joueur(s) à afficher sur '+rows.length+' compte(s) Joueur éligible(s), liste limitée à 250.';
  if(chosen.length===0){
   list.append(el('p','admin-empty',rows.length?'Aucun joueur correspondant.':'Aucun compte possédant le rôle Joueur. Les rôles sont attribués via les demandes validées.'));
   return;
  }
  for(const p of chosen){
   const line=el('article','admin-member-card');
   const meta=el('div','admin-player-team-meta');
   meta.append(el('strong','',p.display_name),el('small','',p.active?'Membre actif de cette équipe':'Pas encore membre de cette équipe'));
   const action=membershipAction(p,userId);
   line.append(meta);
   if(!action){
    line.append(el('p','admin-empty','L’affectation de son propre compte est interdite.'));list.append(line);continue;
   }
   const desired=action==='add',label=desired?'Ajouter à l’équipe':'Retirer de l’équipe';
   const btn=el('button','admin-secondary-btn',label);btn.type='button';
   const info=el('p','admin-workflow-status','');
   info.hidden=true;
   let confirm=false;
   btn.addEventListener('click',async()=>{
    if(!root.isConnected||busy)return;
    if(!confirm){
     confirm=true;
     btn.textContent='Confirmer : '+label;
     info.hidden=false;
     info.textContent='Vérifie le joueur et l’équipe, puis confirme. Ce changement sera inscrit dans le journal privé.';
     return;
    }
    confirm=false;
    busy=true;btn.disabled=true;
    info.textContent='Vérification MFA et enregistrement côté serveur…';
    const expectedTeam=team.value;
    try{
     if(!await verified()){
      if(root.isConnected)info.textContent='Session administrateur MFA non valide. Action annulée.';
      return;
     }
     if(!root.isConnected||team.value!==expectedTeam)return;
     const result=await api.rpc('admin_set_player_team_membership',{
      p_team_id:expectedTeam,p_player_user_id:p.player_user_id,p_active:desired
     });
     if(!root.isConnected||team.value!==expectedTeam)return;
     if(result.error||result.data!==true){
      info.textContent='Changement refusé par Supabase. Actualise les affiliations avant de réessayer.';
      return;
     }
     info.textContent='Affiliation mise à jour et journalisée.';
     await reload(expectedTeam);
    }catch{
     if(root.isConnected)info.textContent='Service indisponible ; aucune confirmation d’écriture.';
    }finally{
     busy=false;
     if(btn.isConnected){btn.disabled=false;btn.textContent=label;}
    }
   });
   line.append(btn,info);list.append(line);
  }
 };
 async function reload(requestedTeam=null){
  const token=++generation;
  rows=[];
  list.replaceChildren();
  status.textContent='Contrôle du MFA et lecture des affiliations…';
  reloadBtn.disabled=true;
  try{
   if(!await verified()){
    if(root.isConnected&&token===generation)status.textContent='Réservé aux administrateurs avec MFA AAL2.';
    return;
   }
   if(!root.isConnected||token!==generation)return;
   const id=requestedTeam||team.value;
   if(!id){status.textContent='Sélectionne une équipe.';return;}
   const result=await api.rpc('admin_list_team_players',{p_team_id:id});
   if(!root.isConnected||token!==generation||team.value!==id)return;
   if(result.error||!Array.isArray(result.data)){
    status.textContent='Gestion des affiliations indisponible. Les joueurs ne peuvent pas être modifiés.';
    return;
   }
   rows=result.data.filter(p=>typeof p.player_user_id==='string'
    &&typeof p.display_name==='string'&&typeof p.active==='boolean');
   render();
  }catch{
   if(root.isConnected&&token===generation)status.textContent='Impossible de vérifier les affiliations.';
  }finally{if(reloadBtn.isConnected)reloadBtn.disabled=false;}
 }
 search.addEventListener('input',render);
 team.addEventListener('change',()=>{if(!busy)void reload();});
 reloadBtn.addEventListener('click',()=>{if(!busy)void reload();});
 try{
  if(!await verified()){status.textContent='MFA AAL2 obligatoire.';return;}
  const result=await api.from('club_teams').select('id,name').order('sort_order',{ascending:true});
  if(!root.isConnected)return;
  if(result.error||!result.data?.length){
   status.textContent='Catalogue des équipes indisponible.';return;
  }
  for(const item of result.data){
   const option=el('option','',item.name);option.value=item.id;team.append(option);
  }
  await reload();
 }catch{
  if(root.isConnected)status.textContent='Impossible de démarrer l’éditeur sécurisé.';
 }
}
