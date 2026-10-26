/** Media gallery read-only, rights-reviewed and published through Supabase RLS.
 * Files stay on the club's approved Supabase Storage origin, never a third-party embed.
 */
import {supabaseConfig} from './auth-config.mjs';

const BUCKET='boissy-uj-approved';
export const MEDIA_URL_TTL_SECONDS=600;
const SIGNED_PREFIX=supabaseConfig.url+'/storage/v1/object/sign/'+BUCKET+'/';
const IMAGE_EXT=/\.(jpe?g|png|webp|avif)$/i;
const VIDEO_EXT=/\.(mp4|webm)$/i;
const PATH=/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp|avif|mp4|webm)$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function safeMediaPath(path,kind){
 return typeof path==='string'&&path.length<=180&&!path.includes('..')&&PATH.test(path)
   &&(kind==='photo'?IMAGE_EXT.test(path):kind==='video'&&VIDEO_EXT.test(path));
}
/** A metadata path is NEVER a directly accessible URL.
 * Only a scoped, expiring Storage signature authorizes delivery.
 */
export function approvedMediaUrl(path,kind,signedUrl=null){
 if(!safeMediaPath(path,kind)||typeof signedUrl!=='string')return null;
 try{
  const url=new URL(signedUrl,supabaseConfig.url);
  const expected=SIGNED_PREFIX+path.split('/').map(encodeURIComponent).join('/');
  if(url.origin!==new URL(supabaseConfig.url).origin||
     url.href.split('?')[0]!==expected||!url.searchParams.get('token'))
   return null;
  return url.href;
 }catch{return null;}
}
/** Sign eligible assets in bounded batches with Supabase's Storage API.
 * No service key, no public object URL, no browser storage of signed tokens.
 */
export async function signApprovedMediaRows(rows,client,ttl=MEDIA_URL_TTL_SECONDS){
 const result=new Map();
 if(!Array.isArray(rows)||!client?.storage?.from)return result;
 const eligible=rows.filter(a=>a.visible===true&&a.rights_reviewed===true
  &&safeMediaPath(a.storage_path,a.kind));
 for(let offset=0;offset<eligible.length;offset+=50){
  const batch=eligible.slice(offset,offset+50);
  const paths=batch.map(a=>a.storage_path);
  try{
   const signed=await client.storage.from(BUCKET).createSignedUrls(paths,ttl);
   if(signed.error||!Array.isArray(signed.data))continue;
   for(const entry of signed.data){
    if(!paths.includes(entry?.path))continue;
    const item=batch.find(a=>a.storage_path===entry.path);
    if(!item||entry.error)continue;
    const url=approvedMediaUrl(item.storage_path,item.kind,entry.signedUrl);
    if(url)result.set(item.storage_path,url);
   }
  }catch{ /* private media unavailable; do not expose an unsigned fallback */ }
 }
 return result;
}
export function mediaKindsFor(post,assets=[]){
 return [...new Set(assets.filter(a=>a.post_id===post.id&&a.visible===true&&a.rights_reviewed===true&&approvedMediaUrl(a.storage_path,a.kind,a.signed_url))
   .map(a=>a.kind))];
}
/** In-page lightbox: visitors never leave Boissy-UJ or reach an unreviewed URL.
 * Browser-native dialog handles Escape and focus trapping; the close button
 * returns focus to the original photo button.
 */
export function openApprovedPhoto(article,button,{src,alt,caption=''}) {
 if(!src||!src.startsWith(SIGNED_PREFIX)||!new URL(src).searchParams.get('token'))
  return false;
 if(typeof document==='undefined'||!article?.isConnected)return false;
 const dialog=el('dialog','news-media-lightbox');
 dialog.setAttribute('aria-label','Photo du club agrandie');
 const close=el('button','news-media-lightbox-close','Fermer ✕');
 close.type='button';
 close.setAttribute('aria-label','Fermer la photo agrandie');
 const figure=el('figure','news-media-lightbox-content');
 const image=el('img','news-media-lightbox-image');
 image.src=src;image.alt=String(alt||'');image.decoding='async';
 figure.append(image);
 if(caption)figure.append(el('figcaption','news-media-lightbox-caption',caption));
 dialog.append(close,figure);
 const cleanup=()=>{dialog.remove();if(button?.isConnected)button.focus({preventScroll:true});};
 dialog.addEventListener('close',cleanup,{once:true});
 close.addEventListener('click',()=>dialog.close());
 article.append(dialog);
 try{dialog.showModal();close.focus({preventScroll:true});return true;}
 catch{dialog.remove();return false;}
}

const el=(tag,cls='',content=null)=>{
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(content!==null)n.textContent=String(content);
 return n;
};
export function renderApprovedMedia(article,assets=[]){
 const eligible=assets.filter(a=>a.visible===true&&a.rights_reviewed===true
  &&typeof a.alt_text==='string'&&a.alt_text.trim().length>=4
  &&approvedMediaUrl(a.storage_path,a.kind,a.signed_url)).slice(0,12);
 if(!eligible.length)return;
 const wrap=el('div','news-media-gallery');
 wrap.setAttribute('aria-label','Médias autorisés de cette actualité');
 for(const asset of eligible){
  const src=approvedMediaUrl(asset.storage_path,asset.kind,asset.signed_url);
  const figure=el('figure','news-media-item');
  if(asset.kind==='photo'){
   const img=el('img','news-media-photo');
   img.src=src;img.alt=asset.alt_text;
   img.loading='lazy';img.decoding='async';
   const expand=el('button','news-media-expand');
   expand.type='button';
   expand.setAttribute('aria-label','Agrandir la photo : '+asset.alt_text);
   expand.setAttribute('aria-haspopup','dialog');
   expand.append(img);
   expand.addEventListener('click',()=>openApprovedPhoto(article,expand,{
    src,alt:asset.alt_text,caption:asset.caption||''
   }));
   figure.append(expand);
  }else{
   const video=el('video','news-media-video');
   video.src=src;
   video.controls=true;video.preload='none';video.playsInline=true;
   video.setAttribute('aria-label',asset.alt_text);
   video.setAttribute('controlsList','nodownload');
   video.append(el('span','','Ton navigateur ne prend pas en charge cette vidéo.'));
   figure.append(video);
  }
  if(asset.caption)figure.append(el('figcaption','news-media-caption',asset.caption));
  wrap.append(figure);
 }
 article.append(wrap);
}
export async function loadPublishedMedia(posts,signal){
 const ids=[...new Set(posts.map(p=>p.id).filter(id=>typeof id==='string'&&UUID.test(id)))].slice(0,50);
 if(!ids.length)return new Map();
 const params=new URLSearchParams({
  select:'id,post_id,kind,storage_path,alt_text,caption,sort_order,visible,rights_reviewed',
  post_id:'in.('+ids.join(',')+')',
  visible:'eq.true',rights_reviewed:'eq.true',
  order:'sort_order.asc,id.asc',limit:'600'
 });
 try{
  const response=await fetch(supabaseConfig.url+'/rest/v1/news_media_assets?'+params.toString(),{
   method:'GET',signal,cache:'no-store',
   headers:{apikey:supabaseConfig.publishableKey,Accept:'application/json'}
  });
  if(!response.ok)return new Map(); // additive migration not installed: keep news readable.
  const rows=await response.json();
  if(!Array.isArray(rows))return new Map();
  const grouped=new Map(ids.map(id=>[id,[]]));
  for(const item of rows){
   if(!grouped.has(item.post_id)||grouped.get(item.post_id).length>=12)continue;
   if(!item.visible||!item.rights_reviewed||!safeMediaPath(item.storage_path,item.kind))continue;
   grouped.get(item.post_id).push(item);
  }
  if(signal?.aborted)return new Map();
  const eligible=[...grouped.values()].flat();
  if(!eligible.length)return grouped;
  const {getAuthClient}=await import('./auth.mjs');
  const client=await getAuthClient();
  if(signal?.aborted)return new Map();
  const signed=await signApprovedMediaRows(eligible,client);
  if(signal?.aborted)return new Map();
  for(const [id,assets] of grouped){
   grouped.set(id,assets.filter(a=>signed.has(a.storage_path)).map(a=>({
    ...a,signed_url:signed.get(a.storage_path)
   })));
  }
  return grouped;
 }catch{
  return new Map(); // signed access failed, keep articles readable with no media.
 }
}
