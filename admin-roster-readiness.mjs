/** Admin-only, read-only view of published rosters vs private affiliations.
 * Counts cannot prove individual identity matches: no implicit cross-catalogue linking.
 */
import {CLUB_TEAMS} from './club-teams.mjs';
import {positionFromPublicRole,validPrivatePosition,safeShirtNumber} from './player-position-groups.mjs';

const node=(tag,cls='',value=null)=>{
 const x=document.createElement(tag);if(cls)x.className=cls;
 if(value!==null)x.textContent=String(value);
 return x;
};
export function rosterReadinessForTeam(team,publicPeople=[],privatePlayers=null){
 if(!CLUB_TEAMS.some(t=>t.code===team?.code)||typeof team?.id!=='string')
  throw new Error('Équipe non reconnue');
 const records=(Array.isArray(publicPeople)?publicPeople:[])
  .filter(p=>p?.team_id===team.id);
 const approved=records.filter(p=>p.published===true&&p.consent_confirmed===true);
 const publishedPlayers=approved.filter(p=>p.person_kind==='player');
 const educators=approved.filter(p=>p.person_kind==='coach');
 const publicUnclassified=publishedPlayers.filter(p=>!positionFromPublicRole(p.role_label)).length;
 const pending=records.filter(p=>p.published!==true).length;
 const consentReview=records.filter(p=>p.published===true&&p.consent_confirmed!==true).length;
 if(!Array.isArray(privatePlayers))return {
  teamCode:team.code,name:team.name||CLUB_TEAMS.find(t=>t.code===team.code).name,
  available:false,publishedPlayers:publishedPlayers.length,educators:educators.length,
  publicUnclassified,pending,consentReview,
  affiliated:null,numbered:null,missingPosition:null,missingNumber:null
 };
 const unique=new Map();
 for(const entry of privatePlayers){
  if(typeof entry?.player_user_id==='string'&&!unique.has(entry.player_user_id))
   unique.set(entry.player_user_id,entry);
 }
 const active=[...unique.values()];
 const numbered=active.filter(p=>validPrivatePosition(p.position_group)
  &&safeShirtNumber(p.shirt_number)!==null).length;
 return {
  teamCode:team.code,name:team.name||CLUB_TEAMS.find(t=>t.code===team.code).name,
  available:true,publishedPlayers:publishedPlayers.length,educators:educators.length,
  publicUnclassified,pending,consentReview,
  affiliated:active.length,numbered,
  missingPosition:active.filter(p=>!validPrivatePosition(p.position_group)).length,
  missingNumber:active.filter(p=>safeShirtNumber(p.shirt_number)===null).length
 };
}
/** A click, a fresh MFA check, and valid server-scoped RPCs are required for reading. */
export function mountAdminRosterReadiness(container,api,isAdmin,getSnapshot){
 if(!container?.isConnected||!api||typeof isAdmin!=='function'||typeof getSnapshot!=='function')return null;
 const root=node('section','admin-roster-readiness');
 root.setAttribute('aria-label','Contrôle des effectifs privés et publics');
 const heading=node('h3','','État des effectifs par équipe');
 const intro=node('p','',
  'Comparaison des volumes privés et publics. Aucun rapprochement par nom et aucune publication automatique : les fiches publiques nécessitent toujours les accords du club.');
 const button=node('button','team-person-secondary-button','Vérifier les cinq équipes');
 button.type='button';
 const status=node('p','admin-roster-audit-status','Lance une vérification pour consulter les écarts.');
 status.setAttribute('role','status');
 const results=node('div','admin-roster-audit-results');
 root.append(heading,intro,button,status,results);container.append(root);
 let revision=0,loading=false;
 const alive=()=>root.isConnected&&container.isConnected;
 function invalidate(){
  revision++;
  results.replaceChildren();
  if(alive())status.textContent='Données publiques actualisées. Relance la vérification pour un bilan à jour.';
 }
 button.addEventListener('click',async()=>{
  if(loading||!alive())return;
  const run=++revision;
  loading=true;button.disabled=true;results.replaceChildren();
  status.textContent='Vérification administrateur MFA et lecture des effectifs…';
  try{
   if(!await isAdmin())throw new Error('Access denied');
   if(!alive()||run!==revision)return;
   const snapshot=getSnapshot();
   if(!snapshot||!Array.isArray(snapshot.teams)||!Array.isArray(snapshot.entries))
    throw new Error('Catalogue indisponible');
   const teams=CLUB_TEAMS.map(known=>snapshot.teams.find(t=>
    t.code===known.code&&typeof t.id==='string'&&t.id.length>0));
   if(teams.some(t=>!t))throw new Error('Cinq équipes non configurées');
   const answers=await Promise.allSettled(teams.map(team=>
    api.rpc('staff_list_affiliated_players',{p_team_id:team.id})
   ));
   if(!alive()||run!==revision)return;
   if(!await isAdmin())throw new Error('Session expired');
   if(!alive()||run!==revision)return;
   const current=getSnapshot();
   if(current?.revision!==snapshot.revision)throw new Error('Catalogue modifié');
   const records=teams.map((team,i)=>{
    const answer=answers[i];
    const people=answer.status==='fulfilled'&&!answer.value?.error&&
      Array.isArray(answer.value?.data)?answer.value.data:null;
    return rosterReadinessForTeam(team,snapshot.entries,people);
   });
   const list=node('div','admin-roster-audit-list');
   for(const record of records){
    const card=node('article','admin-roster-audit-item');
    card.append(node('h4','',record.name));
    if(!record.available){
     card.append(node('p','','Affiliations privées indisponibles : contrôle incomplet.'));
    }else{
     card.append(node('p','',
      record.affiliated+' joueurs affiliés · '+record.numbered+' poste(s) et numéro(s) attribués · '
      +record.missingPosition+' sans catégorie · '+record.missingNumber+' sans numéro.'));
    }
    card.append(node('p','',
     record.publishedPlayers+' joueurs publiés · '+record.educators+' éducateurs publiés · '
     +record.pending+' fiches en brouillon · '+record.publicUnclassified+' joueurs publics à classer.'));
    if(record.consentReview)card.append(node('p','admin-roster-audit-alert',
     record.consentReview+' publication(s) sans consentement confirmé : vérifier sans délai.'));
    list.append(card);
   }
   if(!alive()||run!==revision)return;
   results.replaceChildren(list,node('p','admin-roster-audit-disclaimer',
    'Important : ces nombres ne prouvent pas que les comptes affiliés correspondent aux fiches publiques. Une vérification individuelle des identités, des équipes et des accords reste obligatoire avant chaque publication.'));
   status.textContent=records.every(r=>r.available)
    ?'Vérification terminée : cinq équipes examinées (lecture seule).'
    :'Vérification partielle : certaines affiliations n’ont pas pu être chargées.';
  }catch{
   if(alive()&&run===revision){
    results.replaceChildren();
    status.textContent='Vérification indisponible : droits MFA, connexion ou catalogue incomplet. Aucune donnée modifiée.';
   }
  }finally{
   loading=false;if(button.isConnected)button.disabled=false;
  }
 });
 return {invalidate};
}
