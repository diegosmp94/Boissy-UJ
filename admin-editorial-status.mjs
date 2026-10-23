/** Step 59 editorial operations: read-only health of existing AAL2-gated RPCs.
 * No article text, member identity, Storage path or unreviewed media content
 * is ever passed to the admin DOM. Never a substitute for RLS or legal review.
 */
import {adminSessionStatus} from './admin-security.mjs';

const el=(tag,className='',text=null)=>{
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==null)node.textContent=String(text);
 return node;
};
const arrayResult=result=>!result?.error&&Array.isArray(result?.data)?result.data:null;
const safeCall=async execute=>{
 try{return await execute();}
 catch{return {error:true,data:null};}
};
export async function readEditorialOperationalStatus(api){
 const [postResult,mediaResult,reactionResult]=await Promise.all([
  safeCall(()=>api.rpc('admin_list_management_news')),
  safeCall(()=>api.rpc('admin_list_news_media')),
  safeCall(()=>api.from('news_reactions').select('post_id').limit(1))
 ]);
 const posts=arrayResult(postResult),media=arrayResult(mediaResult);
 // RLS permits only the caller's own reactions, so a successful empty list
 // establishes that the module is readable, not that members have voted.
 const reactionsAvailable=arrayResult(reactionResult)!==null;
 const now=Date.now();
 const isPublished=post=>post?.visibility==='public'&&
  post?.status==='published'&&post?.consent_reviewed===true&&
  Number.isFinite(Date.parse(post.published_at||''))&&
  Date.parse(post.published_at)<=now;
 const recorded=posts===null?null:posts.length;
 const published=posts===null?null:posts.filter(isPublished).length;
 const needsReview=posts===null?null:posts.filter(p=>!isPublished(p)).length;
 const visibleAssets=media===null?null:media.filter(a=>
  a?.visible===true&&a?.rights_reviewed===true).length;
 const awaitingRights=media===null?null:media.filter(a=>
  a?.visible!==true||a?.rights_reviewed!==true).length;
 return Object.freeze({
  postsAvailable:posts!==null,
  mediaAvailable:media!==null,
  reactionsAvailable,
  checkedArticles:recorded,
  publishedArticles:published,
  nonPublishedArticles:needsReview,
  checkedMedia:media===null?null:media.length,
  visibleRightsCheckedAssets:visibleAssets,
  notFullyApprovedAssets:awaitingRights,
  // Admin list RPCs enforce hard caps; summaries are only for rows returned.
  limitedArticles:recorded!==null&&recorded>=200,
  limitedMedia:media!==null&&media.length>=500
 });
}

export async function mountAdminEditorialStatus(root,api,userId,navigate){
 root.replaceChildren(el('h2','','Pilotage des actualités et médias'));
 const status=el('p','admin-workflow-status','Vérification administrateur MFA…');
 status.setAttribute('role','status');
 root.append(status);
 const role=await safeCall(()=>adminSessionStatus(api,userId));
 if(!root.isConnected)return;
 if(role.status!=='admin'){
  status.textContent='Accès refusé : rôle administrateur et MFA AAL2 requis.';
  return;
 }
 const explanation=el('p','admin-fff-info',
  'Diagnostic en lecture seule. Les chiffres sont calculés sur les dossiers visibles à ce compte, et non sur des estimations. Les droits à l’image, les migrations et la publication sont vérifiés séparément avant mise en ligne.');
 root.append(explanation);
 const refresh=el('button','admin-secondary-btn','Actualiser les contrôles');
 refresh.type='button';
 const grid=el('div','real-admin-kpis');
 const actions=el('div','admin-overview-shortcuts');
 root.append(refresh,grid,actions);
 const buttons=el('div','admin-shortcut-grid');
 actions.append(el('h3','','Accès éditorial'),buttons);
 const target=(id,title)=>{
  const b=el('button','admin-shortcut',title);
  b.type='button';
  b.addEventListener('click',()=>{if(root.isConnected&&typeof navigate==='function')navigate(id);});
  buttons.append(b);
 };
 target('news','Ouvrir les actualités');
 let nonce=0,busy=false;
 const update=async()=>{
  if(busy||!root.isConnected)return;
  busy=true;refresh.disabled=true;
  const version=++nonce;
  status.textContent='Lecture des publications et des modules…';
  try{
   const auth=await safeCall(()=>adminSessionStatus(api,userId));
   if(!root.isConnected||version!==nonce)return;
   if(auth.status!=='admin'){
    grid.replaceChildren();buttons.replaceChildren();
    status.textContent='Session administrateur MFA perdue. Diagnostic arrêté.';return;
   }
   const report=await readEditorialOperationalStatus(api);
   if(!root.isConnected||version!==nonce)return;
   grid.replaceChildren();
   const entries=[
    ['Dossiers d’actualités',report.checkedArticles],
    ['Articles publiés et autorisés',report.publishedArticles],
    ['Articles à valider / brouillons',report.nonPublishedArticles],
    ['Médias enregistrés',report.checkedMedia],
    ['Médias marqués visibles avec droits revus',report.visibleRightsCheckedAssets],
    ['Médias à vérifier',report.notFullyApprovedAssets]
   ];
   for(const [label,value] of entries){
    const card=el('div','real-admin-kpi');
    card.append(el('span','',label),el('strong','',
     value===null?'Non disponible':String(value)));
    grid.append(card);
   }
   const reactions=el('p','admin-workflow-status',
    report.reactionsAvailable
      ?'Réactions : table accessible pour ce compte, tests RLS croisés encore nécessaires.'
      :'Réactions : non disponibles ou lecture refusée ; la migration et les droits restent à vérifier.');
   const media=el('p','admin-workflow-status',
    report.mediaAvailable
     ?'Galeries : liste admin accessible, publication soumise au contrôle Storage et aux autorisations.'
     :'Galeries : gestion indisponible jusqu’à la migration et à la recette des droits.');
   const news=el('p','admin-workflow-status',
    report.postsAvailable
     ?'Actualités : éditeur et publication contrôlés par les validations serveur.'
     :'Actualités : catalogue de gestion indisponible, aucune publication lancée.');
   const cap=el('p','admin-fff-info',
    report.limitedArticles||report.limitedMedia
     ?'Résultats partiels : plafond de dossiers atteint ; ces chiffres ne sont pas des totaux globaux.'
     :'Aucun total fictif ni média privé affiché dans ce diagnostic.');
   grid.after(news,media,reactions,cap);
   buttons.replaceChildren();
   target('news','Gérer les actualités');
   if(report.mediaAvailable)target('news-media','Gérer les photos et vidéos');
   status.textContent='Lecture terminée. Aucun dossier, média ou rôle n’a été modifié.';
  }catch{
   if(root.isConnected&&version===nonce)status.textContent='Diagnostic indisponible. Aucune modification effectuée.';
  }finally{
   busy=false;if(refresh.isConnected)refresh.disabled=false;
  }
 };
 refresh.addEventListener('click',()=>void update());
 void update();
}
