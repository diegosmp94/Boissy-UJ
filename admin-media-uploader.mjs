/** MFA AAL2 private media deposit: draft metadata FIRST, create-only upload SECOND.
 * The upload never approves or displays an image. No public URL or key is used.
 */
import {adminSessionStatus} from './admin-security.mjs';

export const MEDIA_UPLOAD_BUCKET='boissy-uj-approved';
export const MEDIA_MAX_BYTES=50_000_000;
export const PHOTO_MAX_BYTES=12_000_000;
const TYPES=Object.freeze({
 'image/jpeg':{kind:'photo',ext:['jpg','jpeg']},
 'image/png':{kind:'photo',ext:['png']},
 'image/webp':{kind:'photo',ext:['webp']},
 'image/avif':{kind:'photo',ext:['avif']},
 'video/mp4':{kind:'video',ext:['mp4']},
 'video/webm':{kind:'video',ext:['webm']}
});
export function validateMediaDeposit(file,{postId,alt,rights,count}){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(postId||''))
  return 'Sélectionne une actualité enregistrée.';
 if(!file||typeof file.name!=='string'||typeof file.type!=='string'
    ||!Number.isSafeInteger(file.size)||file.size<1)
  return 'Choisis un fichier photo ou vidéo non vide.';
 const type=TYPES[file.type];
 const extension=file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
 if(!type||!type.ext.includes(extension))
  return 'Format non autorisé : JPEG, PNG, WebP, AVIF, MP4 ou WebM uniquement.';
 if(file.size>(type.kind==='photo'?PHOTO_MAX_BYTES:MEDIA_MAX_BYTES))
  return type.kind==='photo'?'Photo trop volumineuse (12 Mo maximum).':'Vidéo trop volumineuse (50 Mo maximum).';
 if(typeof alt!=='string'||alt.trim().length<4||alt.trim().length>200)
  return 'Renseigne une description accessible de 4 à 200 caractères.';
 if(rights!==true)return 'Confirme les autorisations nécessaires au dépôt, notamment pour les personnes identifiables.';
 if(!Number.isInteger(count)||count<0||count>=12)
  return 'Cet article comporte déjà 12 médias ou son quota ne peut pas être vérifié.';
 return null;
}
export function mediaDepositInfo(file){
 const extension=file?.name?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
 const type=TYPES[file?.type];
 if(!type?.ext.includes(extension))return null;
 return {kind:type.kind,extension};
}
/** Check the first bytes, not merely a user-supplied filename or MIME field. */
export async function mediaSignatureValid(file){
 const info=mediaDepositInfo(file);
 if(!info||typeof file.slice!=='function')return false;
 try{
  const buf=new Uint8Array(await file.slice(0,48).arrayBuffer());
  const has=(...bytes)=>bytes.every((v,i)=>buf[i]===v);
  const ascii=(start,len)=>String.fromCharCode(...buf.slice(start,start+len));
  if(file.type==='image/jpeg')return has(0xff,0xd8,0xff);
  if(file.type==='image/png')return has(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a);
  if(file.type==='image/webp')return ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP';
  if(file.type==='image/avif')return ascii(4,4)==='ftyp'&&/avif|avis/.test(ascii(8,32));
  if(file.type==='video/mp4')return ascii(4,4)==='ftyp';
  if(file.type==='video/webm')return has(0x1a,0x45,0xdf,0xa3);
 }catch{return false;}
 return false;
}
export function stagedMediaPath(file,id){
 const info=mediaDepositInfo(file);
 if(!info||typeof id!=='string'||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return null;
 return 'incoming/'+id.toLowerCase()+'.'+info.extension;
}

const el=(tag,cls='',label='')=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(label)node.textContent=label;
 return node;
};
/** The article dropdown is shared with the existing metadata editor.
 * Uploaded files stay invisible until reviewed in that editor.
 */
export function mountPrivateMediaUploader(root,api,userId,{
 postSelect,assetsForPost,onUploaded
}={}){
 if(!root?.isConnected||!postSelect||!api?.storage?.from)return;
 const section=el('section','admin-media-uploader');
 section.setAttribute('aria-label','Déposer un média privé du club');
 const heading=el('h3','','Déposer une photo ou une vidéo');
 const info=el('p','admin-workflow-status',
  'Dépôt privé uniquement. 12 médias maximum par article. Aucun fichier n’est publié automatiquement : la validation des droits et l’affichage se font ensuite dans le formulaire média.');
 const file=el('input','admin-form-control');
 file.type='file';file.accept='image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm';
 file.setAttribute('aria-label','Choisir une photo ou une vidéo approuvée pour dépôt privé');
 const alt=el('input','admin-form-control');alt.type='text';alt.maxLength=200;
 alt.placeholder='Description accessible du fichier';
 alt.setAttribute('aria-label','Description accessible du média');
 const rights=el('input');rights.type='checkbox';
 const consent=el('label','admin-media-upload-consent');
 consent.append(rights,el('span','','Je confirme être autorisé à déposer ce fichier, y compris au regard du droit à l’image. Cette attestation ne le publie pas.'));
 const submit=el('button','admin-primary-btn','Préparer le dépôt privé');
 submit.type='button';
 const status=el('p','admin-workflow-status');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 section.append(heading,info,file,alt,consent,submit,status);
 root.append(section);
 let busy=false,confirmedKey=null;
 const signature=()=>JSON.stringify({
  article:postSelect.value,name:file.files?.[0]?.name,
  size:file.files?.[0]?.size,modified:file.files?.[0]?.lastModified,
  alt:alt.value.trim(),rights:rights.checked
 });
 const reset=()=>{confirmedKey=null;submit.textContent='Préparer le dépôt privé';};
 for(const n of [file,alt,rights,postSelect]){
  n.addEventListener('change',reset);
  n.addEventListener('input',reset);
 }
 submit.addEventListener('click',async()=>{
  if(busy||!section.isConnected)return;
  const selectedFile=file.files?.[0];
  const info=mediaDepositInfo(selectedFile);
  const count=typeof assetsForPost==='function'?assetsForPost(postSelect.value):NaN;
  const error=validateMediaDeposit(selectedFile,{
   postId:postSelect.value,alt:alt.value,rights:rights.checked,count
  });
  if(error){status.textContent=error;reset();return;}
  const key=signature();
  if(confirmedKey!==key){
   confirmedKey=key;
   submit.textContent='Confirmer le dépôt privé (aucune publication)';
   status.textContent='Contrôle préalable : fichier, article, autorisation, taille et absence de publication automatique. Confirme une seconde fois.';
   return;
  }
  busy=true;confirmedKey=null;
  submit.disabled=true;file.disabled=true;alt.disabled=true;
  rights.disabled=true;postSelect.disabled=true;
  let recordCreated=false;
  try{
   const authorized=await adminSessionStatus(api,userId);
   if(!section.isConnected)return;
   if(authorized.status!=='admin'||authorized.level!=='aal2')
    throw new Error('not-authorized');
   if(!(await mediaSignatureValid(selectedFile)))
    throw new Error('invalid-signature');
   const uploadPath=stagedMediaPath(selectedFile,crypto.randomUUID());
   if(!uploadPath||!info)throw new Error('invalid-name');
   // Reserve the article quota in the existing audited RPC. Nothing is
   // visible or rights-reviewed at registration time.
   const registered=await api.rpc('admin_save_news_media',{
    p_id:null,p_post_id:postSelect.value,p_kind:info.kind,
    p_path:uploadPath,p_alt:alt.value.trim(),p_caption:'',
    p_sort_order:Math.min(count,11),p_visible:false,p_rights_reviewed:false
   });
   if(registered.error||!registered.data)throw new Error('metadata-registration');
   recordCreated=true;
   if(!section.isConnected)return;
   const uploaded=await api.storage.from(MEDIA_UPLOAD_BUCKET).upload(
    uploadPath,selectedFile,{
     cacheControl:'3600',upsert:false,contentType:selectedFile.type
    });
   if(uploaded.error)throw new Error('private-upload');
   const verified=await api.rpc('admin_check_news_media_file',{
    p_kind:info.kind,p_path:uploadPath
   });
   if(verified.error||verified.data!==true)
    throw new Error('server-verification');
   if(!section.isConnected)return;
   await onUploaded?.(registered.data);
   if(!section.isConnected)return;
   file.value='';alt.value='';rights.checked=false;
   status.textContent='Dépôt privé vérifié. Le média reste invisible : sélectionne-le ci-dessus, vérifie les droits et confirme sa publication séparément.';
  }catch{
   if(section.isConnected)status.textContent=recordCreated
    ?'Dépôt non confirmé. Une fiche privée peut avoir été réservée : vérifie la liste avant tout nouvel essai. Aucun média publié.'
    :'Dépôt refusé : rôle MFA, fichier, signature ou quota non conforme. Aucun média publié.';
  }finally{
   busy=false;
   if(section.isConnected){
    submit.disabled=false;file.disabled=false;alt.disabled=false;
    rights.disabled=false;postSelect.disabled=false;reset();
   }
  }
 });
 return section;
}
