import {supabaseConfig} from './auth-config.mjs';

export const ADVANCED_ROLES=Object.freeze([
  {id:'player',label:'Joueur',description:'Convocations et espace sportif personnel'},
  {id:'coach',label:'Entraîneur',description:'Droits limités aux équipes approuvées'},
  {id:'admin',label:'Administrateur',description:'Control Center avec MFA AAL2'}
]);
export const ROLE_STATES=Object.freeze({
  pending:'En attente',approved:'Approuvée',rejected:'Refusée',cancelled:'Annulée'
});
const labels=Object.freeze({
  supporter:'Supporter',player:'Joueur',coach:'Entraîneur',admin:'Administrateur'
});
export function roleSummary(roles){
  const distinct=[...new Set(roles.filter(x=>typeof x==='string'&&labels[x]))];
  return distinct.map(x=>labels[x]);
}
export function validateRoleRequest(role,teamId=null){
  if(!ADVANCED_ROLES.some(x=>x.id===role))return {valid:false,reason:'Rôle invalide.'};
  if(role==='coach'&&!teamId)return {valid:false,reason:'Sélectionne une équipe.'};
  if(role!=='coach'&&teamId!==null)return {valid:false,reason:'Une équipe ne peut être choisie que pour le rôle entraîneur.'};
  return {valid:true,reason:''};
}
export function canApproveRoleRequest(adminId,request,hasMfa){
  return Boolean(adminId&&hasMfa===true&&request&&request.status==='pending'
    &&request.user_id!==adminId);
}
const elem=(tag,cls='',text=null)=>{
  const n=document.createElement(tag);
  if(cls)n.className=cls;
  if(text!==null)n.textContent=String(text);
  return n;
};
function describeRoles(roles){
  return roleSummary(roles).join(' · ') || 'Supporter';
}
export function mountRoleManagementPreview(root){
  root.replaceChildren();
  root.append(elem('h2','','Utilisateurs & rôles — circuit de validation'));
  const note=elem('p','cc-role-notice',
    'Prévisualisation uniquement : aucune demande réelle, aucune décision et aucun rôle attribué. Le circuit effectif nécessitera un administrateur distinct avec MFA AAL2.');
  note.setAttribute('role','note');
  root.append(note);
  const groups=elem('div','cc-stats');
  for(const [title,subtitle] of [
    ['1 · Demande','Un membre demande un rôle Joueur, Entraîneur (avec équipe) ou Administrateur.'],
    ['2 · En attente','La demande ne confère aucun accès supplémentaire avant validation.'],
    ['3 · Décision','Un autre administrateur vérifie le dossier et approuve ou refuse avec MFA AAL2.'],
    ['4 · Droits cumulés','Le nouveau rôle s’ajoute aux anciens ; chaque équipe entraîneur est attribuée séparément.']
  ]){
    const block=elem('section','cc-role-step');
    block.append(elem('strong','',title),elem('p','',subtitle));groups.append(block);
  }
  root.append(groups);
  const form=elem('form','staff-form');
  form.noValidate=true;
  const currentLabel=elem('label','staff-label','Rôles déjà détenus — exemple local');
  const current=elem('select','staff-input');
  const samples=[
    ['player','Joueur'],['coach','Entraîneur'],['admin','Administrateur'],
    ['player,coach','Joueur + entraîneur'],['coach,admin','Entraîneur + administrateur']
  ];
  for(const [value,label] of samples){
    const option=elem('option','',label);option.value=value;current.append(option);
  }
  currentLabel.append(current);
  const nextLabel=elem('label','staff-label','Rôle supplémentaire demandé');
  const next=elem('select','staff-input');
  for(const role of ADVANCED_ROLES){
    const option=elem('option','',role.label);option.value=role.id;next.append(option);
  }
  nextLabel.append(next);
  const teamLabel=elem('label','staff-label','Équipe souhaitée (si entraîneur)');
  const team=elem('select','staff-input');
  for(const t of ['Seniors A','Seniors B','Seniors C','Vétérans']){
    const option=elem('option','',t);option.value=t;team.append(option);
  }
  teamLabel.append(team);
  const btn=elem('button','staff-action','Simuler la demande');
  btn.type='submit';
  const output=elem('section','staff-preview');
  output.setAttribute('aria-live','polite');
  function refresh(){teamLabel.hidden=next.value!=='coach';output.replaceChildren();}
  next.addEventListener('change',refresh);
  form.addEventListener('submit',ev=>{
    ev.preventDefault();output.replaceChildren();
    const roles=current.value.split(',');
    if(roles.includes(next.value)){
      output.append(elem('p','','Ce rôle est déjà actif dans cet exemple. Les demandes d’une nouvelle équipe entraîneur seront gérées séparément.'));
      return;
    }
    const add=next.value;
    output.append(elem('span','staff-preview-kicker','SIMULATION · AUCUN ACCÈS ACCORDÉ'),
      elem('strong','','Rôles actuels : '+describeRoles(roles)),
      elem('p','','Demande en attente : '+labels[add]+(add==='coach'?' pour '+team.value:'')),
      elem('p','','Après validation par un autre administrateur avec MFA : '+describeRoles([...roles,add])),
      elem('small','','La validation est illustrative. Aucune donnée n’est envoyée à Supabase.'));
  });
  form.append(currentLabel,nextLabel,teamLabel,btn);
  root.append(form,output);
  refresh();
}

/**
 * Authenticated member component; unused while supabaseConfig.enabled=false.
 * RPC is the sole writer: no direct insert to user_roles or role_requests.
 */
export async function mountMemberRoleRequests(container,api,userId){
  if(!supabaseConfig.enabled||!api||!userId)return;
  const section=elem('section','member-role-requests');
  section.append(elem('h3','','Demander un rôle supplémentaire'));
  const info=elem('p','auth-footnote',
    'Chaque rôle ou affectation entraîneur nécessite une validation d’un administrateur différent avec MFA. Une demande en attente ne donne aucun droit.');
  section.append(info);
  const form=elem('form','staff-form');
  const roleLabel=elem('label','staff-label','Fonction demandée');
  const role=elem('select','staff-input');
  for(const option of ADVANCED_ROLES){
    const o=elem('option','',option.label);o.value=option.id;role.append(o);
  }
  roleLabel.append(role);
  const teamLabel=elem('label','staff-label','Équipe');
  const team=elem('select','staff-input');
  team.setAttribute('aria-label','Équipe demandée pour le rôle entraîneur');
  teamLabel.append(team);
  const submit=elem('button','staff-action','Envoyer la demande');
  submit.type='submit';
  const feedback=elem('p','auth-footnote');
  feedback.setAttribute('role','status');
  const pending=elem('div','member-requests-list');
  pending.setAttribute('aria-live','polite');
  form.append(roleLabel,teamLabel,submit);
  section.append(form,feedback,elem('h4','','Mes demandes'),pending);
  container.append(section);
  let teams=[];
  let disposed=false;
  async function reload(){
    let response;
    try{
      response=await api.from('role_requests')
        .select('id,requested_role,team_id,status,requested_at')
        .eq('user_id',userId).order('requested_at',{ascending:false}).limit(30);
    }catch{
      if(!disposed&&section.isConnected){
        pending.replaceChildren(elem('p','auth-warning','Lecture des demandes indisponible. Réessaie après vérification de ta connexion.'));
      }
      return;
    }
    if(disposed||!section.isConnected)return;
    pending.replaceChildren();
    if(response.error) {
      pending.append(elem('p','auth-warning','Demandes temporairement indisponibles.'));
      return;
    }
    if(!response.data?.length){
      pending.append(elem('p','auth-footnote','Aucune demande déposée.'));return;
    }
    for(const req of response.data){
      const label=labels[req.requested_role]||'Rôle';
      const t=teams.find(x=>x.id===req.team_id);
      const block=elem('div','member-request-row');
      block.append(elem('strong','',label+(t?' · '+t.name:'')),
        elem('span','',ROLE_STATES[req.status]||'À vérifier'));
      pending.append(block);
    }
  }
  try{
    const response=await api.from('club_teams').select('id,name,code').order('sort_order',{ascending:true});
    if(disposed||!section.isConnected)return;
    if(response.error) throw new Error('teams unavailable');
    teams=response.data||[];
    for(const t of teams){const o=elem('option','',t.name);o.value=t.id;team.append(o);}
    function updateRole(){
      teamLabel.hidden=role.value!=='coach';
      submit.disabled=role.value==='coach'&&!teams.length;
    }
    role.addEventListener('change',updateRole);
    updateRole();
    form.addEventListener('submit',async ev=>{
      ev.preventDefault();
      if(submit.disabled)return;
      const requestedRole=role.value;
      const teamId=requestedRole==='coach'?team.value:null;
      const valid=validateRoleRequest(requestedRole,teamId);
      if(!valid.valid){feedback.textContent=valid.reason;return;}
      submit.disabled=true;role.disabled=true;team.disabled=true;
      feedback.textContent='Demande en cours…';
      try{
        // Freeze the user's original request while the network call is pending.
        const {error}=await api.rpc('member_request_role',{
          p_role:requestedRole,p_team_id:teamId
        });
        if(!section.isConnected)return;
        feedback.textContent=error
          ? 'Impossible de déposer cette demande. Vérifie tes rôles ou une éventuelle demande déjà en attente.'
          : 'Demande enregistrée, en attente de validation administrative.';
        if(!error)await reload();
      }catch{
        if(section.isConnected)feedback.textContent='Service indisponible. Aucune demande confirmée, tu peux réessayer.';
      }finally{
        if(section.isConnected){
          role.disabled=false;team.disabled=false;
          updateRole();
        }
      }
    });
    await reload();
  }catch{
    if(!disposed&&section.isConnected)feedback.textContent='Le service des demandes est temporairement indisponible.';
  }
}
