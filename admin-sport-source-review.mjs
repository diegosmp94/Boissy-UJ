/** Step 62: MFA-only source review. READ-ONLY; never an importer or FFF synchronizer. */
import {adminSessionStatus} from './admin-security.mjs';
import {publicExternalFixtures,EXTERNAL_FIXTURE_REVIEWED_AT} from './external-match-previews.mjs';
import {sportSourceReview,sportReviewTeamCounts,SPORT_REVIEW_STATUSES} from './sport-source-review.mjs';
const el=(tag,cls='',txt=null)=>{
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(txt!==null)n.textContent=String(txt);
 return n;
};
async function safeCall(fn){
 try{return await fn();}catch{return {error:true,data:null};}
}
export async function readSportPublicationState(api,{now=Date.now()}={}){
 const [teamsReply,matchesReply,newsReply]=await Promise.all([
  safeCall(()=>api.from('club_teams').select('id,code,name')),
  safeCall(()=>api.rpc('admin_list_management_matches')),
  safeCall(()=>api.rpc('admin_list_management_news'))
 ]);
 const teamsAvailable=Array.isArray(teamsReply?.data)&&!teamsReply.error;
 const matchesAvailable=Array.isArray(matchesReply?.data)&&!matchesReply.error;
 const newsAvailable=Array.isArray(newsReply?.data)&&!newsReply.error;
 const teams=teamsAvailable?teamsReply.data:[];
 const matches=matchesAvailable?matchesReply.data:[];
 const news=newsAvailable?newsReply.data:[];
 const sourced=publicExternalFixtures({
  now,season:'2026-2027',period:'all',includePast:true
 });
 const report=sportSourceReview(sourced,matches,teams,now);
 const publishedMatches=matchesAvailable
  ?matches.filter(m=>m.published===true).length:null;
 const publicNews=newsAvailable
  ?news.filter(p=>p.status==='published'&&p.visibility==='public'&&
    p.consent_reviewed===true&&Number.isFinite(Date.parse(p.published_at||''))&&
    Date.parse(p.published_at)<=now).length:null;
 return Object.freeze({
  sourcesReviewedAt:EXTERNAL_FIXTURE_REVIEWED_AT,
  report,teamCounts:sportReviewTeamCounts(report),
  matchesAvailable,teamsAvailable,newsAvailable,publishedMatches,publicNews,
  unverifiedSourceCount:report.needsReview,
  clubPublicationPerformed:false,
  reportMayBePartial:matches.length>=250||news.length>=200
 });
}
export async function mountAdminSportReview(root,api,userId,navigate){
 root.replaceChildren(el('h2','','Revue des sources sportives'));
 const status=el('p','admin-workflow-status','Vérification du rôle et du MFA…');
 status.setAttribute('role','status');root.append(status);
 let checked;
 try{checked=await adminSessionStatus(api,userId);}catch{checked=null;}
 if(!root.isConnected)return;
 if(checked?.status!=='admin'){
  status.textContent='Accès refusé : administrateur MFA requis.';return;
 }
 root.append(el('p','admin-fff-info',
  'Les calendriers et scores tiers ne sont pas homologués par le club. Cette revue ne publie, importe, ni annonce aucun résultat. Ne pas confondre Boissy UJ et Boissy FC.'));
 const refresh=el('button','admin-secondary-btn','Actualiser les vérifications');
 refresh.type='button';
 const actions=el('div','admin-overview-shortcuts');
 const go=el('button','admin-shortcut','Ouvrir la gestion des matchs');
 go.type='button';
 go.addEventListener('click',()=>{if(root.isConnected&&typeof navigate==='function')navigate('matches');});
 actions.append(go);
 const summary=el('div','real-admin-kpis');
 const list=el('div','admin-active-chantiers');
 root.append(refresh,actions,summary,list);
 let busy=false,nonce=0;
 async function update(){
  if(busy||!root.isConnected)return;
  busy=true;refresh.disabled=true;
  const seq=++nonce;status.textContent='Comparaison des références et dossiers sportifs…';
  try{
   const verification=await adminSessionStatus(api,userId);
   if(!root.isConnected||nonce!==seq)return;
   if(verification.status!=='admin'){
    summary.replaceChildren();list.replaceChildren();
    status.textContent='Session MFA expirée. Revue interrompue.';return;
   }
   const result=await readSportPublicationState(api);
   if(!root.isConnected||nonce!==seq)return;
   summary.replaceChildren();list.replaceChildren();
   const values=[
    ['Rencontres du club publiées',result.publishedMatches],
    ['Actualités publiques autorisées',result.publicNews],
    ['Références externes à revoir',result.unverifiedSourceCount],
    ['Conflits détectés',result.report.counts.conflict],
    ['Scores issus de tiers',result.report.counts.source_result]
   ];
   for(const [label,value] of values){
    const card=el('div','real-admin-kpi');
    card.append(el('span','',label),el('strong','',
      value===null?'Indisponible':String(value)));
    summary.append(card);
   }
   status.textContent=!result.matchesAvailable||!result.teamsAvailable
    ?'Dossiers du club indisponibles : comparaison partielle, aucune validation possible.'
    :'Relevé externe du '+result.sourcesReviewedAt+' · aucune validation automatique.';
   if(result.reportMayBePartial){
    list.append(el('p','admin-fff-info',
      'Liste des dossiers plafonnée : les chiffres ne sont pas forcément exhaustifs.'));
   }
   for(const team of result.teamCounts){
    const article=el('article','admin-active-workstream');
    article.append(el('strong','',team.name),
      el('p','',team.pending+' référence(s) à examiner sur '+team.sourced));
    list.append(article);
   }
   list.append(el('h3','','Références récentes · contrôle manuel obligatoire'));
   const outstanding=result.report.records.filter(item=>item.kind!=='recorded')
    .filter(item=>item.localDay>='2026-10-01').slice(0,30);
   for(const item of outstanding){
    const row=el('article','admin-active-workstream');
    row.append(el('strong','',item.localDay+' · '+item.opponent),
      el('p','',item.competition+' · '+(SPORT_REVIEW_STATUSES[item.kind]||'À vérifier')),
      el('p','','Source : '+item.sourceName+' · non homologuée'));
    list.append(row);
   }
   if(!outstanding.length)
    list.append(el('p','admin-workflow-status','Aucune référence récente en attente de revue.'));
   list.append(el('p','admin-fff-info',
    'Avant de publier une rencontre ou une actualité, un responsable habilité doit vérifier la source, le droit de reprise et les résultats via les éditeurs sécurisés.'));
  }catch{
   if(root.isConnected)status.textContent='Revue indisponible. Aucun changement effectué.';
  }finally{busy=false;if(refresh.isConnected)refresh.disabled=false;}
 }
 refresh.addEventListener('click',()=>void update());
 void update();
}
