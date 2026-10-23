/** Media metadata editor. Assets must already be approved and present in the
 * boissy-uj-approved Storage bucket. Backend rechecks MFA AAL2 and audits writes.
 */
import {adminSessionStatus} from './admin-security.mjs';
import {safeMediaPath} from './news-media-gallery.mjs';

const el=(tag,cls='',text=null)=>{
 const n=document.createElement(tag);if(cls)n.className=cls;
 if(text!==null)n.textContent=String(text);return n;
};
const opt=(value,text)=>{const o=el('option','',text);o.value=value;return o;};
const labeled=(title,element)=>{const label=el('label','admin-form-field',title);label.append(element);return label;};
const control=(tag='input')=>el(tag,'admin-form-control');
export function validateNewsMediaDraft(d,posts=[]){
 if(!posts.some(p=>p.id===d.postId))return 'Choisis un article existant du club.';
 if(!safeMediaPath(d.path,d.kind))return 'Chemin du média invalide : utilise un fichier image ou vidéo du dossier approuvé.';
 if(String(d.alt||'').trim().length<4||String(d.alt||'').trim().length>200)
  return 'Décris le visuel ou la vidéo (4 à 200 caractères).';
 if(String(d.caption||'').length>400)return 'La légende est limitée à 400 caractères.';
 if(!Number.isInteger(Number(d.order))||Number(d.order)<0||Number(d.order)>11)
  return 'Choisis un ordre de 0 à 11.';
 if(d.visible&&!d.rights)return 'La publication nécessite la vérification des droits à l’image et du consentement.';
 return null;
}

export async function mountAdminNewsMedia(root,api,userId){
 root.replaceChildren(el('h2','','Galeries et vidéos du club'));
 const status=el('p','admin-workflow-status','Vérification MFA et des modules média…');
 status.setAttribute('role','status');root.append(status);
 const check=await adminSessionStatus(api,userId);
 if(!root.isConnected)return;
 if(check.status!=='admin'){status.textContent='Administrateur MFA AAL2 requis.';return;}
 const [p,a]=await Promise.all([
  api.rpc('admin_list_management_news'),api.rpc('admin_list_news_media')
 ]);
 if(!root.isConnected)return;
 if(p.error||a.error||!Array.isArray(p.data)||!Array.isArray(a.data)){
  status.textContent='Éditeur média indisponible : vérifie le déploiement de la migration et tes droits MFA. Aucun média enregistré.';
  return;
 }
 const posts=p.data.filter(n=>n?.id&&n.visibility==='public');
 if(!posts.length){
  status.textContent='Crée d’abord une actualité du club dans le module Actualités, puis associe une photo ou une vidéo approuvée.';
  return;
 }
 let assets=a.data;
 const post=control('select');
 for(const n of posts)post.append(opt(n.id,n.title));
 const item=control('select');
 const kind=control('select');
 kind.append(opt('photo','Photo'),opt('video','Vidéo'));
 const path=control();path.type='text';path.maxLength=180;
 path.placeholder='saison-2026/rencontre-1/photo.webp';
 const alt=control();alt.type='text';alt.maxLength=200;
 alt.placeholder='Description accessible du média';
 const caption=control('textarea');caption.rows=3;caption.maxLength=400;
 const order=control();order.type='number';order.min='0';order.max='11';order.step='1';
 const rights=control();rights.type='checkbox';
 const visible=control();visible.type='checkbox';
 const save=el('button','admin-primary-btn','Enregistrer le média');save.type='submit';
 const form=el('form','admin-operation-form');
 form.append(
  labeled('Actualité du club',post),
  labeled('Créer ou modifier un média',item),
  labeled('Type de média',kind),
  labeled('Chemin dans le bucket boissy-uj-approved (sans URL)',path),
  labeled('Texte alternatif / description de la vidéo',alt),
  labeled('Légende (facultative)',caption),
  labeled('Ordre dans la galerie (0 à 11)',order),
  labeled('Droits à l’image vérifiés et autorisations applicables obtenues',rights),
  labeled('Afficher après publication de l’article',visible),
  el('p','admin-fff-info','Ajoute uniquement un fichier déjà approuvé et téléversé dans le bucket Supabase par un responsable habilité. Aucun fichier n’est envoyé depuis ce formulaire. Double confirmation et MFA AAL2.'),
  save
 );
 root.append(form);
 let pending=null,busy=false;
 const resetConfirm=()=>{pending=null;save.textContent='Enregistrer le média';};
 const loadAsset=()=>{
  resetConfirm();
  const current=assets.find(x=>x.id===item.value);
  kind.value=current?.kind||'photo';
  path.value=current?.storage_path||'';
  alt.value=current?.alt_text||'';
  caption.value=current?.caption||'';
  order.value=String(current?.sort_order??0);
  rights.checked=false;
  visible.checked=current?.visible===true;
 };
 const drawItems=()=>{
  item.replaceChildren(opt('new','+ Nouveau média'));
  for(const a of assets.filter(a=>a.post_id===post.value)){
   item.append(opt(a.id,(a.kind==='video'?'Vidéo':'Photo')+' · '+a.storage_path+
    (a.visible?' · visible':' · masqué')));
  }
  item.value='new';loadAsset();
 };
 post.addEventListener('change',drawItems);
 item.addEventListener('change',loadAsset);
 for(const node of [kind,path,alt,caption,order,rights,visible]){
  node.addEventListener('input',resetConfirm);node.addEventListener('change',resetConfirm);
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!root.isConnected)return;
  const draft={
   postId:post.value,kind:kind.value,path:path.value.trim(),
   alt:alt.value.trim(),caption:caption.value,order:Number(order.value),
   visible:visible.checked,rights:rights.checked
  };
  const invalid=validateNewsMediaDraft(draft,posts);
  if(invalid){status.textContent=invalid;resetConfirm();return;}
  const selected=assets.find(a=>a.id===item.value);
  const params={p_id:selected?.id||null,p_post_id:draft.postId,p_kind:draft.kind,
   p_path:draft.path,p_alt:draft.alt,p_caption:draft.caption,
   p_sort_order:draft.order,p_visible:draft.visible,
   p_rights_reviewed:draft.rights};
  const key=JSON.stringify(params);
  if(pending!==key){
   pending=key;
   save.textContent='Confirmer la publication / modification';
   status.textContent='Vérifie l’article, le fichier, les autorisations et la visibilité, puis confirme une seconde fois.';
   return;
  }
  busy=true;save.disabled=true;resetConfirm();
  try{
   const auth=await adminSessionStatus(api,userId);
   if(auth.status!=='admin'){status.textContent='MFA expirée, aucune modification faite.';return;}
   const result=await api.rpc('admin_save_news_media',params);
   if(!root.isConnected)return;
   if(result.error){status.textContent='Modification refusée par Supabase. Aucun enregistrement confirmé.';return;}
   const refreshed=await api.rpc('admin_list_news_media');
   if(!root.isConnected)return;
   if(refreshed.error||!Array.isArray(refreshed.data)){
    status.textContent='Modification enregistrée ; actualise la page pour recharger les médias.';return;
   }
   assets=refreshed.data;drawItems();
   status.textContent='Média enregistré et modification auditée. Sa visibilité dépend aussi de la publication de l’article.';
  }catch{if(root.isConnected)status.textContent='Service temporairement inaccessible. Vérifie avant de recommencer.';}
  finally{busy=false;if(save.isConnected)save.disabled=false;}
 });
 drawItems();
 status.textContent='Les fichiers ne sont pas ajoutés depuis le site. Association des médias approuvés uniquement.';
}
