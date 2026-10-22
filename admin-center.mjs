/** Protected administration hub. No preview-only controls are mounted anywhere.
 * All protected data is loaded after getUser + MFA AAL2 + admin role verification.
 */
import {supabaseConfig} from './auth-config.mjs';
import {adminSessionStatus} from './admin-security.mjs';
import {mountAdminRoleModeration} from './admin-role-moderation.mjs';
import {mountAuthenticatedClubIdentityEditor} from './club-editor.mjs';
import {mountAuthenticatedTeamPeopleEditor} from './team-person-editor.mjs';
import {mountAdminMembers} from './admin-users.mjs';
import {mountAdminPlayerTeams} from './admin-player-teams.mjs';
import {mountAdminCoachTeams} from './admin-coach-teams.mjs';
import {mountAdminSeasons,mountAdminMatches,mountAdminNews,mountAdminFreeEvents} from './admin-management.mjs';
import {filterAdminModules,groupAdminModules,availableAdminModules} from './admin-navigation.mjs';

export const ADMIN_MODULES=Object.freeze([
 {id:'overview',name:'Vue générale',group:'Pilotage',caption:'Données réelles, aucun chiffre fictif'},
 {id:'users',name:'Membres et rôles',group:'Pilotage',caption:'Consultation et retraits validés'},
 {id:'approvals',name:'Validation des rôles',group:'Pilotage',caption:'Demandes et approbations MFA'},
 {id:'teams',name:'Effectifs publics',group:'Sport',caption:'Brouillons et publication contrôlée'},
 {id:'player-teams',name:'Affectations joueurs',group:'Sport',caption:'Rattachement sécurisé des joueurs aux équipes'},
 {id:'coach-teams',name:'Affectations entraîneurs',group:'Sport',caption:'Gérer les équipes attribuées aux éducateurs'},  
 {id:'seasons',name:'Saisons',group:'Sport',caption:'Gestion des saisons sportives'},
 {id:'matches',name:'Matchs et résultats',group:'Sport',caption:'Rencontres officielles du club'},
 {id:'events',name:'Événements gratuits',group:'Sport',caption:'Agenda sans billetterie ni paiements'}, 
 {id:'news',name:'Actualités',group:'Contenu',caption:'Articles et droits de publication'},
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
export function adminCenterMarkup(){
 return '<div id="real-admin-root" class="real-admin-root" aria-live="polite"><p role="status">Vérification de l’accès administrateur…</p></div>';
}
export function unmountAdminCenter(){
 currentGeneration++;
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
  api=await getClient();
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
  // Fail-closed: do not show an editor without its MFA-only database RPC.
  const eventProbe=await api.rpc('admin_list_free_events');
  if(serial!==currentGeneration||!root.isConnected)return;
  const eventsReady=!eventProbe.error&&Array.isArray(eventProbe.data);
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
  const availableModules=availableAdminModules(ADMIN_MODULES,{eventsReady});
  const navTools=el('div','admin-nav-tools');
  const navLabel=el('label','admin-nav-label','Trouver un module');
  const moduleSearch=el('input','admin-nav-search');
  moduleSearch.type='search';moduleSearch.placeholder='Membres, matchs, actualités…';
  moduleSearch.autocomplete='off';moduleSearch.maxLength=80;
  moduleSearch.setAttribute('aria-label','Rechercher un module administrateur');
  const navCount=el('span','admin-nav-count');
  navCount.setAttribute('role','status');navCount.setAttribute('aria-live','polite');
  navLabel.append(moduleSearch);navTools.append(navLabel,navCount);
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
   const [teams,requests,matches,posts]=await Promise.all([
    api.from('club_teams').select('id').limit(100),
    api.from('role_requests').select('id').eq('status','pending').limit(100),
    api.rpc('admin_list_management_matches'),
    api.rpc('admin_list_management_news')
   ]);
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
  async function selectSection(id){
   active=id;
   for(const item of sidebar.querySelectorAll('button[data-module]')){
    item.setAttribute('aria-current',String(item.dataset.module===id));
   }
   // Distinct DOM root per module: pending requests from a previous module can no longer paint the current one.
   const view=el('div','admin-module-instance');
   pane.replaceChildren(view);
   view.append(el('p','admin-workflow-status','Vérification du rôle et du second facteur…'));
   // Must re-check identity and MFA before showing private data on every module change.
   const check=await adminSessionStatus(api,verified.userId);
   if(serial!==currentGeneration||!view.isConnected||active!==id)return;
   if(!canOpenAdmin(check,supabaseConfig.adminEnabled)){
    view.replaceChildren(el('p','admin-empty','Accès suspendu : droits administrateur ou MFA à renouveler.'));
    return;
   }
   view.replaceChildren();
   switch(id){
    case 'overview':await overview(view);break;
    case 'users':void mountAdminMembers(view,api,verified.userId);break;
    case 'approvals':void mountAdminRoleModeration(view,api,verified.userId);break;
    case 'teams':void mountAuthenticatedTeamPeopleEditor(view,api,verified.userId);break;
    case 'player-teams':void mountAdminPlayerTeams(view,api,verified.userId);break;
    case 'coach-teams':void mountAdminCoachTeams(view,api,verified.userId);break;
    case 'seasons':mountAdminSeasons(view,api,verified.userId);break;
    case 'matches':mountAdminMatches(view,api,verified.userId);break;
    case 'events':mountAdminFreeEvents(view,api,verified.userId);break;
    case 'news':mountAdminNews(view,api,verified.userId);break;
    case 'identity':void mountAuthenticatedClubIdentityEditor(view,api,verified.userId);break;
   }
  }
  renderSidebar();
  await selectSection(active);
 }catch{
  if(serial!==currentGeneration||!root.isConnected)return;
  root.replaceChildren(el('h2','','Service administratif temporairement indisponible'),
   el('p','admin-empty','Impossible de vérifier ton rôle et le MFA. Aucun privilège n’est accordé.'));
 }
}
