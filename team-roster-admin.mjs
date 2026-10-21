/** Admin-only presentation of already-authorized team people records.
 * This module never fetches private data and is only mounted behind admin + MFA.
 */
import {CLUB_TEAMS} from './club-teams.mjs';

const node=(tag,cls='',value=null)=>{
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(value!==null)el.textContent=String(value);
 return el;
};
export function rosterAdminTotals(entries=[]){
 const valid=entries.filter(entry=>entry&&typeof entry.id==='string');
 return {total:valid.length,
  published:valid.filter(x=>x.published===true).length,
  drafts:valid.filter(x=>x.published!==true).length};
}
const normalize=value=>String(value||'').normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-FR').trim();
export function filterAdminRoster(entries=[],teams=[],{teamCode='all',status='all',query=''}={}){
 if(teamCode!=='all'&&!CLUB_TEAMS.some(team=>team.code===teamCode))return [];
 if(!['all','published','draft'].includes(status))return [];
 const teamMap=new Map(teams.filter(team=>CLUB_TEAMS.some(known=>known.code===team.code))
  .map(team=>[team.id,team]));
 const term=normalize(query).slice(0,80);
 return entries.filter(person=>{
  if(!person||!teamMap.has(person.team_id))return false;
  const team=teamMap.get(person.team_id);
  if(teamCode!=='all'&&team.code!==teamCode)return false;
  if(status==='published'&&person.published!==true)return false;
  if(status==='draft'&&person.published===true)return false;
  return !term||[person.display_name,person.role_label,team.name].some(x=>normalize(x).includes(term));
 }).sort((a,b)=>{
  const ta=teamMap.get(a.team_id),tb=teamMap.get(b.team_id);
  const position=CLUB_TEAMS.findIndex(t=>t.code===ta.code)-CLUB_TEAMS.findIndex(t=>t.code===tb.code);
  return position||Number(a.sort_order||0)-Number(b.sort_order||0)
   ||String(a.display_name||'').localeCompare(String(b.display_name||''),'fr');
 });
}
function option(value,label){
 const e=node('option','',label);e.value=value;return e;
}
/** Searchable list; `entries` can only come from the guarded admin RPC. */
export function mountAdminRosterDirectory(container,onChoose){
 container.replaceChildren();
 const intro=node('div','team-roster-directory-intro');
 intro.append(node('h3','','Répertoire administrateur'),
  node('p','','Sélectionne un profil pour le modifier, le publier ou préparer son retrait. Les brouillons ne sont jamais publics.'));
 const filters=node('div','team-roster-directory-filters');
 const teamLabel=node('label','club-editor-field','Équipe');
 const teamSelect=node('select','club-editor-control');
 teamSelect.append(option('all','Toutes les équipes'));
 for(const t of CLUB_TEAMS)teamSelect.append(option(t.code,t.name));
 teamLabel.append(teamSelect);
 const statusLabel=node('label','club-editor-field','Publication');
 const statusSelect=node('select','club-editor-control');
 statusSelect.append(option('all','Tous les états'),option('published','Publiés'),option('draft','Brouillons'));
 statusLabel.append(statusSelect);
 const queryLabel=node('label','club-editor-field','Rechercher un nom ou un poste');
 const search=node('input','club-editor-control');
 search.type='search';search.maxLength=80;search.placeholder='Nom, poste ou équipe…';
 queryLabel.append(search);
 filters.append(teamLabel,statusLabel,queryLabel);
 const summary=node('p','team-roster-directory-summary');summary.setAttribute('role','status');
 const list=node('div','team-roster-directory-list');
 list.setAttribute('aria-label','Profils accessibles à l’administrateur');
 container.append(intro,filters,summary,list);
 let entries=[],teams=[],selectedId=null;
 function redraw(){
  list.replaceChildren();
  const counts=rosterAdminTotals(entries);
  const filtered=filterAdminRoster(entries,teams,{
   teamCode:teamSelect.value,status:statusSelect.value,query:search.value
  });
  summary.textContent=counts.total+' profils · '+counts.published+' publiés · '
   +counts.drafts+' brouillons · '+filtered.length+' dans la sélection';
  if(!filtered.length){
   list.append(node('p','team-roster-directory-empty','Aucun profil correspondant. Aucun membre fictif n’est ajouté.'));
   return;
  }
  for(const person of filtered.slice(0,60)){
   const team=teams.find(x=>x.id===person.team_id);
   const button=node('button','team-roster-directory-person');
   button.type='button';button.setAttribute('aria-pressed',String(person.id===selectedId));
   button.setAttribute('aria-label','Modifier '+person.display_name+' · '+(team?.name||'Équipe non identifiée'));
   const left=node('span','team-roster-directory-person-main');
   left.append(node('strong','',person.display_name),
    node('small','',(team?.name||'Équipe non identifiée')+' · '+person.role_label));
   const status=node('span','team-roster-directory-state',
    person.published===true?'Publié':'Brouillon');
   status.dataset.published=String(person.published===true);
   button.append(left,status);
   button.addEventListener('click',()=>onChoose(person.id));
   list.append(button);
  }
  if(filtered.length>60)list.append(node('p','team-roster-directory-empty',
   'Seuls les 60 premiers profils sont affichés. Utilise les filtres pour affiner.'));
 }
 teamSelect.addEventListener('change',redraw);
 statusSelect.addEventListener('change',redraw);
 search.addEventListener('input',redraw);
 return {
  update(nextEntries,nextTeams,nextSelectedId=null){
   entries=Array.isArray(nextEntries)?nextEntries:[];
   teams=Array.isArray(nextTeams)?nextTeams:[];
   selectedId=nextSelectedId;redraw();
  }
 };
}
