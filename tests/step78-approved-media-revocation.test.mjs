import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {safeMediaPath,approvedMediaUrl,signApprovedMediaRows,MEDIA_URL_TTL_SECONDS} from '../news-media-gallery.mjs';
import {validateNewsMediaDraft} from '../admin-news-media.mjs';
import {MEDIA_SIGNATURE_REFRESH_MS} from '../media-center.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610260014_media_post_demotion_revoke.sql');
const old=read('supabase/migrations/202610230002_verified_news_media_assets.sql');
const feed=read('media-center.mjs'),admin=read('admin-news-media.mjs');
const prefix='https://dahzewvbybujqhogumte.supabase.co/storage/v1/object/sign/boissy-uj-approved/';

test('existing bucket remains private, type/size-bound and requires review',()=>{
 assert.match(old,/values \('boissy-uj-approved','boissy-uj-approved',false,50000000/);
 assert.match(old,/image\/jpeg/);
 assert.match(old,/video\/mp4/);
 assert.match(old,/constraint news_media_rights_required check \(not visible or rights_reviewed\)/);
 assert.match(old,/and \(select app_private.media_file_ready\(p_path,p_kind\)\)/);
 assert.match(old,/news_media_visible_with_public_post/);
 assert.match(old,/admin_check_news_media_file/);
 assert.match(old,/Maximum 12 assets per article/);
 assert.match(old,/app_private.news_media_change_audit/);
});

test('demotion automatically revokes current visible and approved media with a private audit',()=>{
 assert.match(sql,/create table if not exists app_private\.news_media_revocation_audit/);
 assert.match(sql,/alter table app_private\.news_media_revocation_audit enable row level security/);
 assert.match(sql,/revoke all on app_private\.news_media_revocation_audit/);
 assert.match(sql,/create or replace function app_private\.revoke_news_media_on_post_demotion/);
 for(const fragment of [
  "old.status='published'","old.visibility='public'","old.consent_reviewed=true",
  'old.published_at<=now()', "new.status is distinct from 'published'",
  "new.visibility is distinct from 'public'",
  'new.consent_reviewed is distinct from true',
  'new.published_at is null or new.published_at>now()',
  'set visible=false,rights_reviewed=false,updated_at=clock_timestamp()',
  'where a.post_id=new.id and (a.visible or a.rights_reviewed)',
  "'post_no_longer_public'"
 ])assert.ok(sql.includes(fragment),fragment);
 assert.match(sql,/after update of status,visibility,consent_reviewed,published_at\s+on public\.news_posts/);
 assert.match(sql,/revoke all on function app_private\.revoke_news_media_on_post_demotion/);
 assert.doesNotMatch(sql,/update storage\.objects|delete from storage\.objects|insert into public\.news_media_assets/);
});

test('Storage policy permits only signing approved assets, not listing, uploading or deleting',()=>{
 assert.match(sql,/drop policy if exists boissy_approved_media_sign_read on storage\.objects/);
 assert.match(sql,/on storage\.objects for select to anon,authenticated/);
 assert.match(sql,/bucket_id='boissy-uj-approved'/);
 assert.match(sql,/storage\.allow_any_operation\(array\['object.sign','object.sign_many'\]\)/);
 assert.match(sql,/a\.visible=true/);
 assert.match(sql,/a\.rights_reviewed=true/);
 assert.match(sql,/p\.status='published'/);
 assert.match(sql,/p\.consent_reviewed=true/);
 assert.match(sql,/p\.published_at<=now\(\)/);
 assert.doesNotMatch(sql,/object\.list|object\.upload|object\.delete|create policy .* for insert/);
});

test('unsigned or mismatched assets never render, signed URLs expire after ten minutes',async()=>{
 assert.equal(MEDIA_URL_TTL_SECONDS,600);
 assert.equal(MEDIA_SIGNATURE_REFRESH_MS,8*60*1000);
 assert.equal(safeMediaPath('tournoi/photo.webp','photo'),true);
 assert.equal(safeMediaPath('tournoi/../../x.webp','photo'),false);
 assert.equal(safeMediaPath('https://evil.example/x.webp','photo'),false);
 const valid=prefix+'tournoi/photo.webp?token=dummy';
 assert.equal(approvedMediaUrl('tournoi/photo.webp','photo',valid),valid);
 assert.equal(approvedMediaUrl('tournoi/photo.webp','photo',prefix+'other/photo.webp?token=dummy'),null);
 assert.equal(approvedMediaUrl('tournoi/photo.webp','photo','https://evil.example/file?token=dummy'),null);
 const signed=await signApprovedMediaRows([{
  storage_path:'tournoi/photo.webp',kind:'photo',visible:true,rights_reviewed:true
 }],{storage:{from:()=>({createSignedUrls:async(paths,ttl)=>{
  assert.deepEqual(paths,['tournoi/photo.webp']);assert.equal(ttl,600);
  return {data:[{path:paths[0],signedUrl:valid}]};
 }})}});
 assert.equal(signed.get('tournoi/photo.webp'),valid);
});

test('gallery renewal is scoped to active news route and cleans up all listeners',()=>{
 assert.match(feed,/mediaRefreshTimer=setInterval\(\(\)=>void refreshMedia\(\),MEDIA_SIGNATURE_REFRESH_MS\)/);
 assert.match(feed,/if\(updatingMedia\|\|!alive\(\)\|\|document.visibilityState==='hidden'\)return/);
 assert.match(feed,/await loadPublishedMedia\(data,ctrl.signal\)/);
 assert.match(feed,/if\(alive\(\)\)feed.setMedia\(next\)/);
 assert.match(feed,/if\(alive\(\)\)feed.setMedia\(new Map\(\)\)/);
 assert.match(feed,/document\.addEventListener\('visibilitychange',mediaResumeListener\)/);
 assert.match(feed,/clearInterval\(mediaRefreshTimer\)/);
 assert.match(feed,/removeEventListener\('visibilitychange',mediaResumeListener\)/);
 assert.match(feed,/currentAbort\?\.abort\(\)/);
 assert.match(feed,/isActive:alive/);
});

test('admin media editing remains AAL2 and consent-gated, never uploads bypassing Storage',()=>{
 const posts=[{id:'123'}];
 const draft={postId:'123',kind:'photo',path:'article/approved.webp',
  alt:'Image autorisée pour publication',caption:'',order:0,visible:true,rights:true};
 assert.equal(validateNewsMediaDraft(draft,posts),null);
 assert.match(validateNewsMediaDraft({...draft,rights:false},posts),/droits/);
 assert.match(validateNewsMediaDraft({...draft,path:'https://external/x.webp'},posts),/Chemin/);
 assert.match(admin,/adminSessionStatus\(api,userId\)/);
 assert.match(admin,/api\.rpc\('admin_check_news_media_file'/);
 assert.match(admin,/api\.rpc\('admin_save_news_media',params\)/);
 assert.match(admin,/if\(pending!==key\)/);
 assert.doesNotMatch(admin,/storage\.from\(.+\)\.upload\(/);
});
