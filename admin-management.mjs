/** Real management screens. Every mutation is an existing audited, MFA-gated Supabase RPC.
 * No fabricated fixtures, articles, payments or fake local preview state.
 */
import {adminSessionStatus} from './admin-security.mjs';
import {mountAdminLeagueEditor} from './admin-league.mjs';
import {mountAdminMatchCompetition} from './admin-match-competition.mjs';
import {previewAuthorizedFffFeed,FFF_CLUB_AFFILIATION,FFF_PUBLIC_PORTAL} from './fff-provider.mjs';
import {reviewAuthorizedFffImport,prepareFffManualDraft,FFF_REVIEW_LABELS} from './fff-import-reconciliation.mjs';
import {CLUB_TEAMS} from './club-teams.mjs';
import {publicExternalFixtures} from './external-match-previews.mjs';
import {validateSeasonDraft,validateMatchDraft,validateNewsDraft,adminSaveErrorMessage} from './admin-editor-rules.mjs';
import {SEASON_STATE_LABELS} from './season-lifecycle-rules.mjs';
import {mountAdminSeasonRollover} from './admin-season-rollover.mjs';
import {eventDateInput,validateFreeEventDraft,eventRpcArgs} from './admin-event-rules.mjs';

const el=(tag,cls='',value=null)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==null)n.textContent=String(value);return n;};
const option=(value,label)=>{const x=el('option','',label);x.value=value;return x;};
const field=(title,node)=>{const label=el('label','admin-form-field',title);label.append(node);return label;};
const input=(type='text')=>{const n=el('input','admin-form-control');n.type=type;return n;};
const textarea=()=>{const n=el('textarea','admin-form-control');n.rows=5;return n;};
const select=items=>{const n=el('select','admin-form-control');for(const [value,name] of items)n.append(option(value,name));return n;};
const check=label=>{const n=input('checkbox');return {n,label:field(label,n)};};
const btn=(name)=>{const n=el('button','admin-primary-btn',name);n.type='submit';return n;};
const teamsKnown=teams=>teams.filter(t=>CLUB_TEAMS.some(c=>c.code===t.code));
async function guarded(api,userId){
 const check=await adminSessionStatus(api,userId);
 return check.status==='admin';
}
function shell(root,title){
 root.replaceChildren();
 root.append(el('h2','',title));
 const message=el('p','admin-workflow-status','Chargement sécurisé…');message.setAttribute('role','status');
 const list=el('select','admin-form-control');
 list.setAttribute('aria-label','Document à modifier');
 const form=el('form','admin-operation-form');
 const refresh=el('button','admin-secondary-btn','Actualiser les dossiers');refresh.type='button';
 const actions=el('div','admin-editor-list-actions');actions.append(refresh);
 root.append(message,field('Sélectionner un dossier existant ou créer un nouveau',list),actions,form);
 return {message,list,form,refresh};
}
const indexSelect=(selectNode,rows,display,preferred=null)=>{
 selectNode.replaceChildren(option('new','+ Créer un nouveau dossier'));
 for(const record of rows)selectNode.append(option(record.id,display(record)));
 selectNode.value=rows.some(r=>r.id===preferred)?preferred:'new';
};
function editor(root,title,api,userId,{rpcList,rpcSave,fields,validate,args,preview,display}){
 const UI=shell(root,title);
 const form=UI.form;
 const controls=fields();
 for(const [name,control] of Object.entries(controls)){
  if(name.startsWith('_'))continue;
  if(control?.label && control.n)form.append(control.label);
  else if(control?.element)form.append(control.element);
 }
 const action=btn('Enregistrer les modifications');form.append(action);
 let docs=[],confirmKey=null,busy=false;
 const selected=()=>docs.find(x=>x.id===UI.list.value)||null;
 const reset=()=>{
  const item=selected();
  for(const [k,value] of Object.entries(controls)){
   if(k.startsWith('_'))continue;
   if(value?.fill)value.fill(item);
  }
  confirmKey=null;
  UI.message.textContent=item?'Dossier chargé. Vérifie avant d’enregistrer.':'Nouveau brouillon. Aucun contenu créé.';
 };
 async function reload(focus=null){
  if(!root.isConnected)return;
  if(!await guarded(api,userId)){UI.message.textContent='Accès administrateur MFA perdu.';action.disabled=true;return;}
  const result=await api.rpc(rpcList);
  if(!root.isConnected)return;
  if(result.error||!Array.isArray(result.data)){
   UI.message.textContent='Impossible de charger les dossiers ; aucune action possible.';
   action.disabled=true;return;
  }
  docs=result.data;
  indexSelect(UI.list,docs,display,focus);
  action.disabled=false;reset();
 }
 UI.list.addEventListener('change',reset);
 UI.refresh.addEventListener('click',async()=>{
  if(busy||UI.refresh.disabled)return;
  UI.refresh.disabled=true;
  const keep=selected()?.id||null;
  try{await reload(keep);}catch{if(root.isConnected)UI.message.textContent='Impossible d’actualiser. Réessaie plus tard.';}
  finally{UI.refresh.disabled=false;}
 });
 form.addEventListener('input',()=>{confirmKey=null;});
 form.addEventListener('change',()=>{confirmKey=null;});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||action.disabled||!root.isConnected)return;
  const row=selected(),data=preview(controls,row);
  const problem=validate(data,row);
  if(problem){UI.message.textContent=problem;return;}
  const payload=args(data,row);
  const requiresConfirmation=data.publish===true||row?.published===true||row?.status==='published'||['active','completed','archived'].includes(row?.state)||['active','completed','archived'].includes(data.state);
  const key=JSON.stringify(payload);
  if(requiresConfirmation&&key!==confirmKey){
   confirmKey=key;UI.message.textContent='Action sensible : vérifie les informations puis clique de nouveau pour confirmer l’enregistrement.';
   return;
  }
  busy=true;action.disabled=true;confirmKey=null;
  UI.message.textContent='Vérification MFA et enregistrement serveur…';
  try{
   if(!await guarded(api,userId)){UI.message.textContent='La session administrateur a expiré.';return;}
   if(!root.isConnected)return;
   const result=await api.rpc(rpcSave,payload);
   if(!root.isConnected)return;
   if(result.error){UI.message.textContent=adminSaveErrorMessage(result.error);return;}
   await reload(result.data);
   if(root.isConnected)UI.message.textContent='Dossier enregistré par Supabase. La publication dépend de ses droits et contrôles serveur.';
  }catch{if(root.isConnected)UI.message.textContent='Service temporairement indisponible. Aucun enregistrement confirmé.';}
  finally{busy=false;if(action.isConnected)action.disabled=false;}
 });
 void reload();
}
function textField(label,type='text',initial=''){
 const n=input(type);n.value=initial;
 return {element:field(label,n),fill:row=>{n.value=String(row?.[label]??initial);},n};
}
export function mountAdminSeasons(root,api,userId){
 const label=input();label.placeholder='2026/2027';label.maxLength=9;
 const state=select(Object.entries(SEASON_STATE_LABELS));
 const start=input('date'),end=input('date');
 const get=(k)=>(row)=>row?.[k]??'';
 editor(root,'Saisons du club',api,userId,{
  rpcList:'admin_list_management_seasons',rpcSave:'admin_save_season',
  fields:()=>({
   label:{element:field('Saison (AAAA/AAAA)',label),fill:row=>label.value=get('label')(row)},
   state:{element:field('État',state),fill:row=>state.value=row?.state||'planned'},
   start:{element:field('Début',start),fill:row=>start.value=get('starts_on')(row)},
   end:{element:field('Fin',end),fill:row=>end.value=get('ends_on')(row)}
  }),
  preview:()=>({label:label.value.trim(),state:state.value,start:start.value,end:end.value,publish:state.value==='active'}),
  validate:validateSeasonDraft,
  args:(d,row)=>({p_season_id:row?.id||null,p_label:d.label,p_state:d.state,p_starts_on:d.start,p_ends_on:d.end}),
  display:row=>row.label+' · '+(SEASON_STATE_LABELS[row.state]||row.state)
 });
 void mountAdminSeasonRollover(root,api,userId);
}
/** Preview-only: FFF has not provided a public club-feed API authorization.
 * Never fetch old DOFA endpoints, store credentials or write these dates automatically.
 */
/** Stage 96: future authorized FFF JSON is compared only to server-held club
 * records, then optionally prefilled into an UNSAVED manual draft.
 * No FFF remote call, provider access assumption or automatic import.
 */
export function mountFffPreview(root,api,userId,context=null){
 const panel=el('details','admin-fff-preview');
 const heading=el('summary','','Connecteur FFF — revue et saisie manuelle (accès officiel requis)');
 const info=el('p','admin-fff-info','Club FFF n° '+FFF_CLUB_AFFILIATION+
  ' · Aucun accès API FFF configuré. Vérifier le droit de réutilisation et le rapprochement de chaque rencontre avant toute saisie. Rien ne sera synchronisé automatiquement.');
 const official=el('a','admin-fff-link','Portail des compétitions FFF ↗');
 official.href=FFF_PUBLIC_PORTAL;official.target='_blank';official.rel='noopener noreferrer';
 const label=el('label','admin-form-field','Export JSON au format partenaire documenté (aperçu local uniquement)');
 const input=el('textarea','admin-form-control');input.rows=6;input.maxLength=150000;
 input.placeholder='Coller uniquement un export autorisé, sans données privées ni jeton';
 label.append(input);
 const authz=check('Je confirme avoir vérifié une autorisation FFF écrite applicable à cet export et les droits de réutilisation (ce contrôle ne prouve pas l’autorisation).');
 const run=el('button','admin-secondary-btn','Comparer le flux aux rencontres du club');
 run.type='button';
 const status=el('p','admin-workflow-status','Aucun accès API FFF configuré. Aucun match importé.');
 status.setAttribute('role','status');
 const selector=select([['','Choisir une rencontre à examiner']]);
 selector.setAttribute('aria-label','Rencontre FFF en examen');selector.disabled=true;
 const detail=el('p','admin-workflow-status');
 const source=el('a','admin-fff-link','Examiner la référence FFF ↗');
 source.target='_blank';source.rel='noopener noreferrer';source.hidden=true;
 const draft=el('button','admin-secondary-btn','Pré-remplir le formulaire manuel (sans publier)');
 draft.type='button';draft.disabled=true;
 const fallback=el('p','admin-fff-info','Sans contrat de flux : saisie manuelle et revue des matchs du club restent entièrement disponibles. Les résultats issus du flux ne sont jamais repris automatiquement comme résultats homologués.');
 panel.append(heading,info,official,label,authz.label,run,status,
  field('Rencontre à vérifier',selector),detail,source,draft,fallback);
 root.append(panel);
 let report=null,sourceVersion='',busy=false;
 const clear=()=>{
  report=null;sourceVersion='';
  selector.replaceChildren(option('','Choisir une rencontre à examiner'));
  selector.disabled=true;draft.disabled=true;source.hidden=true;detail.textContent='';
 };
 function showSelection(){
  const index=Number(selector.value);
  const record=report?.records[index];
  source.hidden=!record;draft.disabled=true;
  if(!record){detail.textContent='Aucune rencontre sélectionnée.';return;}
  source.href=record.source_reference;
  detail.textContent=record.localDay+' · '+record.opponent_name+' · '+
   (FFF_REVIEW_LABELS[record.review_status]||'À revoir')+
   ' · '+record.match_status+
   (record.match_status==='played'?' · score du flux NON homologué':'')+
   '. Aucune donnée enregistrée.';
  draft.disabled=record.review_status!=='available'||!context;
 }
 selector.addEventListener('change',showSelection);
 input.addEventListener('input',clear);
 authz.n.addEventListener('change',()=>{
  if(!authz.n.checked)clear();
 });
 run.addEventListener('click',async()=>{
  clear();if(busy||!root.isConnected)return;
  busy=true;run.disabled=true;
  try{
   if(!await guarded(api,userId)){
    status.textContent='Session administrateur MFA AAL2 requise.';return;
   }
   if(!authz.n.checked){
    status.textContent='La vérification préalable des droits de réutilisation est requise. Aucune requête FFF effectuée.';return;
   }
   const parsed=JSON.parse(input.value);
   // Fail closed if any secured club catalogue is unavailable or truncated.
   const [teamsReply,matchesReply]=await Promise.all([
    api.from('club_teams').select('id,code,name'),
    api.rpc('admin_list_management_matches')
   ]);
   if(!root.isConnected)return;
   if(teamsReply.error||matchesReply.error||
    !Array.isArray(teamsReply.data)||!Array.isArray(matchesReply.data))
    throw Error('Inventory unavailable');
   const next=reviewAuthorizedFffImport(parsed,teamsReply.data,matchesReply.data);
   report=next;sourceVersion=input.value;
   for(let i=0;i<next.records.length;i++){
    const row=next.records[i],description=row.team_code.toUpperCase()+' · '+
     row.localDay+' · '+row.opponent_name+' · '+FFF_REVIEW_LABELS[row.review_status];
    selector.append(option(String(i),description));
   }
   selector.disabled=next.records.length===0;
   status.textContent=next.records.length+' rencontre(s) analysée(s) · '+
    next.counts.available+' sans dossier concurrent · '+
    next.counts.already_recorded+' déjà saisie(s) · '+
    (next.counts.conflict+next.counts.ambiguous)+' conflit(s) / ambiguïté(s). '+
    'Aucune donnée enregistrée, aucune autorisation de flux présumée.';
   if(next.records.length){
    selector.value='0';showSelection();
   }
  }catch{
   clear();
   status.textContent='Flux ou inventaire refusé : club, dates, droits, réseau ou doublons à vérifier. Aucune rencontre modifiée.';
  }finally{busy=false;run.disabled=false;}
 });
 draft.addEventListener('click',async()=>{
  if(busy||draft.disabled||!root.isConnected||!authz.n.checked)return;
  busy=true;draft.disabled=true;
  try{
   if(!await guarded(api,userId))throw Error('MFA');
   if(input.value!==sourceVersion||!report)throw Error('Input changed');
   const record=report.records[Number(selector.value)];
   const local=prepareFffManualDraft(record);
   // Re-read the private club inventory immediately before touching the editor.
   const latest=await api.rpc('admin_list_management_matches');
   if(latest.error||!Array.isArray(latest.data)||
     !Array.isArray(context?.teams))throw Error('Inventory unavailable');
   const check=reviewAuthorizedFffImport(
    JSON.parse(sourceVersion),context.teams,latest.data);
   const current=check.records.find(r=>r.external_id===record.external_id);
   if(!current||current.review_status!=='available'||current.team_id!==local.team_id)
    throw Error('Conflict emerged');
   if(!root.isConnected||!context?.fields)throw Error('Editor unavailable');
   const dossier=root.querySelector('select[aria-label="Document à modifier"]');
   if(!dossier)throw Error('Editor unavailable');
   const fields=context.fields;
   dossier.value='new';dossier.dispatchEvent(new Event('change',{bubbles:true}));
   fields.team.value=local.team_id;
   fields.opponent.value=local.opponent_name;
   fields.date.value=local.scheduled_local;
   fields.venue.value=local.venue||'';
   fields.home.n.checked=local.is_home;
   fields.state.value=local.match_status;
   fields.state.dispatchEvent(new Event('change',{bubbles:true}));
   fields.hScore.value='';fields.aScore.value='';
   fields.competitionKind.value='unspecified';fields.competitionLabel.value='';
   fields.publish.n.checked=false;
   status.textContent='Nouveau brouillon manuel pré-rempli SANS enregistrement ni publication. Vérifiez et classez la compétition, le statut et le score auprès du club ; puis utilisez son bouton Enregistrer.';
   root.querySelector('.admin-operation-form')?.scrollIntoView({
    behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',
    block:'start'});
  }catch{
   status.textContent='Pré-remplissage annulé : session, droits, correspondance ou dossier du club modifié. Aucun import réalisé.';
  }finally{busy=false;showSelection();}
 });
}
export function mountAdminMatches(root,api,userId){
 let teams=[],seasons=[];
 const team=select([]),season=select([['','Aucune saison']]),opponent=input();
 opponent.maxLength=120;
 const date=input('datetime-local'),venue=input();venue.maxLength=160;
 const home=check('Match à domicile'),state=select([['scheduled','Programmé'],['played','Joué'],['postponed','Reporté'],['cancelled','Annulé']]);
 const hScore=input('number'),aScore=input('number');
 for(const n of [hScore,aScore]){n.min=0;n.max=99;n.step=1;}
 const publish=check('Publier la rencontre sur le site');
 const competitionKind=select([['unspecified','À classifier (brouillon uniquement)'],['league','Championnat'],['cup','Coupe'],['friendly','Match amical']]);
 competitionKind.setAttribute('aria-label','Type de compétition du match');
 const competitionLabel=input();competitionLabel.maxLength=100;
 competitionLabel.placeholder='Nom du championnat ou de la coupe';
 function loadOptions(){
  return Promise.all([api.from('club_teams').select('id,code,name'),api.rpc('admin_list_management_seasons')])
   .then(([tr,sr])=>{
    if(tr.error||sr.error)throw Error('Options unavailable');
    teams=teamsKnown(tr.data||[]);seasons=sr.data||[];
    team.replaceChildren(...teams.map(t=>option(t.id,t.name)));
    season.replaceChildren(option('','Aucune saison'),...seasons.map(s=>option(s.id,s.label)));
   });
 }
 const status=el('p','admin-workflow-status','Lecture du catalogue des équipes…');root.replaceChildren(status);
 void loadOptions().then(()=>{
  if(!root.isConnected)return;
  editor(root,'Calendrier et résultats',api,userId,{
   rpcList:'admin_list_management_matches',rpcSave:'admin_save_classified_match',
   fields:()=>({
    team:{element:field('Équipe',team),fill:r=>team.value=r?.team_id||teams[0]?.id||''},
    season:{element:field('Saison',season),fill:r=>season.value=r?.season_id||''},
    competitionKind:{element:field('Compétition : championnat, coupe ou amical',competitionKind),fill:r=>competitionKind.value=r?.competition_kind||'unspecified'},
    competitionLabel:{element:field('Nom exact de la compétition',competitionLabel),fill:r=>competitionLabel.value=r?.competition_label||''},
    opponent:{element:field('Adversaire',opponent),fill:r=>opponent.value=r?.opponent_name||''},
    date:{element:field('Date et heure locale',date),fill:r=>date.value=r?.scheduled_at?new Date(new Date(r.scheduled_at).getTime()-new Date(r.scheduled_at).getTimezoneOffset()*60000).toISOString().slice(0,16):''},
    venue:{element:field('Stade / lieu',venue),fill:r=>venue.value=r?.venue||''},
    home:{label:home.label,n:home.n,fill:r=>home.n.checked=r?.is_home??true},
    state:{element:field('Statut',state),fill:r=>state.value=r?.match_status||'scheduled'},
    hScore:{element:field('Score domicile (si joué)',hScore),fill:r=>hScore.value=r?.home_score??''},
    aScore:{element:field('Score extérieur (si joué)',aScore),fill:r=>aScore.value=r?.away_score??''},
    publish:{label:publish.label,n:publish.n,fill:r=>publish.n.checked=r?.published===true}
   }),
   preview:()=>({team:team.value,season:season.value,competitionKind:competitionKind.value,
    competitionLabel:competitionLabel.value.trim(),opponent:opponent.value.trim(),
    date:date.value,venue:venue.value.trim(),home:home.n.checked,state:state.value,
    hScore:hScore.value,aScore:aScore.value,publish:publish.n.checked}),
   validate:d=>validateMatchDraft(d,teams,seasons),
   args:(d,row)=>({p_match_id:row?.id||null,p_team_id:d.team,p_season_id:d.season||null,
    p_opponent_name:d.opponent,p_scheduled_at:new Date(d.date).toISOString(),p_venue:d.venue,
    p_is_home:d.home,p_match_status:d.state,p_home_score:d.state==='played'?Number(d.hScore):null,
    p_away_score:d.state==='played'?Number(d.aScore):null,p_source_kind:'manual',
    p_source_reference:null,p_publish:d.publish,p_competition_kind:d.competitionKind,
    p_competition_label:d.competitionLabel||null}),
   display:r=>r.opponent_name+' · '+(r.published?'Publié':'Brouillon')+' · '+(r.competition_kind||'à classifier')+' · '+new Date(r.scheduled_at).toLocaleDateString('fr-FR')
  });
  // Editing a played result is explicit; all other statuses require empty scores.
  state.addEventListener('change',()=>{
   const played=state.value==='played';
   hScore.disabled=!played;aScore.disabled=!played;
   if(!played){hScore.value='';aScore.value='';}
  });
  mountFffPreview(root,api,userId,{
   teams,fields:{team,opponent,date,venue,home,state,hScore,aScore,
    competitionKind,competitionLabel,publish}
  });
  const leaguePanel=el('section','admin-league-panel');
  root.append(leaguePanel);
  void mountAdminLeagueEditor(leaguePanel,api,userId);
  const competitionPanel=el('section','admin-league-panel');
  root.append(competitionPanel);
  void mountAdminMatchCompetition(competitionPanel,api,userId);
  // A sourced result is NOT a club-confirmed match. Administrators must select
  // a new dossier, check its source and then explicitly save/publish via MFA RPC.
  const reviews=publicExternalFixtures({includePast:true,period:'all'});
  const box=el('details','admin-fff-preview admin-match-reviews');
  const label=el('summary','','Préparer la validation des matchs sourcés (aucun import automatique)');
  const info=el('p','admin-fff-info',
    'Sélectionne une rencontre de SportCorico, consulte sa source puis vérifie chaque champ. '
    +'Une date historique sans heure doit être complétée manuellement. Aucun match ne sera publié ici.');
  const selector=select(reviews.map((m,i)=>[String(i),m.team_name+' · '+m.localDay+' · '+m.opponent]));
  selector.setAttribute('aria-label','Choisir un match sourcé à vérifier');
  const link=el('a','admin-fff-link','Ouvrir la source du match ↗');
  link.target='_blank';link.rel='noopener noreferrer';
  const setLink=()=>{link.href=reviews[Number(selector.value)]?.source||'https://www.sportcorico.com/clubs/boissy-uj';};
  selector.addEventListener('change',setLink);setLink();
  const review=el('button','admin-secondary-btn','Pré-remplir un nouveau match sans le publier');
  review.type='button';
  const note=el('p','admin-workflow-status','Validation par un administrateur MFA requise avant publication.');
  note.setAttribute('role','status');
  review.addEventListener('click',async()=>{
    if(!root.isConnected)return;
    review.disabled=true;
    try{
      if(!await guarded(api,userId)){note.textContent='Administration MFA AAL2 requise.';return;}
      const fixture=reviews[Number(selector.value)];
      const known=teams.find(t=>t.code===fixture?.team_code);
      const dossier=root.querySelector('select[aria-label="Document à modifier"]');
      if(!fixture||!known||!dossier){note.textContent='Équipe ou éditeur indisponible.';return;}
      dossier.value='new';
      dossier.dispatchEvent(new Event('change',{bubbles:true}));
      team.value=known.id;
      opponent.value=fixture.opponent;
      const timestamp=new Date(fixture.time);
      date.value=fixture.dateOnly?'':new Intl.DateTimeFormat('sv-SE',{
        timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',
        hour:'2-digit',minute:'2-digit',hourCycle:'h23'
      }).format(timestamp).replace(' ','T');
      venue.value='';
      home.n.checked=fixture.is_home;
      state.value=fixture.status==='played'?'played':'scheduled';
      hScore.value=fixture.status==='played'?String(fixture.home_score):'';
      aScore.value=fixture.status==='played'?String(fixture.away_score):'';
      publish.n.checked=false;
      note.textContent=fixture.dateOnly
        ?'Brouillon rempli sauf l’heure exacte, à confirmer. Compare la source, complète la date et enregistre après revue.'
        :'Brouillon pré-rempli, non enregistré. Vérifie la source, l’équipe et le score, puis utilise Enregistrer les modifications.';
      root.querySelector('.admin-operation-form')?.scrollIntoView({behavior:'smooth',block:'start'});
    }catch{note.textContent='Le pré-remplissage n’a pas abouti ; aucune rencontre enregistrée.';}
    finally{review.disabled=false;}
  });
  box.append(label,info,selector,link,review,note);
  root.append(box);
 }).catch(()=>{if(root.isConnected)status.textContent='Impossible de charger les équipes et saisons. Aucun match modifié.';});
}
export function mountAdminNews(root,api,userId){
 const team=select([]),title=input(),excerpt=textarea(),body=textarea();
 title.maxLength=180;excerpt.maxLength=400;body.maxLength=20000;body.rows=10;
 const rights=check('Je confirme les autorisations et droits de publication nécessaires');
 const publish=check('Publier maintenant');
 let teams=[];
 const status=el('p','admin-workflow-status','Chargement des équipes…');root.replaceChildren(status);
 void api.from('club_teams').select('id,code,name').then(res=>{
  if(!root.isConnected)return;
  if(res.error)throw new Error('teams unavailable');
  teams=teamsKnown(res.data||[]);
  team.replaceChildren(option('','Actualité générale du club'),...teams.map(t=>option(t.id,t.name)));
  editor(root,'Articles et actualités · sauvegarde avec contrôle de version',api,userId,{
   rpcList:'admin_list_management_news',rpcSave:'admin_save_news_article_checked',
   fields:()=>({
    team:{element:field('Équipe ou club entier',team),fill:r=>team.value=r?.team_id??''},
    title:{element:field('Titre',title),fill:r=>title.value=r?.title||''},
    excerpt:{element:field('Résumé',excerpt),fill:r=>excerpt.value=r?.excerpt||''},
    body:{element:field('Article',body),fill:r=>body.value=r?.body||''},
    rights:{label:rights.label,n:rights.n,fill:r=>rights.n.checked=false},
    publish:{label:publish.label,n:publish.n,fill:r=>publish.n.checked=r?.status==='published'}
   }),
   preview:()=>({team:team.value,title:title.value.trim(),excerpt:excerpt.value.trim(),
    body:body.value.trim(),rights:rights.n.checked,publish:publish.n.checked}),
   validate:d=>validateNewsDraft(d,teams),
   args:(d,row)=>({p_post_id:row?.id||null,p_team_id:d.team||null,p_title:d.title,
    p_excerpt:d.excerpt,p_body:d.body,p_publish:d.publish,p_rights_confirmed:d.rights,
    p_expected_updated_at:row?.updated_at||null}),
   display:r=>r.title+' · '+(r.status==='published'?'Publié':'Brouillon')
  });
 }).catch(()=>{if(root.isConnected)status.textContent='Catalogue des équipes indisponible. Aucune actualité modifiée.';});
}

/** No ticket sales, no payments and no premium access are enabled by this form. */
export function mountAdminFreeEvents(root,api,userId){
 const title=input(),description=textarea(),category=select([
  ['club','Vie du club'],['sport','Sport'],['community','Communauté'],['other','Autre']
 ]);
 title.maxLength=150;description.maxLength=4000;description.rows=7;
 const start=input('datetime-local'),end=input('datetime-local'),
  location=input(),capacity=input('number'),publish=check('Publier cet événement gratuit');
 location.maxLength=160;capacity.min='1';capacity.max='100000';capacity.step='1';
 editor(root,'Événements gratuits',api,userId,{
  rpcList:'admin_list_free_events',rpcSave:'admin_save_free_event',
  fields:()=>({
   title:{element:field('Nom de l’événement',title),fill:r=>title.value=r?.title||''},
   description:{element:field('Description',description),fill:r=>description.value=r?.description||''},
   category:{element:field('Catégorie',category),fill:r=>category.value=r?.category||'club'},
   start:{element:field('Début',start),fill:r=>start.value=eventDateInput(r?.starts_at)},
   end:{element:field('Fin',end),fill:r=>end.value=eventDateInput(r?.ends_at)},
   location:{element:field('Lieu (facultatif)',location),fill:r=>location.value=r?.location_label||''},
   capacity:{element:field('Capacité (facultative)',capacity),fill:r=>capacity.value=r?.capacity??''},
   publish:{label:publish.label,n:publish.n,fill:r=>publish.n.checked=r?.published===true}
  }),
  preview:()=>({
   title:title.value.trim(),description:description.value,category:category.value,
   start:start.value,end:end.value,location:location.value.trim(),capacity:capacity.value,
   publish:publish.n.checked
  }),
  validate:validateFreeEventDraft,
  args:eventRpcArgs,
  display:r=>r.title+' · '+(r.published?'Publié':'Brouillon')+
   (r.starts_at?' · '+new Date(r.starts_at).toLocaleDateString('fr-FR'):' · Date à préciser')
 });
}
