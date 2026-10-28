/** Read-only operational readiness panel.
 * Every query runs only after a verified admin MFA AAL2 session.
 * A green probe proves read access for THIS admin, never cross-account isolation.
 */
import {adminSessionStatus} from './admin-security.mjs';
import {remainingWorkstreams,workstreamCounts} from './open-workstreams.mjs';
import {PUBLIC_RELEASE_LOCKS,PUBLIC_RELEASE_MODE} from './public-release-locks.mjs';

export const READINESS_CHECKS=Object.freeze([
 {id:'teams',title:'Catalogue des cinq équipes',group:'Sport',detail:'Les équipes sont consultables dans Supabase.'},
 {id:'matches',title:'Gestion des rencontres',group:'Sport',detail:'La lecture protégée des rencontres répond.'},
 {id:'coaches',title:'Affectations entraîneurs',group:'Sport',detail:'La lecture administrative des affectations répond pour une équipe réelle.'},
 {id:'events',title:'Événements gratuits',group:'Sport',detail:'Le catalogue administratif des événements gratuits répond.'},
 {id:'roles',title:'Demandes de rôles',group:'Comptes',detail:'La table des demandes est lisible pour cette session administrateur.'},
 {id:'news',title:'Actualités administratives',group:'Contenus',detail:'Le catalogue de rédaction protégé répond.'},
 {id:'reactions',title:'Réactions aux articles',group:'Contenus',detail:'La table des réactions répond en lecture propre au compte.'},
 {id:'media',title:'Gestion des photos et vidéos',group:'Contenus',detail:'La liste protégée des médias répond.'},
 {id:'media-preflight',title:'Vérification des fichiers médias',group:'Contenus',detail:'Le contrôle en lecture seule des fichiers Storage répond.'}
]);
export const MANUAL_RELEASE_GATES=Object.freeze([
 'Recette réelle AAL1 / AAL2 et supporter / joueur / entraîneur / administrateur avec plusieurs comptes autorisés.',
 'Validation par l’association des droits à l’image, du RGPD, des mineurs et des coordonnées officielles.',
 'Restauration d’une sauvegarde sur un environnement isolé, avec preuve horodatée et sans données personnelles.',
 'Essais sur Safari iPhone, Chrome Android, clavier et technologies d’assistance.',
 'Approbation explicite du responsable avant les médias, les paiements ou toute collecte supplémentaire.'
]);

export function checkResult(result,valid){
 return result&&!result.error&&valid(result.data)?'accessible':'unverified';
}
const arrays=r=>checkResult(r,Array.isArray);
export function summarizeReadiness(rows){
 const passed=rows.filter(row=>row.status==='accessible').length;
 return {passed,total:rows.length,unverified:rows.length-passed};
}

/** No writes. Query errors are not interpreted as proof that a migration is absent.
 * Data returned by privileged list RPCs is discarded, never placed in the DOM.
 */
export async function readBackendReadiness(api){
 let teamResult;
 try{
  teamResult=await api.from('club_teams').select('id').limit(10);
 }catch{teamResult={error:true,data:[]};}
 const teamsOk=arrays(teamResult)==='accessible'&&
  teamResult.data.length===5&&teamResult.data.every(t=>typeof t.id==='string');
 const teamId=teamsOk?teamResult.data[0]?.id:null;
 const guarded=async fn=>{
  try{return await fn();}catch{return {error:true,data:null};}
 };
 const probes={
  teams:()=>Promise.resolve({error:!teamsOk,data:teamsOk?[]:null}),
  matches:()=>api.rpc('admin_list_management_matches'),
  coaches:()=>teamId?api.rpc('admin_list_team_coaches',{p_team_id:teamId}):
   Promise.resolve({error:true,data:null}),
  events:()=>api.rpc('admin_list_free_events'),
  roles:()=>api.from('role_requests').select('id').eq('status','pending').limit(1),
  news:()=>api.rpc('admin_list_management_news'),
  reactions:()=>api.from('news_reactions').select('post_id').limit(1),
  media:()=>api.rpc('admin_list_news_media'),
  'media-preflight':()=>api.rpc('admin_check_news_media_file',{
   p_kind:'photo',p_path:'diagnostic/fichier-absent.webp'
  })
 };
 const responses=await Promise.all(READINESS_CHECKS.map(async check=>{
  const result=await guarded(probes[check.id]);
  const status=check.id==='media-preflight'?
   checkResult(result,value=>typeof value==='boolean'):arrays(result);
  return {...check,status};
 }));
 return responses;
}

const el=(tag,cls='',content=null)=>{
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(content!==null)n.textContent=String(content);
 return n;
};

export async function mountAdminReadiness(root,api,userId){
 root.replaceChildren(el('h2','','État de mise en service'));
 const status=el('p','admin-workflow-status','Vérification des droits…');
 status.setAttribute('role','status');
 status.setAttribute('aria-live','polite');
 root.append(status);
 const verified=await adminSessionStatus(api,userId);
 if(!root.isConnected)return;
 if(verified.status!=='admin'){
  status.textContent='Accès refusé : administrateur MFA AAL2 requis.';
  return;
 }
 const explanation=el('p','admin-fff-info',
  'Ce diagnostic interroge seulement les lectures autorisées pour ton compte administrateur. '+
  '« Accessible » signifie que le service répond, pas que les permissions multi-comptes, le RGPD ou une restauration sont homologués. '+
  'Une erreur ou un accès refusé donne « Non confirmé », jamais un faux succès.');
 const run=el('button','admin-secondary-btn','Relancer le diagnostic');
 run.type='button';
 const results=el('div','admin-readiness-results');
 const gates=el('section','admin-readiness-gates');
 gates.append(el('h3','','Chantiers restants — les tâches terminées sont retirées'));
 const pendingSummary=el('p','admin-workflow-status');
 pendingSummary.setAttribute('role','status');
 const pendingList=el('div','admin-active-chantiers');
 gates.append(pendingSummary,pendingList);
 const releaseStatus=el('section','admin-readiness-gates');
 releaseStatus.append(el('h3','','Préparation SEO et verrous de publication'));
 releaseStatus.append(el('p','admin-fff-info',
  'Le site public reste non indexable. Ces indicateurs sont des verrous de compilation, PAS une confirmation des autorisations Supabase, Stripe ou FFF.'));
 const releaseList=el('ul','admin-readiness-list');
 const previewMode=PUBLIC_RELEASE_MODE==='technical-preview-noindex';
 const launchFlags=Object.entries(PUBLIC_RELEASE_LOCKS);
 releaseList.append(el('li','admin-readiness-item',
  'Indexation du site : '+(previewMode&&!PUBLIC_RELEASE_LOCKS.indexing?
   'désactivée (robots.txt et noindex)':'configuration à vérifier')));
 for(const [name,enabled] of launchFlags){
  if(name==='indexing')continue;
  releaseList.append(el('li','admin-readiness-item',
   name+' : '+(enabled?'ATTENTION — nécessite une nouvelle homologation':
    'verrouillé dans le build public')));
 }
 releaseStatus.append(releaseList);
 root.append(explanation,releaseStatus,run,gates,results);
 let loading=false,revision=0;
 const refresh=async()=>{
  if(loading||!root.isConnected)return;
  loading=true;run.disabled=true;
  const id=++revision;
  status.textContent='Diagnostic en lecture seule…';
  try{
   const check=await adminSessionStatus(api,userId);
   if(!root.isConnected||id!==revision)return;
   if(check.status!=='admin'){
    results.replaceChildren();
    status.textContent='Diagnostic arrêté : MFA ou droits administrateur expirés.';
    return;
   }
   const checks=await readBackendReadiness(api);
   if(!root.isConnected||id!==revision)return;
   results.replaceChildren();
   const stats=summarizeReadiness(checks);
   status.textContent=stats.passed+' / '+stats.total+
    ' lectures techniques accessibles ; '+stats.unverified+
    ' non confirmée(s). Aucune recette finale n’est déduite de ce total.';
   // Keep already functioning modules OUT of the active worklist.
   // Passing a probe closes a technical integration only, never a manual signoff.
   const toDo=remainingWorkstreams(checks);
   const todoCounts=workstreamCounts(toDo);
   pendingSummary.textContent=todoCounts.total+' chantier(s) encore ouvert(s) : '+
    todoCounts.p1+' P1, '+todoCounts.p2+' P2, '+todoCounts.p3+
    ' P3. Ce décompte ne constitue pas un score d’homologation.';
   pendingList.replaceChildren();
   for(const priority of ['P1','P2','P3']){
    const items=toDo.filter(work=>work.priority===priority);
    if(!items.length)continue;
    const section=el('section','admin-workstream-section');
    section.append(el('h4','',priority+' — '+items.length+' restant(s)'));
    const entries=el('ul','admin-workstream-list');
    for(const work of items){
     const item=el('li','admin-workstream-item');
     item.append(el('strong','',work.title),
      el('p','','Suite : '+work.next),
      el('small','','Prérequis : '+work.dependency));
     entries.append(item);
    }
    section.append(entries);pendingList.append(section);
   }
   const details=el('details','admin-readiness-technical');
   details.append(el('summary','','Examiner les contrôles techniques (y compris ceux déjà accessibles)'));
   const ul=el('ul','admin-readiness-list');
   for(const check of checks){
    const item=el('li','admin-readiness-item');
    item.dataset.status=check.status;
    const header=el('div','admin-readiness-item-head');
    header.append(el('strong','',check.title),
     el('span','admin-readiness-state',check.status==='accessible'?'Accessible':'Non confirmé'));
    item.append(header,el('p','',check.detail));
    ul.append(item);
   }
   details.append(ul);
   results.append(details);
  }catch{
   if(root.isConnected&&id===revision){
    results.replaceChildren();
    status.textContent='Diagnostic indisponible. Aucun résultat inventé.';
   }
  }finally{
   loading=false;
   if(run.isConnected)run.disabled=false;
  }
 };
 run.addEventListener('click',()=>void refresh());
 await refresh();
}
