/** Protected administration hub. No preview-only controls are mounted anywhere.
 * All protected data is loaded after getUser + MFA AAL2 + admin role verification.
 */
import {supabaseConfig} from './auth-config.mjs';
import {adminSessionStatus} from './admin-security.mjs';
import {mountAdminRoleModeration} from './admin-role-moderation.mjs';
import {mountAuthenticatedClubIdentityEditor} from './club-editor.mjs';
import {mountAuthenticatedTeamPeopleEditor} from './team-person-editor.mjs';
import {mountAdminMembers} from './admin-users.mjs';
import {mountAdminNewsMedia} from './admin-news-media.mjs';
import {mountAdminEditorialStatus} from './admin-editorial-status.mjs';
import {mountAdminNewsRevisions} from './admin-news-revisions.mjs';
import {mountAdminReadiness} from './admin-readiness.mjs';
import {mountAdminDonationCampaigns} from './admin-donation-campaigns.mjs';
import {mountAdminAdvancedEvents} from './admin-advanced-events.mjs';
import {mountAdminSportReview} from './admin-sport-source-review.mjs';
import {mountAdminTicketingReadiness} from './admin-ticketing-readiness.mjs';
import {mountAdminFreeTicketScanner} from './admin-free-ticket-scanner.mjs';
import {mountAdminPlayerTeams} from './admin-player-teams.mjs';
import {mountAdminCoachTeams} from './admin-coach-teams.mjs';
import {mountAdminSeasons,mountAdminMatches,mountAdminNews,mountAdminFreeEvents} from './admin-management.mjs';
import {filterAdminModules,groupAdminModules,availableAdminModules} from './admin-navigation.mjs';
import {withAuthDeadline} from './auth-resilience.mjs';
import {adminCapabilities,adminFailureLabel} from './admin-control-reliability.mjs';

export const ADMIN_MODULES=Object.freeze([
 {id:'overview',name:'Vue générale',group:'Pilotage',caption:'Données réelles, aucun chiffre fictif'},
 {id:'readiness',name:'État de mise en service',group:'Pilotage',caption:'Lectures techniques et validations manquantes'},
 {id:'donations',name:'Dons et campagnes',group:'Pilotage',caption:'Campagnes publiées, sans encaissement en ligne'},
 {id:'users',name:'Membres et rôles',group:'Pilotage',caption:'Consultation et retraits validés'},
 {id:'approvals',name:'Validation des rôles',group:'Pilotage',caption:'Demandes et approbations MFA'},
 {id:'teams',name:'Effectifs publics',group:'Sport',caption:'Brouillons et publication contrôlée'},
 {id:'player-teams',name:'Affectations joueurs',group:'Sport',caption:'Rattachement sécurisé des joueurs aux équipes'},
 {id:'coach-teams',name:'Affectations entraîneurs',group:'Sport',caption:'Gérer les équipes attribuées aux éducateurs'},  
 {id:'seasons',name:'Saisons',group:'Sport',caption:'Gestion des saisons sportives'},
 {id:'matches',name:'Matchs et résultats',group:'Sport',caption:'Rencontres officielles du club'},
 {id:'sport-review',name:'Revue des sources sportives',group:'Sport',caption:'Dates, résultats externes et homologation'},
 {id:'events',name:'Événements gratuits',group:'Sport',caption:'Agenda sans billetterie ni paiements'},
 {id:'event-rules',name:'Événements avancés',group:'Sport',caption:'Accès, jauges et plages de réservation (fermées)'},
 {id:'ticketing',name:'Préparation billetterie',group:'Sport',caption:'Jauges et contrôle des billets QR (non activé)'},
 {id:'entry-scan',name:'Contrôle entrée QR',group:'Sport',caption:'Scanner personnel MFA en préproduction uniquement'},  
 {id:'editorial',name:'Suivi des publications',group:'Contenu',caption:'Contrôles réels des articles et médias'},
 {id:'news',name:'Actualités',group:'Contenu',caption:'Articles et droits de publication'},
 {id:'news-revisions',name:'Historique des actualités',group:'Contenu',caption:'Versions précédentes et restauration en brouillon'}, 
 {id:'news-media',name:'Galeries et vidéos',group:'Contenu',caption:'Photos et vidéos approuvées par le club'},
 {id:'identity',name:'Identité du club',group:'Contenu',caption:'Contenus et histoire du club'}
]);
export function canOpenAdmin(status,enabled=true){
 return enabled===true&&status?.status==='admin'&&status?.level==='aal2'&&status?.roles?.includes('admin');
}
const el=(tag,cls='',text=null)=>{
 const e=document.createElement(tag);if(cls)e.className=cls;
 if(text!==null)e.textContent=String(text);return e;
};
const button=label=>{const e=el('button','admin-module-tab',label);e.type='button';return e;};
let currentGeneration=0;
let activeSubscription=null;
let activeReturnCleanup=null;
export function adminCenterMarkup(){
 return '<div id="real-admin-root" class="real-admin-root" aria-live="polite"><p role="status">Vérification de l’accès administrateur…</p></div>';
}
export function unmountAdminCenter(){
 currentGeneration++;
 activeReturnCleanup?.();activeReturnCleanup=null;
 activeSubscription?.unsubscribe();activeSubscription=null;
 const target=document.getElementById('real-admin-root');
 target?.replaceChildren();
}
export async function mountAdminCenter(getClient){
 unmountAdminCenter();
 const serial=currentGeneration;
 const root=document.getElementById('real-admin-root');
 if(!root)return;
 if(!supabaseConfig.adminEnabled){
  root.replaceChildren(el('p','admin-empty','Les outils d’administration sont temporairement verrouillés.'));
  return;
 }
 let api=null;
 try{
  api=await withAuthDeadline(Promise.resolve().then(getClient));
  const verified=await adminSessionStatus(api);
  if(serial!==currentGeneration||!root.isConnected)return;
  if(!canOpenAdmin(verified,supabaseConfig.adminEnabled)){
   root.replaceChildren();
   root.append(el('h2','','Administration protégée'));
   const message=verified.status==='mfa-required'
     ?'Ton compte est administrateur. Valide d’abord le MFA depuis Mon espace.'
     :verified.status==='supporter'?'Accès réservé aux administrateurs du club.':'Connecte-toi pour accéder au centre de gestion.';
   root.append(el('p','admin-empty',message));
   const a=el('a','admin-console-back','Retour à Mon espace →');a.href='#/mon-espace';root.append(a);
   return;
  }
  // Subscription registered only after verification. On sign-out, never render a stale admin view.
  const {data:{subscription}}=api.auth.onAuthStateChange(event=>{
   if(event==='SIGNED_OUT'&&serial===currentGeneration){
    root.replaceChildren(el('p','admin-empty','Session fermée. Reconnecte-toi dans Mon espace.'));
    window.setTimeout(()=>{if(serial===currentGeneration)window.location.hash='#/mon-espace';},0);
   }
  });
  activeSubscription=subscription;
  // After a role or MFA revoke in another session, a previously mounted
  // administration page must not keep showing private identifiers.
  // Resuming the tab drops stale views synchronously and remounts only
  // after a fresh getUser + role + AAL2 check.
  let lastReturnCheck=0;
  const revalidateOnReturn=()=>{
   if(serial!==currentGeneration||!root.isConnected||
     document.visibilityState==='hidden'||!root.querySelector('.real-admin-layout'))return;
   const now=Date.now();
   if(now-lastReturnCheck<900)return;
   lastReturnCheck=now;
   root.replaceChildren(el('p','admin-empty','Nouvelle vérification des autorisations et du MFA…'));
   void mountAdminCenter(getClient);
  };
  window.addEventListener('focus',revalidateOnReturn);
  document.addEventListener('visibilitychange',revalidateOnReturn);
  activeReturnCleanup=()=>{
   window.removeEventListener('focus',revalidateOnReturn);
   document.removeEventListener('visibilitychange',revalidateOnReturn);
  };
  // Module health is isolated: a missing/slow RPC hides only its module.
  // All probes are bounded, independent and issued after the initial MFA gate.
  const {eventsReady,eventRulesReady,scannerReady,coachTeamsReady,mediaReady,newsRevisionsReady}=
    await adminCapabilities(api);
  if(serial!==currentGeneration||!root.isConnected)return;
  // Capabilities are not permissions: verify roles and MFA again after probes.
  const postProbeStatus=await adminSessionStatus(api,verified.userId);
  if(serial!==currentGeneration||!root.isConnected)return;
  if(!canOpenAdmin(postProbeStatus,supabaseConfig.adminEnabled)){
   root.replaceChildren(el('p','admin-empty',adminFailureLabel('authorization')));
   const back=el('a','admin-console-back','Retour à Mon espace');
   back.href='#/mon-espace';root.append(back);
   return;
  }
  root.replaceChildren();
  const head=el('header','real-admin-heading');
  head.append(el('span','tiny-label','BOISSY-UJ · ADMINISTRATION SÉCURISÉE'),
   el('h1','','Centre de gestion'),
   el('p','','Actions réelles enregistrées par Supabase. Accès réservé au rôle administrateur avec MFA AAL2.'));
  const home=el('a','admin-console-back','← Mon espace');home.href='#/mon-espace';
  head.append(home);root.append(head);
  const layout=el('div','real-admin-layout'),sidebar=el('nav','real-admin-sidebar');
  sidebar.setAttribute('aria-label','Modules d’administration');
  const pane=el('section','real-admin-pane');
  pane.setAttribute('aria-label','Outil de gestion');
  layout.append(sidebar,pane);root.append(layout);
  const availableModules=availableAdminModules(ADMIN_MODULES,{eventsReady,eventRulesReady,scannerReady,coachTeamsReady,mediaReady,newsRevisionsReady});
  const navTools=el('div','admin-nav-tools');
  const navLabel=el('label','admin-nav-label','Trouver un module');
  const moduleSearch=el('input','admin-nav-search');
  moduleSearch.type='search';moduleSearch.placeholder='Membres, matchs, actualités…';
  moduleSearch.autocomplete='off';moduleSearch.maxLength=80;
  moduleSearch.setAttribute('aria-label','Rechercher un module administrateur');
  const navCount=el('span','admin-nav-count');
  navCount.setAttribute('role','status');navCount.setAttribute('aria-live','polite');
  navLabel.append(moduleSearch);navTools.append(navLabel,navCount);
  const refreshCurrent=el('button','admin-secondary-btn','Actualiser le module');
  refreshCurrent.type='button';
  refreshCurrent.setAttribute('aria-label','Actualiser le module administratif actif');
  refreshCurrent.addEventListener('click',()=>void selectSection(active));
  navTools.append(refreshCurrent);
  sidebar.append(navTools);
  const moduleList=el('div','admin-nav-list');sidebar.append(moduleList);
  let active='overview';
  function renderSidebar(){
   const filtered=filterAdminModules(availableModules,moduleSearch.value);
   moduleList.replaceChildren();
   navCount.textContent=filtered.length+' module(s) disponible(s)';
   for(const group of groupAdminModules(filtered)){
    const section=el('div','admin-nav-section');
    section.append(el('h2','admin-nav-group-title',group.title));
    for(const item of group.items){
     const b=button(item.name);b.dataset.module=item.id;
     b.append(el('small','',item.caption));
     b.setAttribute('aria-current',String(item.id===active));
     b.addEventListener('click',()=>void selectSection(item.id));
     section.append(b);
    }
    moduleList.append(section);
   }
   if(!filtered.length)moduleList.append(el('p','admin-nav-empty','Aucun module trouvé. Essaie une autre recherche.'));
  }
  moduleSearch.addEventListener('input',renderSidebar);
  const shortcuts=()=>availableModules.filter(m=>['users','matches','events','news'].includes(m.id));
  async function overview(view){
   const h=el('h2','','Activité du club'),p=el('p','admin-workflow-status','Chargement des données réelles…');
   view.append(h,p);
   const links=el('div','admin-overview-shortcuts');
   links.append(el('h3','','Accès rapides'));
   const actions=el('div','admin-shortcut-grid');
   for(const module of shortcuts()){
    const b=el('button','admin-shortcut',module.name);
    b.type='button';b.append(el('small','',module.caption));
    b.addEventListener('click',()=>void selectSection(module.id));
    actions.append(b);
   }
   links.append(actions);view.append(links);
   const [teams,requests,matches,posts]=await withAuthDeadline(Promise.all([
    api.from('club_teams').select('id').limit(100),
    api.from('role_requests').select('id').eq('status','pending').limit(100),
    api.rpc('admin_list_management_matches'),
    api.rpc('admin_list_management_news')
   ]));
   if(serial!==currentGeneration||!view.isConnected||active!=='overview')return;
   if([teams,requests,matches,posts].some(x=>x.error)){
    p.textContent='Une partie des indicateurs n’a pas pu être vérifiée. Aucun chiffre estimé n’est affiché.';return;
   }
   p.textContent='Les valeurs ci-dessous proviennent uniquement des données enregistrées.';
   const grid=el('div','real-admin-kpis');
   for(const [label,value] of [
    ['Équipes',teams.data?.length||0],['Demandes en attente',requests.data?.length||0],
    ['Rencontres enregistrées',matches.data?.length||0],
    ['Articles enregistrés',posts.data?.length||0]
   ]){
    const box=el('div','real-admin-kpi');box.append(el('span','',label),el('strong','',value));grid.append(box);
   }
   view.append(grid,el('p','admin-workflow-status','Les nombres de rencontres et articles concernent au maximum 250 et 200 dossiers respectivement ; aucune statistique n’est simulée.'));
  }
  function showModuleRetry(view,id){
   if(serial!==currentGeneration||!view.isConnected||active!==id)return;
   // Never leave partially loaded private rows in a failing module.
   view.replaceChildren();
   const warning=el('p','admin-empty',adminFailureLabel('module'));
   warning.setAttribute('role','alert');
   const retry=el('button','admin-secondary-btn','Réessayer ce module');
   retry.type='button';
   retry.addEventListener('click',()=>void selectSection(id));
   view.append(warning,retry);
  }
  async function selectSection(id){
   if(!availableModules.some(module=>module.id===id))return;
   active=id;
   for(const item of sidebar.querySelectorAll('button[data-module]')){
    item.setAttribute('aria-current',String(item.dataset.module===id));
   }
   // Distinct DOM root per module: pending requests from a previous module can no longer paint the current one.
   const view=el('div','admin-module-instance');
   pane.replaceChildren(view);
   view.append(el('p','admin-workflow-status','Vérification du rôle et du second facteur…'));
   // Must re-check identity and MFA before showing private data on every module change.
   try{
   const check=await adminSessionStatus(api,verified.userId);
   if(serial!==currentGeneration||!view.isConnected||active!==id)return;
   if(!canOpenAdmin(check,supabaseConfig.adminEnabled)){
    view.replaceChildren(el('p','admin-empty','Accès suspendu : droits administrateur ou MFA à renouveler.'));
    return;
   }
   view.replaceChildren();
   switch(id){
    case 'overview':await overview(view);break;
    case 'donations':void mountAdminDonationCampaigns(view,api,verified.userId).catch(()=>showModuleRetry(view,id));break;
    case 'readiness':void mountAdminReadiness(view,api,verified.userId).catch(()=>showModuleRetry(view,id));break;
    case 'users':void mountAdminMembers(view,api,verified.userId).catch(()=>showModuleRetry(view,id));break;
    case 'approvals':void mountAdminRoleModeration(view,api,verified.userId).catch(()=>showModuleRetry(view,id));break;
    case 'teams':void mountAuthenticatedTeamPeopleEditor(view,api,verified.userId).catch(()=>showModuleRetry(view,id));break;
    case 'player-teams':void mountAdminPlayerTeams(view,api,verified.userId).catch(()=>showModuleRetry(view,id));break;
    case 'coach-teams':void mountAdminCoachTeams(view,api,verified.userId).catch(()=>showModuleRetry(view,id));break;
    case 'seasons':mountAdminSeasons(view,api,verified.userId);break;
    case 'matches':mountAdminMatches(view,api,verified.userId);break;
    case 'sport-review':void mountAdminSportReview(view,api,verified.userId,next=>{
     if(availableModules.some(module=>module.id===next))void selectSection(next);
    }).catch(()=>showModuleRetry(view,id));break;
    case 'events':mountAdminFreeEvents(view,api,verified.userId);break;
    case 'event-rules':void mountAdminAdvancedEvents(view,api,verified.userId).catch(()=>showModuleRetry(view,id));break;
    case 'entry-scan':void mountAdminFreeTicketScanner(view,api,verified.userId).catch(()=>showModuleRetry(view,id));break;
    case 'ticketing':void mountAdminTicketingReadiness(view,api,verified.userId,next=>{
     if(availableModules.some(module=>module.id===next))void selectSection(next);
    }).catch(()=>showModuleRetry(view,id));break;
    case 'editorial':void mountAdminEditorialStatus(view,api,verified.userId,next=>{
     if(availableModules.some(module=>module.id===next))void selectSection(next);
    }).catch(()=>showModuleRetry(view,id));break;
    case 'news':mountAdminNews(view,api,verified.userId);break;
    case 'news-revisions':void mountAdminNewsRevisions(view,api,verified.userId).catch(()=>showModuleRetry(view,id));break;
    case 'news-media':void mountAdminNewsMedia(view,api,verified.userId).catch(()=>showModuleRetry(view,id));break;
    case 'identity':void mountAuthenticatedClubIdentityEditor(view,api,verified.userId).catch(()=>showModuleRetry(view,id));break;
   }
   }catch{
    if(serial!==currentGeneration||!view.isConnected||active!==id)return;
    showModuleRetry(view,id);
   }
  }
  renderSidebar();
  await selectSection(active);
 }catch{
  if(serial!==currentGeneration||!root.isConnected)return;
  // On failure, discard every private node and offer a safe full re-check.
  root.replaceChildren(el('h2','','Service administratif temporairement indisponible'),
   el('p','admin-empty',adminFailureLabel('service')));
  const retry=el('button','admin-secondary-btn','Réessayer la vérification administrateur');
  retry.type='button';
  retry.addEventListener('click',()=>void mountAdminCenter(getClient));
  root.append(retry);
 }
}
