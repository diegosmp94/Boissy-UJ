import {supabaseConfig} from './auth-config.mjs';
import {CLUB_TEAMS} from './club-teams.mjs';
import {teamSubpageRoute} from './team-subpages.mjs';
import {boundedPublicRequest} from './public-catalog-timeout.mjs';
import {isPublicPlayerId,playerPublicRoute} from './player-profile-page.mjs';
import {PLAYER_POSITION_GROUPS,groupPublishedPlayers} from './player-position-groups.mjs';

const BASE=supabaseConfig.url+'/rest/v1/';
const element=(tag,cls='',value=null)=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(value!==null)node.textContent=String(value);
 return node;
};
async function rows(table,params,signal,fetcher){
 const response=await fetcher(BASE+table+'?'+new URLSearchParams(params),{
  method:'GET',signal,cache:'no-store',
  headers:{apikey:supabaseConfig.publishableKey,Accept:'application/json'}
 });
 if(!response.ok)throw new Error('Lecture publique indisponible');
 const data=await response.json();
 if(!Array.isArray(data))throw new Error('Format public invalide');
 return data;
}
export function filterPublicTeamPeople(items,teamId){
 return items.filter(p=>p.team_id===teamId&&p.published===true&&p.consent_confirmed===true
  &&['player','coach','staff'].includes(p.person_kind))
  .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||String(a.display_name).localeCompare(String(b.display_name),'fr'));
}
export function filterTeamNews(items,teamId,now=Date.now()){
 return items.filter(p=>p.team_id===teamId&&p.status==='published'
  &&p.visibility==='public'&&p.consent_reviewed===true
  &&Number.isFinite(Date.parse(p.published_at))&&Date.parse(p.published_at)<=now)
  .sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at));
}
export function validateTeamMetrics(rows,teamId){
 const stats=rows.find(x=>x.team_id===teamId);
 if(!stats)return null;
 const keys=['played','wins','draws','losses','goals_for','goals_against'];
 if(!keys.every(k=>Number.isSafeInteger(stats[k])&&stats[k]>=0)
   ||stats.played!==stats.wins+stats.draws+stats.losses)throw new Error('Bilan collectif incohérent');
 return stats;
}
/** Trois flux indépendants ; l'absence d'un ne masque pas les deux autres. */
export async function loadTeamPublicExtras(code,{signal,fetcher=fetch,now=Date.now(),onlyPeople=false}={}){
 const team=CLUB_TEAMS.find(x=>x.code===code);
 if(!team)throw new Error('Équipe inconnue');
 const lookup=await rows('club_teams',{select:'id,code,discipline',code:'eq.'+code,limit:'1'},signal,fetcher);
 const remote=lookup.find(x=>x.code===code&&x.discipline===team.discipline);
 if(!remote)return {configured:false,people:[],metrics:null,news:[],errors:[]};
 const tasks=[
  rows('team_public_people',{
   select:'id,team_id,display_name,person_kind,role_label,shirt_number,biography,sort_order,published,consent_confirmed',
   team_id:'eq.'+remote.id,published:'eq.true',consent_confirmed:'eq.true',
   order:'sort_order.asc',limit:'150'
  },signal,fetcher),
  (onlyPeople?Promise.resolve([]):rows('team_form_summary',{
   select:'team_id,played,wins,draws,losses,goals_for,goals_against',
   team_id:'eq.'+remote.id,limit:'1'
  },signal,fetcher)),
  (onlyPeople?Promise.resolve([]):rows('news_posts',{
   select:'id,team_id,title,excerpt,status,visibility,consent_reviewed,published_at',
   team_id:'eq.'+remote.id,status:'eq.published',visibility:'eq.public',
   consent_reviewed:'eq.true',published_at:'lte.'+new Date(now).toISOString(),
   order:'published_at.desc',limit:'6'
  },signal,fetcher))
 ];
 const result=await Promise.allSettled(tasks);
 const errors=result.map((r,i)=>r.status==='rejected'?['people','metrics','news'][i]:null).filter(Boolean);
 return {
  configured:true,
  people:result[0].status==='fulfilled'?filterPublicTeamPeople(result[0].value,remote.id):[],
  metrics:result[1].status==='fulfilled'?validateTeamMetrics(result[1].value,remote.id):null,
  news:result[2].status==='fulfilled'?filterTeamNews(result[2].value,remote.id,now):[],
  errors
 };
}
const empty=(message)=>element('p','team-extras-empty',message);
/** Public roster card: only the authorized name, image slot and shirt number.
 * The existing club catalogue does not yet supply image metadata, so this is
 * deliberately an identity-free portrait placeholder, never a fabricated face.
 */
export function renderPublicPlayerRosterCard(person){
 const validProfile=isPublicPlayerId(person?.id);
 const card=element(validProfile?'a':'article','team-extras-person team-extras-player-card');
 if(validProfile){
  card.href=playerPublicRoute(person.id);
  card.setAttribute('aria-label','Voir la fiche de '+String(person.display_name||'').trim());
 }
 const portrait=element('div','team-extras-player-portrait');
 portrait.setAttribute('role','img');
 portrait.setAttribute('aria-label','Photo du joueur non publiée');
 const silhouette=element('div','team-extras-player-silhouette');
 silhouette.setAttribute('aria-hidden','true');
 silhouette.append(element('span','team-extras-player-head'),element('span','team-extras-player-shoulders'));
 portrait.append(silhouette);
 const number=element('span','team-extras-player-number',
  Number.isInteger(person.shirt_number)&&person.shirt_number>=1&&person.shirt_number<=99
   ?String(person.shirt_number):'—');
 number.setAttribute('aria-label',number.textContent==='—'
  ?'Numéro non communiqué':'Numéro de maillot '+number.textContent);
 portrait.append(number);
 card.append(portrait,element('h3','team-extras-player-name',String(person.display_name||'').trim()));
 return card;
}
/** An educator is a published coach, or a staff member explicitly described
 * as coaching/training support. Public roster records are independent of
 * private coach/team assignments and require per-team publication consent. */
export function isPublicEducator(person){
 if(!person||person.published!==true||person.consent_confirmed!==true)return false;
 if(person.person_kind==='coach')return true;
 if(person.person_kind!=='staff')return false;
 const role=String(person.role_label||'').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-FR').trim();
 return /^(entraineur|educateur|coach|adjoint|preparateur physique|preparateur sportif|assistant entraineur)(\b|\s|$)/.test(role);
}
export function publicEducators(people){
 return (Array.isArray(people)?people:[]).filter(isPublicEducator);
}
/** A visual placeholder, not a real portrait or a public player profile. */
export function renderPublicEducatorCard(person){
 const card=element('article','team-extras-person team-extras-educator-card');
 const portrait=element('div','team-extras-player-portrait team-extras-educator-portrait');
 portrait.setAttribute('role','img');
 portrait.setAttribute('aria-label','Photo de l’éducateur non publiée');
 const silhouette=element('div','team-extras-player-silhouette');
 silhouette.setAttribute('aria-hidden','true');
 silhouette.append(element('span','team-extras-player-head'),
  element('span','team-extras-player-shoulders'));
 portrait.append(silhouette);
 const detail=element('div','team-extras-educator-detail');
 detail.append(element('h3','team-extras-educator-name',
    String(person.display_name||'').trim()),
   element('p','team-extras-educator-function',
    String(person.role_label||'Fonction non renseignée').trim()));
 card.append(portrait,detail);
 return card;
}
function educatorsSection(root,people){
 const section=element('section','team-extras-group team-position-section team-educators-section');
 section.setAttribute('aria-label','Éducateurs');
 section.append(element('h2','','Éducateurs'));
 const grid=element('div','team-extras-people team-extras-player-grid team-extras-educator-grid');
 const items=publicEducators(people);
 if(!items.length)grid.append(empty('Aucun éducateur autorisé à la publication pour cette équipe actuellement.'));
 else for(const person of items)grid.append(renderPublicEducatorCard(person));
 section.append(grid);root.append(section);
}
function group(root,title,items){
 const section=element('section','team-extras-group');
 section.append(element('h2','',title));
 const grid=element('div','team-extras-people');
 if(title==='Effectif')grid.classList.add('team-extras-player-grid');
 if(!items.length)grid.append(empty('Aucune identité autorisée à la publication pour le moment.'));
 for(const person of items){
  if(person.person_kind==='player'){
   grid.append(renderPublicPlayerRosterCard(person));
   continue;
  }
  const card=element('article','team-extras-person');
  const info=element('div','team-extras-person-icon',person.person_kind==='coach'?'COACH':'STAFF');
  info.setAttribute('aria-hidden','true');
  const body=element('div');
  body.append(element('span','tiny-label',person.role_label),element('h3','',person.display_name));
  if(person.biography)body.append(element('p','',person.biography));
  card.append(info,body);grid.append(card);
 }
 section.append(grid);
 root.append(section);
}
function groupedPlayers(root,people){
 const approved=groupPublishedPlayers(people);
 for(const position of PLAYER_POSITION_GROUPS){
  const section=element('section','team-extras-group team-position-section');
  section.append(element('h2','',position.label));
  const grid=element('div','team-extras-people team-extras-player-grid');
  const items=approved.groups[position.id];
  if(!items.length)grid.append(empty('Aucun joueur publié dans cette catégorie pour le moment.'));
  else for(const person of items)grid.append(renderPublicPlayerRosterCard(person));
  section.append(grid);root.append(section);
 }
 educatorsSection(root,people);
 if(approved.unclassified.length){
  const section=element('section','team-extras-group team-position-section');
  section.append(element('h2','','À classer'));
  const grid=element('div','team-extras-people team-extras-player-grid');
  for(const person of approved.unclassified)grid.append(renderPublicPlayerRosterCard(person));
  section.append(grid,empty('Position à confirmer par le club. Aucun joueur publié n’est masqué.'));
  root.append(section);
 }
}
function statsSection(root,stats,unavailable){
 const section=element('section','team-extras-group');
 section.append(element('h2','','Bilan de l’équipe'));
 if(unavailable)section.append(empty('Le bilan sportif est momentanément indisponible.'));
 else if(!stats?.played)section.append(empty('Aucun résultat terminé et publié pour le moment.'));
 else{
  const dl=element('dl','team-extras-metrics');
  for(const [name,value] of [['Matchs joués',stats.played],['Victoires',stats.wins],
  ['Nuls',stats.draws],['Défaites',stats.losses],['Buts marqués',stats.goals_for],
  ['Buts encaissés',stats.goals_against]]){
   const item=element('div','team-extras-metric');
   item.append(element('dt','',name),element('dd','',value));dl.append(item);
  }
  section.append(dl);
 }
 root.append(section);
}
function newsSection(root,posts,unavailable,teamCode){
 const section=element('section','team-extras-group');
 section.append(element('h2','','Actualités de l’équipe'));
 if(unavailable)section.append(empty('Les actualités de cette équipe sont momentanément indisponibles.'));
 else if(!posts.length)section.append(empty('Aucune actualité validée pour cette équipe pour le moment.'));
 else{
  const list=element('div','team-extras-articles');
  for(const post of posts){
   const article=element('article','team-extras-article');
   const date=new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeZone:'Europe/Paris'})
     .format(new Date(post.published_at));
   article.append(element('time','team-extras-news-date',date),element('h3','',post.title));
   article.firstChild.dateTime=post.published_at;
   if(post.excerpt)article.append(element('p','',post.excerpt));
   list.append(article);
  }
  section.append(list);
 }
 const link=element('a','team-extras-more-link','Voir toutes les actualités de cette équipe ↗');
 link.href=teamSubpageRoute(CLUB_TEAMS.find(t=>t.code===teamCode),'actualites');section.append(link);
 root.append(section);
}
let active=null,generation=0;
export function unmountTeamPublicExtras(){generation++;active?.abort();active=null}
export async function mountTeamPublicExtras(code,{view='all'}={}){
 unmountTeamPublicExtras();
 const root=document.getElementById('team-profile-extras');
 if(!root)return;
 const id=generation;
 const controller=new AbortController();active=controller;
 const deadline=boundedPublicRequest(controller.signal);
 root.replaceChildren(element('p','team-extras-empty','Chargement des informations publiques de l’équipe…'));
 try{
  const data=await loadTeamPublicExtras(code,{signal:deadline.signal,onlyPeople:view==='players'});
  if(controller.signal.aborted||generation!==id||!root.isConnected)return;
  root.replaceChildren();
  if(!data.configured){
   root.append(empty('Informations d’équipe non configurées.'));return;
  }
  const unavailable=data.errors.includes('people');
  if(unavailable){
   const warn=element('p','team-extras-notice','L’annuaire public est temporairement indisponible.');
   warn.setAttribute('role','status');root.append(warn);
  }
  // A network or permissions failure is not evidence of an empty squad.
  // Keep independently loaded team news and metrics available.
  if(!unavailable)groupedPlayers(root,data.people);
  if(view!=='players'){
   const otherStaff=data.people.filter(p=>p.person_kind==='staff'&&!isPublicEducator(p));
   if(otherStaff.length)group(root,'Encadrement',otherStaff);
   statsSection(root,data.metrics,data.errors.includes('metrics'));
   newsSection(root,data.news,data.errors.includes('news'),code);
  }
  root.append(element('p','team-extras-note','Aucun nom, photographie ou contenu personnel n’est ajouté automatiquement. Les fiches publiques requièrent les autorisations de publication vérifiées par le club. Les statistiques proviennent des résultats publiés.'));
 }catch{
  if(controller.signal.aborted||generation!==id||!root.isConnected)return;
  root.replaceChildren(empty('Les informations de l’équipe sont momentanément indisponibles. Aucun membre non validé ne sera affiché.'));
 }finally{deadline.dispose();}
}
