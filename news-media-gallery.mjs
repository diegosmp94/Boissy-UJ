/** Media gallery read-only, rights-reviewed and published through Supabase RLS.
 * Files stay on the club's approved Supabase Storage origin, never a third-party embed.
 */
import {supabaseConfig} from './auth-config.mjs';

const BUCKET='boissy-uj-approved';
const IMAGE_EXT=/\.(jpe?g|png|webp|avif)$/i;
const VIDEO_EXT=/\.(mp4|webm)$/i;
const PATH=/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp|avif|mp4|webm)$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function safeMediaPath(path,kind){
 return typeof path==='string'&&path.length<=180&&!path.includes('..')&&PATH.test(path)
   &&(kind==='photo'?IMAGE_EXT.test(path):kind==='video'&&VIDEO_EXT.test(path));
}
export function approvedMediaUrl(path,kind){
 if(!safeMediaPath(path,kind))return null;
 return supabaseConfig.url+'/storage/v1/object/public/'+BUCKET+'/'+
   path.split('/').map(encodeURIComponent).join('/');
}
export function mediaKindsFor(post,assets=[]){
 return [...new Set(assets.filter(a=>a.post_id===post.id&&a.visible===true&&a.rights_reviewed===true&&safeMediaPath(a.storage_path,a.kind))
   .map(a=>a.kind))];
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
  &&approvedMediaUrl(a.storage_path,a.kind)).slice(0,12);
 if(!eligible.length)return;
 const wrap=el('div','news-media-gallery');
 wrap.setAttribute('aria-label','Médias autorisés de cette actualité');
 for(const asset of eligible){
  const src=approvedMediaUrl(asset.storage_path,asset.kind);
  const figure=el('figure','news-media-item');
  if(asset.kind==='photo'){
   const img=el('img','news-media-photo');
   img.src=src;img.alt=asset.alt_text;
   img.loading='lazy';img.decoding='async';
   figure.append(img);
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
  return grouped;
 }catch{
  return new Map(); // cancellation, network failure: articles remain accessible.
 }
}
