/** MFA-only admin editor for manually validated complete league tables.
 * Each team has its own competition. Every row is an opponent club, never a person.
 */
import {adminSessionStatus} from './admin-security.mjs';
import {validateStandings,moveRanking,standingComputed} from './league-standings.mjs';
import {CLUB_TEAMS} from './club-teams.mjs';
const el=(tag,cls='',text=null)=>{
 const n=document.createElement(tag);if(cls)n.className=cls;
 if(text!==null)n.textContent=String(text);return n;
};
const opt=(value,text)=>{const o=el('option','',text);o.value=value;return o;};
const blank=()=>({position:1,name:'',played:0,wins:0,draws:0,losses:0,
 goals_for:0,goals_against:0,points_adjustment:0});
export function rankingPayload(entries){
 const rows=entries.map((r,index)=>({...r,position:index+1,
  played:Number(r.wins)+Number(r.draws)+Number(r.losses)}));
 return validateStandings(rows).map(r=>({
  position:r.position,name:r.name,played:r.played,
  wins:Number(r.wins),draws:Number(r.draws),losses:Number(r.losses),
  goals_for:Number(r.goals_for),goals_against:Number(r.goals_against),
  points_adjustment:Number(r.points_adjustment)
 }));
}
export async function mountAdminLeagueEditor(root,api,userId){
 const status=el('p','admin-workflow-status','Vérification du classement et des droits…');
 status.setAttribute('role','status');
 root.replaceChildren(el('h2','','Classements de championnat'),status);
 let rights=await adminSessionStatus(api,userId);
 if(!root.isConnected)return;
 if(rights.status!=='admin'){status.textContent='Accès administrateur MFA AAL2 nécessaire.';return;}
 const [tr,sr,lr]=await Promise.all([
  api.from('club_teams').select('id,code,name,division'),
  api.rpc('admin_list_management_seasons'),api.rpc('admin_list_league_standings')
 ]);
 if(!root.isConnected)return;
 if([tr,sr,lr].some(x=>x.error)||!Array.isArray(tr.data)||
  !Array.isArray(sr.data)||!Array.isArray(lr.data)){
  status.textContent='Classement indisponible : fonction serveur manquante ou session expirée.';return;
 }
 const teams=tr.data.filter(t=>CLUB_TEAMS.some(c=>c.code===t.code));
 const records=lr.data,form=el('form','league-editor-form');
 const teamSel=el('select','admin-form-control');
 for(const t of teams)teamSel.append(opt(t.id,t.name+' · '+t.division));
 const seasonSel=el('select','admin-form-control');
 seasonSel.append(opt('','Sans saison associée'));
 for(const s of sr.data)seasonSel.append(opt(s.id,s.label));
 const matchday=el('input','admin-form-control');
 matchday.type='number';matchday.min='0';matchday.max='80';matchday.step='1';matchday.required=true;
 const publish=el('input','');publish.type='checkbox';
 const field=(name,n)=>{const l=el('label','admin-form-field',name);l.append(n);return l;};
 const controls=el('div','league-editor-controls');
 controls.append(field('Championnat de cette équipe',teamSel),
  field('Saison',seasonSel),field('Journée mise à jour',matchday),
  field('Publier ce classement validé',publish));
 const intro=el('p','admin-fff-info',
  'Les victoires valent 3 points, les nuls 1 point. Les points et la différence de buts se calculent automatiquement. '
  +'Utilise les flèches pour déplacer les clubs après une journée, par exemple en cas de départage ou de sanction. '
  +'La publication exige un administrateur MFA AAL2, une saison réelle et une deuxième confirmation. '
  +'Le classement est un tableau complet saisi et contrôlé par le club : les seuls matchs de Boissy UJ ne suffisent pas à calculer les rangs des autres équipes.');
 const toolbar=el('div','league-editor-toolbar');
 const add=el('button','admin-secondary-btn','Ajouter un club');
 add.type='button';toolbar.append(add);
 const board=el('div','league-editor-rows');
 const save=el('button','admin-primary-btn','Enregistrer la journée');
 save.type='submit';
 form.append(intro,controls,toolbar,board,save);
 root.append(form);
 let rows=[],busy=false,confirmKey=null;
 const writeStatus=message=>{status.textContent=message;};
 const load=()=>{
  const record=records.find(x=>x.team_id===teamSel.value);
  matchday.value=String(record?.matchday??0);
  seasonSel.value=record?.season_id??'';
  publish.checked=record?.published===true;
  rows=Array.isArray(record?.entries)?record.entries.map(x=>({...x})):[];
  confirmKey=null;draw();
  writeStatus(record?'Classement chargé. Vérifie les chiffres avant d’enregistrer.':
    'Aucun classement encore enregistré pour cette équipe. Ajoute les clubs de son championnat.');
 };
 const numbers=[['wins','V'],['draws','N'],['losses','D'],
  ['goals_for','BP'],['goals_against','BC'],['points_adjustment','Ajust.']];
 const draw=()=>{
  board.replaceChildren();
  rows.forEach((row,index)=>{
   const item=el('div','league-editor-row');
   const heading=el('div','league-editor-row-heading');
   heading.append(el('strong','',String(index+1)+'. '+(row.name||'Nouveau club')));
   const up=el('button','admin-secondary-btn','↑'),down=el('button','admin-secondary-btn','↓');
   const remove=el('button','admin-secondary-btn','Retirer');
   for(const b of [up,down,remove])b.type='button';
   up.disabled=index===0;down.disabled=index===rows.length-1;
   up.setAttribute('aria-label','Monter '+(row.name||'ce club'));
   down.setAttribute('aria-label','Descendre '+(row.name||'ce club'));
   up.addEventListener('click',()=>{rows=moveRanking(rows,index,-1);confirmKey=null;draw();});
   down.addEventListener('click',()=>{rows=moveRanking(rows,index,1);confirmKey=null;draw();});
   remove.addEventListener('click',()=>{rows.splice(index,1);confirmKey=null;draw();});
   heading.append(up,down,remove);item.append(heading);
   const name=el('input','admin-form-control');name.type='text';name.maxLength=100;
   name.value=row.name||'';name.placeholder='Nom officiel du club';
   name.setAttribute('aria-label','Club classé '+(index+1));
   name.addEventListener('input',()=>{row.name=name.value;heading.firstChild.textContent=
    String(index+1)+'. '+name.value;confirmKey=null;});
   const fields=el('div','league-editor-stat-fields');
   fields.append(field('Club',name));
   const summary=el('p','league-editor-points');
   const recalc=()=>{
    row.played=Number(row.wins)+Number(row.draws)+Number(row.losses);
    try{const v=standingComputed(row);
     summary.textContent='J : '+v.played+' · Diff. : '+v.goalDifference+' · Points : '+v.points;}
    catch{summary.textContent='Statistiques à corriger.';}
   };
   for(const [key,label] of numbers){
    const n=el('input','admin-form-control');n.type='number';
    n.min=key==='points_adjustment'?'-40':'0';
    n.max=key==='points_adjustment'?'40':key.startsWith('goals_')?'500':'80';
    n.step='1';n.required=true;n.value=String(row[key]??0);
    n.setAttribute('aria-label',label+' '+(index+1));
    n.addEventListener('input',()=>{row[key]=n.value===''?NaN:Number(n.value);confirmKey=null;recalc();});
    fields.append(field(label,n));
   }
   recalc();item.append(fields,summary);board.append(item);
  });
  if(!rows.length)board.append(el('p','league-empty','Aucune équipe saisie. Ajoute les clubs réels du championnat.'));
 };
 add.addEventListener('click',()=>{
  if(rows.length>=24){writeStatus('Maximum 24 clubs par championnat.');return;}
  rows.push({...blank(),position:rows.length+1});confirmKey=null;draw();
 });
 teamSel.addEventListener('change',load);
 for(const control of [seasonSel,matchday,publish])control.addEventListener('change',()=>{confirmKey=null;});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!root.isConnected)return;
  let payload;
  try{
   payload={p_team_id:teamSel.value,p_season_id:seasonSel.value||null,
    p_matchday:Number(matchday.value),p_entries:rankingPayload(rows),p_publish:publish.checked};
   if(!Number.isInteger(payload.p_matchday)||payload.p_matchday<0||payload.p_matchday>80||
      (publish.checked&&rows.length<2))throw Error('Incomplet');
   if(publish.checked&&(!payload.p_season_id||
       teams.find(t=>t.id===payload.p_team_id)?.code==='c')){
    writeStatus('Publication impossible : sélectionne une saison réelle et un championnat (Seniors C joue uniquement des amicaux).');
    return;
   }
  }catch{writeStatus('Classement incomplet : vérifie les noms, chiffres, rangs et au moins deux clubs pour publication.');return;}
  const key=JSON.stringify(payload);
  if(key!==confirmKey){
   confirmKey=key;writeStatus('Vérifie les positions et les statistiques puis clique une deuxième fois sur Enregistrer pour confirmer.');return;
  }
  busy=true;save.disabled=true;confirmKey=null;
  try{
   rights=await adminSessionStatus(api,userId);
   if(rights.status!=='admin'){writeStatus('MFA administrateur à renouveler.');return;}
   const res=await api.rpc('admin_save_league_standings',payload);
   if(!root.isConnected)return;
   if(res.error){writeStatus('Enregistrement refusé par le serveur ; aucun changement confirmé.');return;}
   const existing=records.findIndex(x=>x.team_id===teamSel.value);
   const next={team_id:teamSel.value,season_id:payload.p_season_id,
    matchday:payload.p_matchday,entries:payload.p_entries,published:payload.p_publish};
   if(existing>=0)records[existing]=next;else records.push(next);
   load();writeStatus('Classement de la journée enregistré par Supabase, '+(payload.p_publish?'publié':'conservé en brouillon')+'.');
  }catch{writeStatus('Erreur réseau : aucune sauvegarde confirmée.');}
  finally{busy=false;if(save.isConnected)save.disabled=false;}
 });
 load();
}
