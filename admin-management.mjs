/** Real management screens. Every mutation is an existing audited, MFA-gated Supabase RPC.
 * No fabricated fixtures, articles, payments or fake local preview state.
 */
import {adminSessionStatus} from './admin-security.mjs';
import {CLUB_TEAMS} from './club-teams.mjs';

const el=(tag,cls='',value=null)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==null)n.textContent=String(value);return n;};
const option=(value,label)=>{const x=el('option','',label);x.value=value;return x;};
const field=(title,node)=>{const label=el('label','admin-form-field',title);label.append(node);return label;};
const input=(type='text')=>{const n=el('input','admin-form-control');n.type=type;return n;};
const textarea=()=>{const n=el('textarea','admin-form-control');n.rows=5;return n;};
const select=items=>{const n=el('select','admin-form-control');for(const [value,name] of items)n.append(option(value,name));return n;};
const check=label=>{const n=input('checkbox');return {n,label:field(label,n)};};
const btn=(name)=>{const n=el('button','admin-primary-btn',name);n.type='submit';return n;};
const err=(error)=>error?.code==='42501'
 ?'Action refusée : MFA AAL2 ou rôle administrateur manquant.'
 :'Enregistrement indisponible ou refusé par Supabase. Vérifie la saisie.';
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
 root.append(message,field('Sélectionner un dossier existant ou créer un nouveau',list),form);
 return {message,list,form};
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
 form.addEventListener('input',()=>{confirmKey=null;});
 form.addEventListener('change',()=>{confirmKey=null;});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||action.disabled||!root.isConnected)return;
  const row=selected(),data=preview(controls,row);
  const problem=validate(data,row);
  if(problem){UI.message.textContent=problem;return;}
  const payload=args(data,row);
  const requiresConfirmation=data.publish===true||row?.published===true||row?.status==='published'||row?.state==='active';
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
   if(result.error){UI.message.textContent=err(result.error);return;}
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
 const state=select([['planned','Prévue'],['active','En cours'],['completed','Terminée']]);
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
  validate:d=>!/^20\d{2}\/20\d{2}$/.test(d.label)||Number(d.label.slice(5))!==Number(d.label.slice(0,4))+1
   ?'Format de saison attendu : 2026/2027.'
   :!d.start||!d.end||d.end<=d.start?'Indique une période de saison valide.'
   :Number(d.start.slice(0,4))!==Number(d.label.slice(0,4))||Number(d.end.slice(0,4))!==Number(d.label.slice(5))
    ?'Les dates doivent correspondre aux années de la saison.':null,
  args:(d,row)=>({p_season_id:row?.id||null,p_label:d.label,p_state:d.state,p_starts_on:d.start,p_ends_on:d.end}),
  display:row=>row.label+' · '+row.state
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
   rpcList:'admin_list_management_matches',rpcSave:'staff_save_match',
   fields:()=>({
    team:{element:field('Équipe',team),fill:r=>team.value=r?.team_id||teams[0]?.id||''},
    season:{element:field('Saison',season),fill:r=>season.value=r?.season_id||''},
    opponent:{element:field('Adversaire',opponent),fill:r=>opponent.value=r?.opponent_name||''},
    date:{element:field('Date et heure locale',date),fill:r=>date.value=r?.scheduled_at?new Date(new Date(r.scheduled_at).getTime()-new Date(r.scheduled_at).getTimezoneOffset()*60000).toISOString().slice(0,16):''},
    venue:{element:field('Stade / lieu',venue),fill:r=>venue.value=r?.venue||''},
    home:{label:home.label,n:home.n,fill:r=>home.n.checked=r?.is_home??true},
    state:{element:field('Statut',state),fill:r=>state.value=r?.match_status||'scheduled'},
    hScore:{element:field('Score domicile (si joué)',hScore),fill:r=>hScore.value=r?.home_score??''},
    aScore:{element:field('Score extérieur (si joué)',aScore),fill:r=>aScore.value=r?.away_score??''},
    publish:{label:publish.label,n:publish.n,fill:r=>publish.n.checked=r?.published===true}
   }),
   preview:()=>({team:team.value,season:season.value,opponent:opponent.value.trim(),
    date:date.value,venue:venue.value.trim(),home:home.n.checked,state:state.value,
    hScore:hScore.value,aScore:aScore.value,publish:publish.n.checked}),
   validate:d=>!teams.some(t=>t.id===d.team)?'Sélectionne une équipe du club.'
    :d.opponent.length<2||d.opponent.length>120?'Indique un adversaire valide.'
    :!d.date||!Number.isFinite(Date.parse(d.date))?'Choisis la date et l’heure du match.'
    :d.state==='played'&&(![d.hScore,d.aScore].every(v=>v!==''&&Number.isInteger(Number(v))&&Number(v)>=0&&Number(v)<=99))
      ?'Pour un match joué, indique deux scores entre 0 et 99.'
    :d.state!=='played'&&(d.hScore!==''||d.aScore!=='')?'Les scores sont réservés aux matchs joués.':null,
   args:(d,row)=>({p_match_id:row?.id||null,p_team_id:d.team,p_season_id:d.season||null,
    p_opponent_name:d.opponent,p_scheduled_at:new Date(d.date).toISOString(),p_venue:d.venue,
    p_is_home:d.home,p_match_status:d.state,p_home_score:d.state==='played'?Number(d.hScore):null,
    p_away_score:d.state==='played'?Number(d.aScore):null,p_source_kind:'manual',
    p_source_reference:null,p_publish:d.publish}),
   display:r=>r.opponent_name+' · '+(r.published?'Publié':'Brouillon')+' · '+new Date(r.scheduled_at).toLocaleDateString('fr-FR')
  });
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
  teams=teamsKnown(res.data||[]);team.replaceChildren(...teams.map(t=>option(t.id,t.name)));
  editor(root,'Articles et actualités',api,userId,{
   rpcList:'admin_list_management_news',rpcSave:'staff_save_news_article',
   fields:()=>({
    team:{element:field('Équipe',team),fill:r=>team.value=r?.team_id||teams[0]?.id||''},
    title:{element:field('Titre',title),fill:r=>title.value=r?.title||''},
    excerpt:{element:field('Résumé',excerpt),fill:r=>excerpt.value=r?.excerpt||''},
    body:{element:field('Article',body),fill:r=>body.value=r?.body||''},
    rights:{label:rights.label,n:rights.n,fill:r=>rights.n.checked=false},
    publish:{label:publish.label,n:publish.n,fill:r=>publish.n.checked=r?.status==='published'}
   }),
   preview:()=>({team:team.value,title:title.value.trim(),excerpt:excerpt.value.trim(),
    body:body.value.trim(),rights:rights.n.checked,publish:publish.n.checked}),
   validate:d=>!teams.some(t=>t.id===d.team)?'Sélectionne une équipe valide.'
     :d.title.length<4||d.title.length>180?'Le titre doit comporter 4 à 180 caractères.'
     :d.excerpt.length>400||d.body.length<1||d.body.length>20000?'Vérifie la longueur du résumé et du texte.'
     :d.publish&&!d.rights?'Une publication exige la vérification des droits et des autorisations.':null,
   args:(d,row)=>({p_post_id:row?.id||null,p_team_id:d.team,p_title:d.title,
    p_excerpt:d.excerpt,p_body:d.body,p_publish:d.publish,p_rights_confirmed:d.rights}),
   display:r=>r.title+' · '+(r.status==='published'?'Publié':'Brouillon')
  });
 }).catch(()=>{if(root.isConnected)status.textContent='Catalogue des équipes indisponible. Aucune actualité modifiée.';});
}
