/** Consent-gated, identity-safe profile for an educator (coach or staff).
 * No auth.users, private coach assignments, birth dates or image guesses.
 */
import {supabaseConfig} from './auth-config.mjs';
import {CLUB_TEAMS,teamRoute,disciplineLabel} from './club-teams.mjs';
import {boundedPublicRequest} from './public-catalog-timeout.mjs';
import {isPublicPlayerId} from './player-profile-page.mjs';

const BASE=supabaseConfig.url+'/rest/v1/';
export const isPublicEducatorId=isPublicPlayerId;
export function educatorPublicRoute(id){
 if(!isPublicEducatorId(id))throw new Error('Identifiant éducateur invalide');
 return '#/educateurs/'+id.toLowerCase();
}
export function isPublishedEducatorRole(person){
 if(!person)return false;
 if(person.person_kind==='coach')return true;
 if(person.person_kind!=='staff')return false;
 const role=String(person.role_label||'').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-FR').trim();
 return /^(entraineur|educateur|coach|adjoint|preparateur physique|preparateur sportif|assistant entraineur)(\b|\s|$)/.test(role);
}
export function publicIndividualProfileAllowed(person){
 return person?.published===true&&person?.consent_confirmed===true
  &&person?.profile_visible===true&&person?.profile_consent_confirmed===true;
}
const el=(tag,cls='',content=null)=>{
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(content!==null)n.textContent=String(content);
 return n;
};
const link=(text,href)=>{
 const a=el('a','player-profile-link',text);a.href=href;return a;
};
async function fetchRows(table,query,signal,fetcher){
 const response=await fetcher(BASE+table+'?'+new URLSearchParams(query),{
  method:'GET',signal,cache:'no-store',
  headers:{apikey:supabaseConfig.publishableKey,Accept:'application/json'}
 });
 if(!response.ok)throw new Error('Catalogue public indisponible');
 const rows=await response.json();
 if(!Array.isArray(rows))throw new Error('Données publiques invalides');
 return rows;
}
export async function loadPublishedEducatorProfile(id,{signal,fetcher=fetch}={}){
 if(!isPublicEducatorId(id))throw new Error('Identifiant éducateur invalide');
 const people=await fetchRows('team_public_people',{
  select:'id,team_id,display_name,person_kind,role_label,biography,published,consent_confirmed,profile_visible,profile_consent_confirmed',
  id:'eq.'+id,person_kind:'in.(coach,staff)',
  published:'eq.true',consent_confirmed:'eq.true',
  profile_visible:'eq.true',profile_consent_confirmed:'eq.true',limit:'1'
 },signal,fetcher);
 const person=people.find(p=>p.id===id&&isPublishedEducatorRole(p)&&publicIndividualProfileAllowed(p));
 if(!person||typeof person.team_id!=='string')return null;
 const teams=await fetchRows('club_teams',{
  select:'id,code,discipline',id:'eq.'+person.team_id,limit:'1'
 },signal,fetcher);
 const remote=teams.find(t=>t.id===person.team_id);
 const team=remote&&CLUB_TEAMS.find(t=>t.code===remote.code&&t.discipline===remote.discipline);
 return team?{person,team}:null;
}
export function renderPublicEducatorProfile(root,{person,team}){
 root.replaceChildren();
 const nav=el('nav','player-profile-breadcrumb');
 nav.setAttribute('aria-label','Fil d’Ariane');
 nav.append(link('Équipes','#/equipes'),el('span','','›'),
  link(team.name,teamRoute(team)),el('span','','›'),el('span','','Fiche éducateur'));
 root.append(nav);
 const hero=el('section','player-profile-hero player-profile-educator-hero');
 hero.setAttribute('aria-label','Présentation de l’éducateur');
 const portrait=el('div','player-profile-portrait');
 portrait.setAttribute('role','img');
 portrait.setAttribute('aria-label','Photographie non publiée : emplacement réservé');
 const silhouette=el('div','player-profile-portrait-icon');
 silhouette.setAttribute('aria-hidden','true');
 silhouette.append(el('span','player-profile-avatar-head'),el('span','player-profile-avatar-shoulders'));
 portrait.append(silhouette,el('span','player-profile-portrait-text','PHOTO NON PUBLIÉE'));
 const details=el('div','player-profile-hero-copy');
 details.append(el('p','player-profile-eyebrow','ÉDUCATEUR · FICHE PUBLIÉE PAR LE CLUB'),
  el('h2','',person.display_name),
  el('p','player-profile-subtitle',team.name+' · '+disciplineLabel(team.discipline)));
 const chips=el('div','player-profile-chips');
 chips.append(el('span','',person.role_label));
 details.append(chips);hero.append(portrait,details);root.append(hero);
 const facts=el('section','player-profile-panel');
 facts.append(el('h3','','Rôle sportif'));
 const list=el('dl','player-profile-facts');
 for(const [label,value] of [
  ['Fonction',person.role_label],['Équipe',team.name],
  ['Discipline',disciplineLabel(team.discipline)]
 ]){
  const node=el('div','player-profile-fact');
  node.append(el('dt','',label),el('dd','',value));list.append(node);
 }
 facts.append(list);root.append(facts);
 const bio=el('section','player-profile-panel');
 bio.append(el('h3','','Présentation'),
  el('p','player-profile-biography',person.biography?.trim()||
   'Aucune présentation supplémentaire n’est publiée.'));
 root.append(bio);
 const actions=el('nav','player-profile-actions');
 actions.setAttribute('aria-label','Retour aux équipes');
 actions.append(link('← Retour aux équipes','#/equipes'),
  link('Effectif et éducateurs de '+team.name,teamRoute(team)));
 root.append(actions);
}
let controller=null,generation=0;
export function unmountPublicEducatorProfile(){
 generation++;controller?.abort();controller=null;
}
export async function mountPublicEducatorProfile(id){
 unmountPublicEducatorProfile();
 const root=document.getElementById('educator-profile-public-root');
 if(!root)return;
 const current=generation,abort=new AbortController();
 controller=abort;
 const deadline=boundedPublicRequest(abort.signal);
 root.replaceChildren(el('p','player-profile-preview-note',
  'Vérification de la publication autorisée de l’éducateur…'));
 try{
  const entry=await loadPublishedEducatorProfile(id,{signal:deadline.signal});
  if(current!==generation||abort.signal.aborted||!root.isConnected)return;
  if(!entry){
   root.replaceChildren(el('p','player-profile-preview-note',
    'Aucune fiche éducateur publique autorisée ne correspond à ce lien.'));
   root.append(link('← Retour aux équipes','#/equipes'));return;
  }
  renderPublicEducatorProfile(root,entry);
 }catch{
  if(current!==generation||abort.signal.aborted||!root.isConnected)return;
  root.replaceChildren(el('p','player-profile-preview-note',
   'Fiche temporairement inaccessible. Aucune donnée privée n’est affichée.'));
  root.append(link('← Retour aux équipes','#/equipes'));
 }finally{deadline.dispose();}
}
