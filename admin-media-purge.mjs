/** Two-phase, retryable deletion of an approved private media asset.
 * Phase 1 commits a DB tombstone; Phase 2 calls Storage API; Phase 3
 * verifies file absence and removes the media metadata. Never delete via SQL.
 */
import {adminSessionStatus} from './admin-security.mjs';
import {safeMediaPath} from './news-media-gallery.mjs';

export const MEDIA_PURGE_BUCKET='boissy-uj-approved';
export function mediaPurgeTarget(assets,id){
 if(typeof id!=='string'||!Array.isArray(assets))return null;
 const asset=assets.find(a=>a?.id===id);
 return asset&&safeMediaPath(asset.storage_path,asset.kind)?asset:null;
}
export function validPurgeTicket(ticket,target){
 return !!target&&ticket?.status==='pending'&&
  ticket.path===target.storage_path&&safeMediaPath(ticket.path,target.kind);
}
/** An ambiguous network result must never be described as a successful wipe. */
export async function purgePrivateMedia(api,userId,asset){
 if(!asset||!api?.storage?.from||!api?.rpc)
  return {status:'invalid'};
 const auth=await adminSessionStatus(api,userId);
 if(auth.status!=='admin'||auth.level!=='aal2')
  return {status:'unauthorized'};
 const started=await api.rpc('admin_begin_news_media_purge',{p_asset_id:asset.id});
 if(started.error||!started.data)return {status:'failed-before-withdrawal'};
 if(started.data.status==='completed')return {status:'completed'};
 if(!validPurgeTicket(started.data,asset))
  return {status:'pending',reason:'path-mismatch'};
 // A failed or interrupted Storage request leaves the server-side tombstone.
 // The same button safely retries after revalidating AAL2.
 try{
  const removed=await api.storage.from(MEDIA_PURGE_BUCKET).remove([started.data.path]);
  if(removed.error)return {status:'pending',reason:'storage-error'};
  const finished=await api.rpc('admin_finish_news_media_purge',{p_asset_id:asset.id});
  if(finished.error||finished.data!==true)
   return {status:'pending',reason:'finalize-error'};
  return {status:'completed'};
 }catch{return {status:'pending',reason:'network-error'};}
}
const el=(tag,cls='',message='')=>{
 const n=document.createElement(tag);if(cls)n.className=cls;
 if(message)n.textContent=message;return n;
};
export function mountAdminMediaPurge(root,api,userId,{
 assetSelect,assetsForPost,onPurged
}={}){
 if(!root?.isConnected||!assetSelect||typeof assetsForPost!=='function')return;
 const area=el('section','admin-media-purge');
 area.setAttribute('aria-label','Retrait définitif des médias');
 const title=el('h3','','Retirer et supprimer un média');
 const instructions=el('p','admin-workflow-status',
  'Sélectionne une fiche média ci-dessus. Le premier retrait bloque immédiatement de nouvelles signatures, puis le fichier privé est effacé. Cette action est irréversible. En cas de panne, la fiche reste masquée et tu peux relancer la purge.');
 const button=el('button','admin-secondary-btn','Préparer le retrait définitif');
 button.type='button';button.setAttribute('aria-describedby','admin-media-purge-message');
 const status=el('p','admin-workflow-status');
 status.id='admin-media-purge-message';
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 area.append(title,instructions,button,status);root.append(area);
 let pendingKey=null,busy=false;
 const current=()=>mediaPurgeTarget(assetsForPost(),assetSelect.value);
 const reset=()=>{pendingKey=null;button.textContent='Préparer le retrait définitif';};
 assetSelect.addEventListener('change',reset);
 button.addEventListener('click',async()=>{
  if(busy||!area.isConnected)return;
  const target=current();
  if(!target){status.textContent='Choisis d’abord un média enregistré, pas « Nouveau média ».';reset();return;}
  const key=target.id+'|'+target.storage_path;
  if(pendingKey!==key){
   pendingKey=key;
   button.textContent='Confirmer le retrait et la suppression irréversibles';
   status.textContent='Confirmation requise : ce média va être retiré de la galerie puis supprimé du bucket privé. Les anciens liens signés cessent de fonctionner une fois le fichier effacé.';
   return;
  }
  reset();busy=true;button.disabled=true;assetSelect.disabled=true;
  status.textContent='Retrait des droits et purge Storage en cours…';
  try{
   const result=await purgePrivateMedia(api,userId,target);
   if(!area.isConnected)return;
   if(result.status==='completed'){
    try{await onPurged?.();status.textContent='Purge confirmée : fichier absent du bucket et fiche média supprimée.';}
    catch{status.textContent='Purge confirmée, mais le rechargement de la liste a échoué. Actualise la page.';}
   }else if(result.status==='pending'){
    status.textContent='Média masqué par le serveur. Suppression physique non confirmée : vérifie la connexion puis relance le retrait sur cette fiche.';
   }else if(result.status==='unauthorized'){
    status.textContent='MFA AAL2 requise. Aucune nouvelle suppression lancée.';
   }else{
    status.textContent='Retrait non confirmé. Contrôle le service et tes droits avant de réessayer.';
   }
  }catch{
   if(area.isConnected)status.textContent='Résultat réseau incertain : actualise et vérifie la fiche avant une nouvelle tentative.';
  }finally{
   busy=false;
   if(area.isConnected){button.disabled=false;assetSelect.disabled=false;reset();}
  }
 });
 return area;
}
