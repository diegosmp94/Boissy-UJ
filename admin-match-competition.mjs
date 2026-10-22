/** Administrators can explicitly classify a fixture without altering its score.
 * AAL2 session check and doubled save are additional to the server-side gate.
 */
import {adminSessionStatus} from './admin-security.mjs';
import {SEASON_2026_COMPETITIONS} from './competition-tabs.mjs';
const element=(tag,cls='',t=null)=>{const n=document.createElement(tag);
 if(cls)n.className=cls;if(t!==null)n.textContent=String(t);return n;};
const option=(val,name)=>{const o=element('option','',name);o.value=val;return o;};
export async function mountAdminMatchCompetition(root,api,userId){
 root.replaceChildren(element('h2','','Classement des rencontres : championnat ou coupe'));
 const status=element('p','admin-workflow-status','Vérification des droits…');
 status.setAttribute('role','status');root.append(status);
 const verified=await adminSessionStatus(api,userId);
 if(!root.isConnected)return;
 if(verified.status!=='admin'){
  status.textContent='Administrateur MFA AAL2 requis.';return;
 }
 const [matchesResp,teamsResp]=await Promise.all([
  api.rpc('admin_list_management_matches'),
  api.from('club_teams').select('id,code,name')
 ]);
 if(!root.isConnected)return;
 if(matchesResp.error||teamsResp.error||!Array.isArray(matchesResp.data)||!Array.isArray(teamsResp.data)){
  status.textContent='Impossible de charger les matchs ou équipes à classifier.';return;
 }
 const matches=matchesResp.data.slice().sort((a,b)=>Date.parse(b.scheduled_at)-Date.parse(a.scheduled_at));
 if(!matches.length){
  status.textContent='Aucun match saisi dans le catalogue du club. Dès qu’une rencontre sera enregistrée, sa compétition pourra être choisie ici.';return;
 }
 const teamById=new Map(teamsResp.data.map(t=>[t.id,t]));
 const form=element('form','admin-competition-form');
 const chooser=element('select','admin-form-control');
 chooser.setAttribute('aria-label','Rencontre à classifier');
 for(const m of matches){
  const t=teamById.get(m.team_id);
  chooser.append(option(m.id,(t?.name||'Équipe')+' · '+
   new Date(m.scheduled_at).toLocaleDateString('fr-FR',{timeZone:'Europe/Paris'})+' · '+m.opponent_name));
 }
 const category=element('select','admin-form-control');
 category.setAttribute('aria-label','Type de compétition');
 for(const [id,name] of [['league','Championnat'],['cup','Coupe'],['friendly','Amical'],['unspecified','À classifier']]){
  category.append(option(id,name));
 }
 const name=element('input','admin-form-control');name.type='text';name.maxLength=100;
 name.placeholder='Nom exact du championnat ou de la coupe';
 name.setAttribute('aria-label','Nom de compétition');
 const label=(title,control)=>{const x=element('label','admin-form-field',title);x.append(control);return x;};
 const save=element('button','admin-primary-btn','Enregistrer la compétition');
 save.type='submit';
 const tip=element('p','admin-fff-info',
  'Sélectionne le match, indique Coupe ou Championnat, puis le nom exact. '+
  'Les dates et scores ne sont pas modifiés ici. Double confirmation et MFA requis.');
 form.append(label('Rencontre',chooser),label('Type',category),label('Compétition',name),tip,save);root.append(form);
 let confirmKey=null,busy=false;
 const load=()=>{
  const current=matches.find(m=>m.id===chooser.value);
  if(!current)return;
  category.value=current.competition_kind||'unspecified';
  name.value=current.competition_label||'';
  const team=teamById.get(current.team_id);
  const conf=SEASON_2026_COMPETITIONS[team?.code];
  const recommendation=category.value==='cup'?conf?.cup:conf?.league;
  if(!name.value&&recommendation)name.placeholder=recommendation;
  confirmKey=null;status.textContent=current.published?
   'Match publié : modification de classement de compétition sans altérer le résultat.':
   'Match en brouillon : la classification ne publie pas le match.';
 };
 chooser.addEventListener('change',load);
 for(const n of [name,category])n.addEventListener('input',()=>{confirmKey=null;});
 form.addEventListener('submit',async ev=>{
  ev.preventDefault();if(busy||!root.isConnected)return;
  const m=matches.find(x=>x.id===chooser.value);
  const labelValue=name.value.trim();
  if(!m||category.value==='cup'&&labelValue.length<3||
   labelValue.length>100||labelValue&&labelValue.length<3){
   status.textContent='Choisis un match existant et un intitulé de coupe valide.';return;
  }
  const payload={p_match_id:m.id,p_kind:category.value,p_label:labelValue||null};
  const key=JSON.stringify(payload);
  if(confirmKey!==key){
   confirmKey=key;status.textContent='Vérifie la rencontre et la compétition, puis clique de nouveau pour confirmer.';return;
  }
  busy=true;save.disabled=true;confirmKey=null;
  try{
   const rights=await adminSessionStatus(api,userId);
   if(rights.status!=='admin'){status.textContent='Session administrateur MFA expirée.';return;}
   const r=await api.rpc('admin_set_match_competition',payload);
   if(!root.isConnected)return;
   if(r.error){status.textContent='Modification refusée par le serveur. Aucun changement confirmé.';return;}
   m.competition_kind=payload.p_kind;m.competition_label=payload.p_label;
   status.textContent='Compétition enregistrée et journalisée. Le match apparaît dans son onglet si publié.';
  }catch{status.textContent='Erreur réseau. Aucun enregistrement confirmé.';}
  finally{busy=false;if(save.isConnected)save.disabled=false;}
 });
 load();
}
