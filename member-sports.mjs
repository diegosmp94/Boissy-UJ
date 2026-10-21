/** Personal player/coach areas, connected only to existing authenticated Supabase APIs.
 * No member directory, secret keys or unrestricted private queries are exposed.
 */
import {
 PLAYER_RESPONSES,CALLOUT_STATUS,hasSportsRole,canRespondToCallup,
 normalizeCallupRows,scopedCoachTeams,validateCoachMatchDraft,coachDraftRpcArgs,sportsSafeError
} from './member-sports-rules.mjs';

const el=(tag,klass='',message=null)=>{
 const node=document.createElement(tag);
 if(klass)node.className=klass;
 if(message!==null)node.textContent=String(message);
 return node;
};
const button=(label,klass='member-sports-action')=>{
 const b=el('button',klass,label);b.type='button';return b;
};
const notice=(message,klass='member-sports-status')=>{
 const p=el('p',klass,message);
 p.setAttribute('role','status');p.setAttribute('aria-live','polite');
 return p;
};
const label=(text,node)=>{
 const l=el('label','member-sports-field',text);l.append(node);return l;
};
const input=(type='text')=>{
 const n=el('input','member-sports-input');n.type=type;return n;
};
const fmtDate=value=>{
 if(!value||!Number.isFinite(Date.parse(value)))return 'Date à confirmer';
 return new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Paris'})
   .format(new Date(value));
};
async function verifyRole(api,userId,role){
 const identity=await api.auth.getUser();
 if(identity.error||identity.data?.user?.id!==userId)return false;
 const roles=await api.from('user_roles').select('role').eq('user_id',userId);
 return !roles.error&&Array.isArray(roles.data)&&roles.data.some(row=>row.role===role);
}
function empty(view,message){view.replaceChildren(notice(message));}

async function mountPlayerArea(view,api,userId,roles){
 const heading=el('div','member-sports-intro');
 heading.append(el('h3','','Mes convocations'),
  el('p','','Consulte seulement les rencontres auxquelles tu es invité et réponds au club.'));
 const state=notice('Chargement de tes convocations privées…');
 const list=el('div','member-callup-list');
 const refresh=button('Actualiser mes convocations','member-sports-secondary');
 view.append(heading,state,refresh,list);
 let loading=false;
 async function load(){
  if(loading||!view.isConnected)return;
  loading=true;refresh.disabled=true;
  state.textContent='Vérification de la session joueur…';
  try{
   if(!await verifyRole(api,userId,'player')){
    if(view.isConnected)empty(view,'Accès joueur indisponible : rôle joueur non validé ou session expirée.');
    return;
   }
   const result=await api.rpc('player_my_callups');
   if(!view.isConnected)return;
   if(result.error||!Array.isArray(result.data)){
    state.textContent=sportsSafeError(result.error);list.replaceChildren();return;
   }
   const entries=normalizeCallupRows(result.data);
   state.textContent=entries.length+' convocation(s) dans ton espace personnel.';
   list.replaceChildren();
   if(entries.length===0){
    list.append(el('p','member-sports-empty','Aucune convocation pour le moment. Les invitations sont envoyées uniquement par les éducateurs autorisés.'));
    return;
   }
   for(const callup of entries){
    const card=el('article','member-callup-card');
    const info=el('div','member-callup-info');
    info.append(el('span','member-sports-tag',callup.team_name||'Équipe du club'),
     el('h4','',callup.opponent_name),el('p','',fmtDate(callup.scheduled_at)));
    const status=el('span','member-callup-state',CALLOUT_STATUS[callup.response]||'À vérifier');
    info.append(status);card.append(info);
    const actions=el('div','member-callup-actions');
    const responseMessage=notice('','member-callup-feedback');
    for(const choice of PLAYER_RESPONSES){
     const b=button(choice.label,choice.value===callup.response?'member-callup-choice is-selected':'member-callup-choice');
     b.disabled=choice.value===callup.response;
     b.setAttribute('aria-label',choice.label+' pour '+callup.opponent_name);
     b.addEventListener('click',async()=>{
      if(!canRespondToCallup(callup,roles,choice.value)||!view.isConnected)return;
      const buttons=[...actions.querySelectorAll('button')];buttons.forEach(x=>x.disabled=true);
      responseMessage.textContent='Enregistrement de ta réponse…';
      try{
       if(!await verifyRole(api,userId,'player')){
        if(view.isConnected)responseMessage.textContent='Session joueur expirée. Reconnecte-toi.';
        return;
       }
       const result=await api.rpc('player_respond_callup',{
        p_match_id:callup.match_id,p_response:choice.value
       });
       if(!view.isConnected)return;
       if(result.error||result.data!==true){
        responseMessage.textContent=sportsSafeError(result.error);return;
       }
       responseMessage.textContent='Réponse enregistrée par le club.';
       await load();
      }catch{
       if(view.isConnected)responseMessage.textContent='Connexion momentanément indisponible. Aucune réponse confirmée.';
      }finally{
       if(view.isConnected)buttons.forEach(x=>x.disabled=x.textContent===CALLOUT_STATUS[callup.response]);
      }
     });
     actions.append(b);
    }
    card.append(actions,responseMessage);list.append(card);
   }
  }catch{
   if(view.isConnected){state.textContent='Impossible de charger les convocations. Réessaie plus tard.';list.replaceChildren();}
  }finally{loading=false;if(refresh.isConnected)refresh.disabled=false;}
 }
 refresh.addEventListener('click',()=>void load());
 await load();
}

async function mountCoachArea(view,api,userId){
 view.append(el('h3','','Mes équipes encadrées'),
  el('p','member-sports-intro-note','Tu peux préparer une rencontre en brouillon pour une équipe qui t’est officiellement attribuée.'));
 const state=notice('Chargement sécurisé des affectations…');
 const list=el('div','member-coach-team-list');
 const fixtures=el('div','member-coach-fixtures');
 const formRoot=el('div','member-coach-editor');
 view.append(state,list,fixtures,formRoot);
 try{
  if(!await verifyRole(api,userId,'coach')){
   if(view.isConnected)empty(view,'Accès entraîneur indisponible : rôle non validé ou session expirée.');
   return;
  }
  const [assignmentResult,teamResult]=await Promise.all([
   api.from('staff_team_assignments')
    .select('coach_user_id,team_id,active').eq('coach_user_id',userId).eq('active',true).limit(30),
   api.from('club_teams').select('id,code,name,division').order('sort_order',{ascending:true})
  ]);
  if(!view.isConnected)return;
  if(assignmentResult.error||teamResult.error){
   empty(view,'Impossible de vérifier les affectations entraîneur pour le moment.');return;
  }
  const teams=scopedCoachTeams(assignmentResult.data||[],teamResult.data||[],userId);
  if(!teams.length){
   state.textContent='Aucune équipe attribuée. Une validation administrative est nécessaire avant d’accéder aux outils sportifs.';
   return;
  }
  state.textContent=teams.length+' équipe(s) autorisée(s) pour ta session.';
  for(const t of teams){
   const item=el('article','member-coach-team');
   item.append(el('strong','',t.name),el('span','',t.division||'Compétition à confirmer'));list.append(item);
  }
  // Match fixtures are strictly published and public; never attempt to read private drafts.
  const results=await api.from('matches')
    .select('id,team_id,opponent_name,scheduled_at,venue,match_status')
    .in('team_id',teams.map(t=>t.id)).eq('published',true)
    .order('scheduled_at',{ascending:true}).limit(60);
  if(!view.isConnected)return;
  const fixtureTitle=el('h4','','Rencontres publiées de mes équipes');
  fixtures.append(fixtureTitle);
  if(results.error)fixtures.append(notice('Calendrier momentanément indisponible.'));
  else if(!results.data?.length)fixtures.append(el('p','member-sports-empty','Aucune rencontre publiée pour tes équipes.'));
  else for(const m of results.data){
   const t=teams.find(team=>team.id===m.team_id);
   const p=el('article','member-coach-fixture');
   p.append(el('strong','',t?.name||'Équipe du club'),
    el('span','',m.opponent_name+' · '+fmtDate(m.scheduled_at)));
   fixtures.append(p);
  }
  const h=el('h4','','Créer une rencontre en brouillon');
  const explanation=el('p','member-sports-intro-note',
    'Ce formulaire crée une nouvelle rencontre sans publication. L’administrateur pourra ensuite vérifier et publier les informations.');
  const form=el('form','member-coach-draft-form');
  const team=el('select','member-sports-input');
  for(const t of teams){const o=el('option','',t.name);o.value=t.id;team.append(o);}
  const opponent=input(),date=input('datetime-local'),venue=input();
  opponent.maxLength=120;opponent.required=true;
  venue.maxLength=160;date.required=true;
  const home=input('checkbox');home.checked=true;
  const submit=button('Enregistrer le brouillon');submit.type='submit';
  const feedback=notice('');
  form.append(label('Équipe autorisée',team),label('Adversaire',opponent),
    label('Date et heure',date),label('Lieu (facultatif)',venue),
    label('Match à domicile',home),submit,feedback);
  formRoot.append(h,explanation,form);
  let saving=false;
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   if(saving||!view.isConnected)return;
   const values={team:team.value,opponent:opponent.value,date:date.value,
    venue:venue.value,home:home.checked};
   const error=validateCoachMatchDraft(values,teams);
   if(error){feedback.textContent=error;return;}
   saving=true;submit.disabled=true;
   feedback.textContent='Vérification des affectations et préparation du brouillon…';
   try{
    if(!await verifyRole(api,userId,'coach')) {
     if(view.isConnected)feedback.textContent='Session entraîneur ou rôle expiré.';return;
    }
    // Revalidate live team scope just before every write: local tabs cannot grant access.
    const live=await api.from('staff_team_assignments')
      .select('coach_user_id,team_id,active').eq('coach_user_id',userId)
      .eq('team_id',values.team).eq('active',true).limit(1);
    if(!view.isConnected)return;
    if(live.error||!scopedCoachTeams(live.data||[],teams,userId).some(t=>t.id===values.team)){
     feedback.textContent='Affectation de cette équipe non confirmée. Aucun brouillon créé.';return;
    }
    const result=await api.rpc('staff_save_match',coachDraftRpcArgs(values,teams));
    if(!view.isConnected)return;
    if(result.error||!result.data)feedback.textContent=sportsSafeError(result.error);
    else {
     feedback.textContent='Brouillon sauvegardé dans Supabase. Il reste non publié jusqu’à validation du club.';
     opponent.value='';date.value='';venue.value='';
    }
   }catch{
    if(view.isConnected)feedback.textContent='Enregistrement indisponible. Vérifie ta connexion.';
   }finally{saving=false;if(submit.isConnected)submit.disabled=false;}
  });
 }catch{if(view.isConnected)empty(view,'Impossible de vérifier les droits entraîneur. Réessaie plus tard.');}
}

/** Adds contextual tabs only for roles the signed-in user actually owns in user_roles. */
export function mountMemberSports(container,api,userId,roles=[]){
 if(!container?.isConnected||!api||!userId||!Array.isArray(roles))return;
 const contexts=['player','coach','admin'].filter(role=>roles.includes(role));
 if(!contexts.length)return;
 const root=el('section','member-sports-workspace');
 root.setAttribute('aria-label','Espaces liés à mes fonctions');
 const title=el('h3','','Mes espaces');
 const tabs=el('div','member-sports-tabs');
 tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Choisir un contexte');
 const view=el('section','member-sports-panel');view.setAttribute('role','tabpanel');
 root.append(title,tabs,view);container.append(root);
 let active=null;
 const labelByRole={player:'Joueur',coach:'Entraîneur',admin:'Administration'};
 function choose(role){
  if(!root.isConnected||!contexts.includes(role))return;
  active=role;
  for(const tab of tabs.querySelectorAll('button')){
   const selected=tab.dataset.context===role;
   tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
  }
  const content=el('div','member-sports-view');
  view.replaceChildren(content);
  if(role==='player')void mountPlayerArea(content,api,userId,roles);
  if(role==='coach')void mountCoachArea(content,api,userId);
  if(role==='admin'){
   content.append(el('h4','','Administration sécurisée'),
     el('p','member-sports-intro-note','Le rôle administrateur exige une session MFA AAL2 pour accéder aux outils de gestion.'));
   const a=el('a','member-sports-admin-link','Accéder au Centre de gestion →');
   a.href='#/control-center';content.append(a);
  }
 }
 for(const role of contexts){
  const tab=button(labelByRole[role],'member-sports-tab');tab.dataset.context=role;
  tab.setAttribute('role','tab');tab.setAttribute('aria-selected','false');
  tab.addEventListener('click',()=>choose(role));tabs.append(tab);
 }
 choose(contexts[0]);
}
