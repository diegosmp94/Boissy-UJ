/** Scoped private convocations manager. Callup access and mutations are enforced by SQL RPCs. */
import {normalizeCoachFixtures,normalizeCoachRoster,INVITATION_LABELS,invitationArgs,canChangeInvitation}
 from './coach-callups-rules.mjs';
import {normalizeMatchSheet,sheetResponseCounts} from './private-match-sheet-rules.mjs';
const elem=(tag,cls='',value=null)=>{
 const n=document.createElement(tag);if(cls)n.className=cls;
 if(value!==null)n.textContent=String(value);return n;
};
function dropdown(label,items=[]){
 const wrap=elem('label','coach-callups-field',label);
 const select=elem('select','member-sports-input');
 for(const [value,text] of items){const o=elem('option','',text);o.value=value;select.append(o);}
 wrap.append(select);
 return {wrap,select};
}
const status=(message='')=>{const p=elem('p','member-sports-status',message);p.setAttribute('role','status');return p;};
const date=value=>!value||!Number.isFinite(Date.parse(value))?'Date à confirmer':
 new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Paris'}).format(new Date(value));

/** The caller already checked assignments, but every load/write re-verifies identity and scope. */
export async function mountCoachCallups(container,api,userId,teams){
 if(!container?.isConnected||!userId||!api||!Array.isArray(teams)||!teams.length)return;
 const section=elem('section','coach-callups-workspace');
 section.setAttribute('aria-label','Gestion privée des convocations');
 const title=elem('h4','','Convocations de mes équipes');
 const intro=elem('p','member-sports-intro-note',
  'Seuls les joueurs officiellement rattachés à tes équipes peuvent être convoqués. Les réponses restent privées.');
 const feedback=status('Vérification des droits et des rencontres disponibles…');
 const team=dropdown('Équipe autorisée',teams.map(t=>[t.id,t.name]));
 const match=dropdown('Rencontre à préparer');
 const members=elem('div','coach-callups-roster');
 const sheetBtn=elem('button','member-sports-secondary','Afficher la feuille de match privée');
 sheetBtn.type='button';sheetBtn.disabled=true;
 const sheetView=elem('section','coach-callups-sheet');
 sheetView.setAttribute('aria-label','Feuille de match privée des joueurs convoqués');
 sheetView.hidden=true;
 const refresh=elem('button','member-sports-secondary','Actualiser');
 refresh.type='button';refresh.disabled=true;
 section.append(title,intro,feedback,team.wrap,match.wrap,refresh,members,sheetBtn,sheetView);
 container.append(section);
 let requestId=0,busy=false,sheetId=0;
 let currentFixtures=[],currentPlayers=[];
 const valid=async(teamId)=>{
  const u=await api.auth.getUser();
  if(u.error||u.data?.user?.id!==userId)return false;
  const roles=await api.from('user_roles').select('role').eq('user_id',userId);
  if(roles.error||!(roles.data||[]).some(r=>r.role==='coach'))return false;
  const permission=await api.from('staff_team_assignments')
   .select('team_id,active').eq('coach_user_id',userId).eq('team_id',teamId).eq('active',true).limit(1);
  return !permission.error&&permission.data?.some(p=>p.team_id===teamId&&p.active===true);
 };
 const clearSheet=()=>{
  sheetId++;sheetView.replaceChildren();sheetView.hidden=true;
  sheetBtn.disabled=true;sheetBtn.textContent='Afficher la feuille de match privée';
 };
 const clear=()=>{
  clearSheet();members.replaceChildren();currentPlayers=[];
  match.select.replaceChildren();currentFixtures=[];
 };
 const showSheet=async()=>{
  if(busy||!section.isConnected)return;
  if(!sheetView.hidden){clearSheet();sheetBtn.disabled=false;return;}
  const selectedTeam=team.select.value,selectedMatch=match.select.value;
  if(!currentFixtures.some(m=>m.match_id===selectedMatch))return;
  const ticket=++sheetId;
  sheetView.hidden=false;sheetBtn.disabled=true;
  sheetView.replaceChildren(status('Vérification de l’équipe et lecture de la feuille privée…'));
  try{
   if(!await valid(selectedTeam))throw new Error('Scope denied');
   if(ticket!==sheetId||!section.isConnected||team.select.value!==selectedTeam
      ||match.select.value!==selectedMatch)return;
   const result=await api.rpc('staff_list_match_sheet',{p_match_id:selectedMatch});
   if(ticket!==sheetId||!section.isConnected||team.select.value!==selectedTeam
      ||match.select.value!==selectedMatch)return;
   if(result.error||!Array.isArray(result.data))throw new Error('Private sheet unavailable');
   const records=normalizeMatchSheet(result.data);
   const counts=sheetResponseCounts(records);
   sheetView.replaceChildren();
   sheetView.append(elem('h5','','Feuille de match · accès privé'),
    elem('p','member-sports-intro-note',
      records.length+' convoqué(s) · '+counts.confirmed+' présent(s) · '+
      counts.declined+' absent(s) · '+counts.unsure+' incertain(s) · '+
      counts.invited+' réponse(s) attendue(s).'));
   if(!records.length){
    sheetView.append(elem('p','member-sports-empty',
      'Aucun joueur actuellement convoqué pour cette rencontre.'));
   }else{
    const list=elem('ol','coach-match-sheet-list');
    for(const record of records){
     const line=elem('li','coach-match-sheet-player');
     line.append(elem('strong','',record.name),
      elem('span','','N° '+(record.shirt??'—')+' · '+record.position),
      elem('span','',record.responseLabel));
     list.append(line);
    }
    sheetView.append(list);
   }
   sheetBtn.textContent='Masquer la feuille de match privée';
  }catch{
   if(ticket===sheetId&&section.isConnected){
    sheetView.replaceChildren(status(
     'Feuille indisponible : revalide la session et l’affectation avant de réessayer.'));
   }
  }finally{
   if(ticket===sheetId&&section.isConnected)sheetBtn.disabled=false;
  }
 };
 sheetBtn.addEventListener('click',()=>void showSheet());
 const failure=message=>{
  feedback.textContent=message;clear();refresh.disabled=false;
 };
 async function loadRoster(){
  const serial=++requestId;
  clearSheet();members.replaceChildren();currentPlayers=[];
  const selected=match.select.value;
  const m=currentFixtures.find(x=>x.match_id===selected);
  if(!m){feedback.textContent='Sélectionne une rencontre autorisée.';return;}
  feedback.textContent='Lecture sécurisée des joueurs de cette rencontre…';
  refresh.disabled=true;
  try{
   if(!await valid(team.select.value)){
    if(serial===requestId&&section.isConnected)failure('Rôle entraîneur ou attribution de cette équipe non valide.');
    return;
   }
   const result=await api.rpc('staff_list_match_roster',{p_match_id:selected});
   if(serial!==requestId||!section.isConnected)return;
   if(result.error||!Array.isArray(result.data)){
    failure('Liste privée indisponible. Les convocations sont verrouillées jusqu’à activation du backend sécurisé.');return;
   }
   currentPlayers=normalizeCoachRoster(result.data);
   sheetBtn.disabled=false;refresh.disabled=false;
   feedback.textContent=currentPlayers.length+' joueur(s) autorisé(s) pour cette rencontre.';
   if(!currentPlayers.length){
    members.append(elem('p','member-sports-empty',
      'Aucun joueur n’est encore rattaché à cette équipe avec un rôle Joueur validé. Aucune convocation possible.'));
    return;
   }
   for(const p of currentPlayers){
    const item=elem('article','coach-callup-player');
    const info=elem('div','coach-callup-player-info');
    info.append(elem('strong','',p.display_name),
      elem('span','',INVITATION_LABELS[p.callup_response]||'Pas encore convoqué'));
    const invite=canChangeInvitation(p,true);
    const cancel=canChangeInvitation(p,false);
    const action=elem('button','member-sports-secondary',invite?'Inviter':cancel?'Annuler la convocation':'Indisponible');
    action.type='button';action.disabled=!(invite||cancel);
    const resultText=status('');
    let confirm=false;
    action.addEventListener('click',async()=>{
     if(busy||!section.isConnected||!canChangeInvitation(p,invite))return;
     if(!confirm){
      confirm=true;
      action.textContent=invite?'Confirmer l’invitation':'Confirmer l’annulation';
      resultText.textContent='Clique une seconde fois pour confirmer cette opération.';
      return;
     }
     confirm=false;busy=true;action.disabled=true;
     resultText.textContent='Vérification du rôle et de l’équipe…';
     const teamAtClick=team.select.value;
     const listVersion=requestId;
     try{
      if(!await valid(teamAtClick)){
       if(section.isConnected)resultText.textContent='Session ou équipe non autorisée. Action annulée.';
       return;
      }
      if(!section.isConnected||requestId!==listVersion||team.select.value!==teamAtClick
        ||match.select.value!==selected)return;
      const payload=invitationArgs(selected,p,invite);
      const out=await api.rpc('staff_set_callup',payload);
      if(!section.isConnected||requestId!==listVersion||team.select.value!==teamAtClick
         ||selected!==match.select.value)return;
      if(out.error||out.data!==true){
       resultText.textContent='Action refusée ou rencontre modifiée. Actualise le dossier.';
       return;
      }
      resultText.textContent=invite?'Invitation enregistrée.':'Convocation annulée.';
      await loadRoster();
     }catch{
      if(section.isConnected)resultText.textContent='Opération momentanément indisponible. Aucun changement confirmé.';
     }finally{
      busy=false;
      if(action.isConnected){action.disabled=false;action.textContent=invite?'Inviter':'Annuler la convocation';}
     }
    });
    item.append(info,action,resultText);members.append(item);
   }
  }catch{
   if(serial===requestId&&section.isConnected)failure('Impossible de récupérer les convocations pour le moment.');
  }
 }
 async function loadFixtures(){
  const serial=++requestId,selectedTeam=team.select.value;
  feedback.textContent='Chargement des rencontres autorisées…';
  clear();refresh.disabled=true;
  try{
   if(!teams.some(t=>t.id===selectedTeam)||!await valid(selectedTeam)){
    if(serial===requestId&&section.isConnected)failure('Attribution entraîneur non vérifiée.');return;
   }
   const out=await api.rpc('staff_list_squad_fixtures',{p_team_id:selectedTeam});
   if(serial!==requestId||!section.isConnected)return;
   if(out.error||!Array.isArray(out.data)){
    failure('Le module de convocations n’est pas encore activé sur Supabase. Aucun effectif affiché.');return;
   }
   currentFixtures=normalizeCoachFixtures(out.data);
   match.select.replaceChildren();
   for(const m of currentFixtures){
    const o=elem('option','',m.opponent_name+' · '+date(m.scheduled_at)
     +(m.published?' · Publié':' · Brouillon'));
    o.value=m.match_id;match.select.append(o);
   }
   if(!currentFixtures.length){
    feedback.textContent='Aucune rencontre à préparer pour cette équipe. Crée d’abord une rencontre en brouillon.';
    refresh.disabled=false;return;
   }
   await loadRoster();
  }catch{
   if(serial===requestId&&section.isConnected)failure('Vérification des rencontres indisponible.');
  }
 }
 team.select.addEventListener('change',()=>void loadFixtures());
 match.select.addEventListener('change',()=>void loadRoster());
 refresh.addEventListener('click',()=>{if(!busy)void loadFixtures();});
 await loadFixtures();
}
