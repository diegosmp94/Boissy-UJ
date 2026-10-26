/** AAL2-only news revision browsing and draft restoration.
 * Raw internal audit JSON is never returned to the browser. This module is
 * hidden unless its staging-tested read RPC is installed.
 */
import {adminSessionStatus} from './admin-security.mjs';

const element=(tag,cls='',value=null)=>{
 const e=document.createElement(tag);
 if(cls)e.className=cls;
 if(value!==null)e.textContent=String(value);
 return e;
};
export const revisionLabels=Object.freeze({
 create_draft:'Création du brouillon',
 create_publish:'Première publication',
 edit_draft:'Mise à jour du brouillon',
 edit_publish:'Mise à jour publiée',
 unpublish:'Dépublication',
 restore_draft:'Restauration en brouillon'
});
export function revisionSafetySummary(revision){
 if(!revision||!Number.isSafeInteger(revision.revision_id)||
   revision.revision_id<1)return null;
 return {id:revision.revision_id,
  label:revisionLabels[revision.action]||'Révision enregistrée',
  title:String(revision.title||''),
  excerpt:String(revision.excerpt||''),
  body:String(revision.body||''),
  wasPublished:revision.was_published===true};
}
export async function mountAdminNewsRevisions(root,api,userId){
 if(!root)return;
 const heading=element('h2','','Historique et restauration des actualités');
 const expl=element('p','admin-workflow-status',
  'Restauration en brouillon uniquement : une ancienne publication ne peut pas être remise en ligne automatiquement. Les droits à l’image devront être revérifiés.');
 const status=element('p','admin-workflow-status','Vérification MFA…');
 status.setAttribute('role','status');
 const articleLabel=element('label','admin-form-field','Article à consulter');
 const articleSelect=element('select','admin-form-control');
 articleSelect.setAttribute('aria-label','Article dont consulter les versions');
 articleLabel.append(articleSelect);
 const refresh=element('button','admin-secondary-btn','Actualiser les versions');
 refresh.type='button';
 const historyLabel=element('label','admin-form-field','Version enregistrée');
 const revisionsSelect=element('select','admin-form-control');
 revisionsSelect.setAttribute('aria-label','Version à consulter et à restaurer');
 historyLabel.append(revisionsSelect);
 const preview=element('section','admin-revision-preview');
 preview.setAttribute('aria-label','Aperçu privé de la version');
 const confirmation=element('label','admin-form-field','');
 const confirmCheck=element('input','','');
 confirmCheck.type='checkbox';
 const text=element('span','','Je confirme : restaurer ce contenu comme brouillon non publié, avec nouvelle validation des droits avant publication.');
 confirmation.append(confirmCheck,text);
 const restore=element('button','admin-primary-btn','Restaurer la version en brouillon');
 restore.type='button';restore.disabled=true;
 const buttons=element('div','admin-editor-list-actions');
 buttons.append(refresh,restore);
 root.replaceChildren(heading,expl,status,articleLabel,historyLabel,preview,
  confirmation,buttons);
 let articles=[],revisions=[],requestNumber=0,busy=false;

 async function ensureAdmin(){
  const access=await adminSessionStatus(api,userId);
  return access.status==='admin'&&access.level==='aal2';
 }
 function setStatus(message){if(root.isConnected)status.textContent=message;}
 function selectedArticle(){return articles.find(a=>a.id===articleSelect.value)||null;}
 function selectedRevision(){return revisions.find(r=>String(r.revision_id)===revisionsSelect.value)||null;}
 function paint(){
  const revision=revisionSafetySummary(selectedRevision());
  const current=selectedArticle();
  preview.replaceChildren();
  if(!revision||!current){
   preview.append(element('p','','Sélectionne un article et une version pour examiner son contenu.'));
   restore.disabled=true;return;
  }
  const published=revision.wasPublished?'Était publiée':'Était un brouillon';
  preview.append(element('p','admin-revision-label',revision.label+' · '+published),
   element('h3','',revision.title),
   element('p','',revision.excerpt),
   element('pre','admin-revision-body',revision.body),
   element('p','admin-workflow-status',
    'Version historique · restauration possible en brouillon uniquement, sans modifier l’équipe de l’article.'));
  restore.disabled=busy||!confirmCheck.checked;
 }
 async function loadVersions(){
  const target=selectedArticle(),call=++requestNumber;
  revisions=[];revisionsSelect.replaceChildren();
  confirmCheck.checked=false;
  if(!target){paint();return;}
  if(!await ensureAdmin()){
   setStatus('Droits administrateur ou MFA AAL2 non vérifiés.');restore.disabled=true;return;
  }
  try{
   const result=await api.rpc('admin_list_news_revisions',{p_post_id:target.id});
   if(!root.isConnected||call!==requestNumber)return;
   if(result.error||!Array.isArray(result.data))throw new Error('Protected history not ready');
   revisions=result.data;
   for(const rev of revisions){
    if(!revisionSafetySummary(rev))continue;
    const o=element('option','',
      (revisionLabels[rev.action]||'Version')+' · '+new Date(rev.recorded_at).toLocaleString('fr-FR'));
    o.value=String(rev.revision_id);revisionsSelect.append(o);
   }
   setStatus(revisions.length+' version(s) accessibles · aucune modification effectuée.');
   paint();
  }catch{
   setStatus('Historique indisponible. Aucune restauration possible.');
   restore.disabled=true;preview.replaceChildren();
  }
 }
 async function loadArticles(preferred=null){
  const call=++requestNumber;
  restore.disabled=true;
  confirmCheck.checked=false;
  if(!await ensureAdmin()){
   setStatus('Droits administrateur ou MFA AAL2 non vérifiés.');return;
  }
  try{
   const r=await api.rpc('admin_list_management_news');
   if(!root.isConnected||call!==requestNumber)return;
   if(r.error||!Array.isArray(r.data))throw new Error('Article list not available');
   articles=r.data.filter(a=>a.id&&a.updated_at&&a.content_kind==='article'&&a.visibility==='public');
   articleSelect.replaceChildren();
   for(const article of articles){
    const o=element('option','',article.title+' · '+(article.status==='published'?'Publié':'Non publié'));
    o.value=article.id;articleSelect.append(o);
   }
   if(preferred&&articles.some(a=>a.id===preferred))articleSelect.value=preferred;
   if(!articles.length){
    setStatus('Aucun article enregistré. Aucun historique à restaurer.');
    revisions=[];paint();return;
   }
   await loadVersions();
  }catch{
   setStatus('Le catalogue privé ne peut pas être chargé.');
   restore.disabled=true;
  }
 }
 articleSelect.addEventListener('change',()=>void loadVersions());
 revisionsSelect.addEventListener('change',()=>{confirmCheck.checked=false;paint();});
 confirmCheck.addEventListener('change',paint);
 refresh.addEventListener('click',()=>{if(!busy)void loadArticles(selectedArticle()?.id);});
 restore.addEventListener('click',async()=>{
  if(busy||restore.disabled||!root.isConnected||!confirmCheck.checked)return;
  const article=selectedArticle(),revision=selectedRevision();
  if(!article||!revision)return;
  busy=true;restore.disabled=true;refresh.disabled=true;
  articleSelect.disabled=true;revisionsSelect.disabled=true;confirmCheck.disabled=true;
  confirmCheck.checked=false;
  setStatus('Nouvelle vérification des droits et restauration sécurisée…');
  try{
   if(!await ensureAdmin())throw new Error('No longer administrator MFA');
   if(!root.isConnected||selectedArticle()?.id!==article.id||
      selectedRevision()?.revision_id!==revision.revision_id)return;
   const response=await api.rpc('admin_restore_news_revision',{
    p_post_id:article.id,
    p_revision_id:revision.revision_id,
    p_expected_updated_at:article.updated_at
   });
   if(!root.isConnected)return;
   if(response.error||response.data!==true){
    setStatus('Restauration refusée : version, permissions ou conflit de modification. Actualise le dossier.');
    return;
   }
   setStatus('Version restaurée comme brouillon non publié. Les droits doivent être revérifiés avant publication.');
   await loadArticles(article.id);
  }catch{setStatus('Restauration non confirmée. Aucun succès n’est annoncé.');}
  finally{
   busy=false;
   if(root.isConnected){
    refresh.disabled=false;articleSelect.disabled=false;
    revisionsSelect.disabled=false;confirmCheck.disabled=false;
    paint();
   }
  }
 });
 void loadArticles();
}
