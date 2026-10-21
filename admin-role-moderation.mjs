import {supabaseConfig} from './auth-config.mjs';

const STATUS_LABEL=Object.freeze({
  pending:'En attente',approved:'Approuvée',rejected:'Refusée',cancelled:'Annulée'
});
const ROLE_LABEL=Object.freeze({player:'Joueur',coach:'Entraîneur',admin:'Administrateur'});
const el=(tag,cls='',value=null)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(value!==null)node.textContent=String(value);
  return node;
};
const actionButton=(label,cls)=>{
  const b=el('button',cls,label);
  b.type='button';
  return b;
};

/** Client guard is UX only: Supabase checks role, AAL2 and distinct admin inside RPC. */
export function canShowRoleModeration(sessionUserId,verifiedUserId,roleNames,assuranceLevel){
  return Boolean(supabaseConfig.adminEnabled && sessionUserId && sessionUserId===verifiedUserId
    &&Array.isArray(roleNames)&&roleNames.includes('admin')&&assuranceLevel==='aal2');
}
export function mayDecideRequest(adminId,request){
  return Boolean(adminId && request?.status==='pending' && request.user_id
    &&request.user_id!==adminId &&['player','coach','admin'].includes(request.requested_role));
}
export function moderateMessage(approval){
  return approval?'Approuver cette demande ? Cliquer à nouveau pour confirmer.'
    :'Refuser cette demande ? Cliquer à nouveau pour confirmer.';
}
async function verifiedAdmin(api,expectedId){
  const [userResult,levelResult]=await Promise.all([
    api.auth.getUser(),
    api.auth.mfa.getAuthenticatorAssuranceLevel()
  ]);
  const actualUserId=userResult.data?.user?.id;
  if(userResult.error||levelResult.error||actualUserId!==expectedId)
    return {authorized:false,mfa:false};
  const mfa=levelResult.data?.currentLevel==='aal2';
  if(!mfa)return {authorized:false,mfa:false};
  const roles=await api.from('user_roles').select('role').eq('user_id',expectedId);
  if(roles.error)return {authorized:false,mfa:true};
  return {
    authorized:canShowRoleModeration(expectedId,actualUserId,
      (roles.data||[]).map(x=>x.role),levelResult.data.currentLevel),
    mfa:true
  };
}

/** Mounted only inside a signed-in user's private "Mon espace" after auth is enabled. */
export async function mountAdminRoleModeration(container,api,userId){
  if(!supabaseConfig.adminEnabled || !container?.isConnected || !api || !userId)return;
  const section=el('section','admin-role-moderation');
  section.setAttribute('aria-label','Validation des demandes de rôle');
  const heading=el('h3','','Demandes à valider');
  const status=el('p','auth-footnote','Vérification des droits administrateur et MFA…');
  status.setAttribute('role','status');
  const body=el('div','admin-role-requests');
  body.setAttribute('aria-live','polite');
  section.append(heading,status,body);
  container.append(section);
  try{
    const gate=await verifiedAdmin(api,userId);
    if(!section.isConnected)return;
    if(!gate.authorized){
      if(gate.mfa)status.textContent='Validation administrative non disponible pour cette session.';
      else status.textContent='Gestion des rôles : connexion administrateur avec MFA AAL2 requise.';
      section.hidden=true;
      return;
    }
    status.textContent='Session administrateur vérifiée. Chaque décision exige une confirmation explicite ; le serveur vérifie de nouveau les droits.';
    let teams=[];
    const teamsResponse=await api.from('club_teams').select('id,name').order('sort_order',{ascending:true});
    if(!section.isConnected)return;
    if(!teamsResponse.error)teams=teamsResponse.data||[];
    const filterLabel=el('label','staff-label','Afficher les demandes');
    const filter=el('select','staff-input');
    for(const [value,label] of [
      ['pending','En attente'],['approved','Approuvées'],
      ['rejected','Refusées'],['cancelled','Annulées']
    ]){
      const option=el('option','',label);
      option.value=value;filter.append(option);
    }
    filterLabel.append(filter);
    section.insertBefore(filterLabel,body);
    let loading=false;
    async function reload(){
      if(!section.isConnected)return;
      body.replaceChildren(el('p','auth-footnote','Chargement sécurisé…'));
      const gate=await verifiedAdmin(api,userId);
      if(!section.isConnected)return;
      if(!gate.authorized){
        section.hidden=true;body.replaceChildren();
        return;
      }
      const {data,error}=await api.from('role_requests')
        .select('id,user_id,requested_role,team_id,status,requested_at')
        .eq('status',filter.value).order('requested_at',{ascending:true}).limit(60);
      if(!section.isConnected)return;
      body.replaceChildren();
      if(error){
        body.append(el('p','auth-warning','Impossible de vérifier les demandes actuellement.'));
        return;
      }
      if(!data?.length){
        body.append(el('p','auth-footnote','Aucune demande dans cet état.'));
        return;
      }
      for(const request of data){
        const card=el('article','admin-role-request-card');
        const team=teams.find(t=>t.id===request.team_id);
        card.append(el('strong','',ROLE_LABEL[request.requested_role]||'Rôle'),
          el('p','admin-role-identity','Identifiant du membre : '+request.user_id));
        if(team)card.append(el('p','', 'Équipe concernée : '+team.name));
        else if(request.team_id)card.append(el('p','', 'Équipe : '+request.team_id));
        card.append(el('p','admin-role-state',STATUS_LABEL[request.status]||'À vérifier'));
        if(request.status==='pending'){
          if(request.user_id===userId){
            card.append(el('p','auth-warning','Tu ne peux pas approuver ta propre demande.'));
          } else {
            const reasonLabel=el('label','staff-label','Motif de décision (facultatif, 300 caractères max.)');
            const reason=el('textarea','staff-input');
            reason.rows=2;reason.maxLength=300;
            reasonLabel.append(reason);
            const confirmation=el('p','admin-role-confirm');
            confirmation.setAttribute('role','status');
            const buttons=el('div','admin-role-actions');
            const approve=actionButton('Approuver','staff-action');
            const reject=actionButton('Refuser','cc-reset');
            let selected=null;
            async function decide(approval){
              if(loading||!section.isConnected)return;
              if(!mayDecideRequest(userId,request))return;
              const intent=approval?'approve':'reject';
              if(selected!==intent){
                selected=intent;
                confirmation.textContent=moderateMessage(approval);
                approve.textContent=intent==='approve'?'Confirmer l’approbation':'Approuver';
                reject.textContent=intent==='reject'?'Confirmer le refus':'Refuser';
                return;
              }
              selected=null;loading=true;
              approve.disabled=true;reject.disabled=true;
              confirmation.textContent='Vérification de la session et enregistrement…';
              const gate=await verifiedAdmin(api,userId);
              if(!section.isConnected)return;
              if(!gate.authorized){
                confirmation.textContent='Session administrateur ou MFA non valide. Action annulée.';
                section.hidden=true;
                return;
              }
              const {error}=await api.rpc('admin_decide_role_request',{
                p_request_id:request.id,p_approve:approval,
                p_reason:reason.value.trim()||null
              });
              if(!section.isConnected)return;
              if(error){
                loading=false;approve.disabled=false;reject.disabled=false;
                approve.textContent='Approuver';reject.textContent='Refuser';
                confirmation.textContent='Décision refusée ou demande déjà traitée. Recharge les demandes.';
                return;
              }
              loading=false;
              status.textContent='Décision enregistrée et contrôlée par Supabase.';
              await reload();
            }
            approve.addEventListener('click',()=>void decide(true));
            reject.addEventListener('click',()=>void decide(false));
            buttons.append(approve,reject);
            card.append(reasonLabel,buttons,confirmation);
          }
        }
        body.append(card);
      }
    }
    filter.addEventListener('change',()=>void reload());
    await reload();
  }catch{
    if(section.isConnected){
      status.textContent='Service de validation indisponible pour le moment.';
      body.replaceChildren();
    }
  }
}
