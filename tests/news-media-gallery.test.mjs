import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {safeMediaPath,approvedMediaUrl,mediaKindsFor} from '../news-media-gallery.mjs';
import {validateNewsMediaDraft} from '../admin-news-media.mjs';
import {availableAdminModules} from '../admin-navigation.mjs';
import {ADMIN_MODULES} from '../admin-center.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610230002_verified_news_media_assets.sql');
const viewer=read('news-media-gallery.mjs'),admin=read('admin-news-media.mjs');
const feed=read('media-center.mjs'),center=read('admin-center.mjs');

test('only club-approved photo/video object paths can be rendered',()=>{
 for(const [path,kind] of [['saison-2026/rencontre/boissy.webp','photo'],
  ['galerie/photo-1.jpeg','photo'],['saison-2026/resume.webm','video']])
  assert.equal(safeMediaPath(path,kind),true,path);
 for(const path of ['https://evil.example/media.webp','/storage/v1/x.webp',
  '../secret/video.mp4','team/../secret.webp','team/x.svg','a/x.html',
  'a/x.webp?tracking=1','a/x.webp#x','a%2Fprivate/x.webp','a/x.PNG',
  'team/x.jpg//','a/x.mp4'])
  assert.equal(safeMediaPath(path,'photo'),false,path);
 assert.equal(safeMediaPath('galerie/clip.mp4','photo'),false);
 assert.equal(safeMediaPath('galerie/clip.mp4','video'),true);
 assert.equal(approvedMediaUrl('x/../evil.webp','photo'),null);
 const url=approvedMediaUrl('saison-2026/boissy.webp','photo');
 assert.equal(new URL(url).origin,'https://dahzewvbybujqhogumte.supabase.co');
 assert.match(url,/\/storage\/v1\/object\/public\/boissy-uj-approved\//);
});
test('only reviewed and displayed assets affect public media filters',()=>{
 const post={id:'post-A'};
 const assets=[
  {post_id:'post-A',kind:'photo',storage_path:'match/boissy.webp',visible:true,rights_reviewed:true},
  {post_id:'post-A',kind:'video',storage_path:'match/recap.mp4',visible:false,rights_reviewed:true},
  {post_id:'post-A',kind:'video',storage_path:'match/recap.mp4',visible:true,rights_reviewed:false},
  {post_id:'post-B',kind:'video',storage_path:'match/recap.mp4',visible:true,rights_reviewed:true}
 ];
 assert.deepEqual(mediaKindsFor(post,assets),['photo']);
 assert.deepEqual(mediaKindsFor(post,assets.slice(1)),[]);
});
test('RLS never exposes private media or authorizes public writes',()=>{
 for(const term of ['alter table public.news_media_assets enable row level security',
  'visible and rights_reviewed',"n.status='published'","n.visibility='public'",
  'n.consent_reviewed',"n.published_at<=now()",
  'revoke all on public.news_media_assets from public,anon,authenticated',
  'create policy news_media_visible_with_public_post',
  'app_private.news_media_change_audit enable row level security'])
  assert.ok(sql.includes(term),term);
 assert.match(sql,/grant select\([\s\S]+?\)\s+on public\.news_media_assets to anon,authenticated/);
 assert.doesNotMatch(sql,/grant (?:insert|update|delete)[\s\S]+?on public\.news_media_assets to (?:anon|authenticated)/i);
 assert.match(sql,/if v_actor is null or not coalesce\(\(select app_private\.is_admin\(\)\),false\)/);
 assert.match(sql,/where id=p_post_id and visibility='public'/);
 assert.match(sql,/Maximum 12 assets per article/);
 assert.match(sql,/revoke all on function public\.admin_save_news_media/);
});
test('native players protect visitors without third-party embeds or autoplay',()=>{
 assert.match(viewer,/video\.controls=true;video\.preload='none';video\.playsInline=true/);
 assert.match(viewer,/img\.loading='lazy';img\.decoding='async'/);
 assert.match(viewer,/n\.textContent=String\(content\)/);
 assert.doesNotMatch(viewer,/iframe|innerHTML|autoplay\s*=\s*true|document\.write/);
 assert.match(feed,/renderApprovedMedia\(article,media\)/);
 assert.match(feed,/loadPublishedMedia\(data,ctrl\.signal\)/);
 assert.match(feed,/setMedia\(grouped\)/);
});
test('admin can only request publish with rights and explicit double confirmation',()=>{
 const posts=[{id:'123'}];
 const valid={postId:'123',kind:'photo',path:'match/image.webp',alt:'Photo de groupe autorisée',
  caption:'',order:0,visible:true,rights:true};
 assert.equal(validateNewsMediaDraft(valid,posts),null);
 assert.match(validateNewsMediaDraft({...valid,rights:false},posts),/droits/);
 assert.match(validateNewsMediaDraft({...valid,path:'https://other.site/image.webp'},posts),/Chemin/);
 assert.match(validateNewsMediaDraft({...valid,order:13},posts),/ordre/);
 assert.match(validateNewsMediaDraft({...valid,postId:'other'},posts),/article/);
 assert.match(admin,/adminSessionStatus\(api,userId\)/);
 assert.match(admin,/api\.rpc\('admin_save_news_media',params\)/);
 assert.match(admin,/if\(pending!==key\)/);
 assert.match(admin,/if\(auth\.status!=='admin'\)/);
});
test('media module is hidden until an authorized read RPC succeeds',()=>{
 assert.equal(availableAdminModules(ADMIN_MODULES,{eventsReady:true,coachTeamsReady:true})
  .some(m=>m.id==='news-media'),false);
 assert.equal(availableAdminModules(ADMIN_MODULES,{eventsReady:true,coachTeamsReady:true,mediaReady:true})
  .some(m=>m.id==='news-media'),true);
 assert.match(read('admin-control-reliability.mjs'),/adminCapability\(\(\)=>api\.rpc\('admin_list_news_media'\)/);
 assert.match(read('admin-control-reliability.mjs'),/adminCapability\(\(\)=>api\.rpc\('admin_list_news_media'\),Array\.isArray/);
 assert.match(center,/mountAdminNewsMedia\(view,api,verified\.userId\)/);
});
