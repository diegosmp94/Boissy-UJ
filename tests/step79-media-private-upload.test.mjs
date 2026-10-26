import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 MEDIA_UPLOAD_BUCKET,MEDIA_MAX_BYTES,PHOTO_MAX_BYTES,
 validateMediaDeposit,mediaDepositInfo,mediaSignatureValid,stagedMediaPath
} from '../admin-media-uploader.mjs';
import {safeMediaPath} from '../news-media-gallery.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610260016_staged_private_media_upload.sql');
const uploader=read('admin-media-uploader.mjs');
const admin=read('admin-news-media.mjs');
const uuid='a1234567-1234-4123-8123-a123456789ab';
const post='b1234567-1234-4123-8123-b123456789ab';
const file=(name,type,bytes,overrideSize)=>{
 const blob=new Blob([Uint8Array.from(bytes)],{type});
 Object.defineProperty(blob,'name',{value:name});
 Object.defineProperty(blob,'lastModified',{value:123});
 if(overrideSize!==undefined)Object.defineProperty(blob,'size',{value:overrideSize});
 return blob;
};
const jpg=()=>file('photo.jpg','image/jpeg',[255,216,255,224,1]);
const valid={postId:post,alt:'Photo de la rencontre, autorisée',rights:true,count:0};

test('file validation rejects unsupported types, spoofs, empty and oversized files',()=>{
 assert.equal(validateMediaDeposit(jpg(),valid),null);
 assert.equal(MEDIA_MAX_BYTES,50_000_000);
 assert.equal(PHOTO_MAX_BYTES,12_000_000);
 assert.match(validateMediaDeposit(jpg(),{...valid,postId:'wrong'}),/actualité/);
 assert.match(validateMediaDeposit(jpg(),{...valid,rights:false}),/autorisations/);
 assert.match(validateMediaDeposit(jpg(),{...valid,count:12}),/12 médias/);
 assert.match(validateMediaDeposit(jpg(),{...valid,alt:'no'}),/description/);
 assert.match(validateMediaDeposit(file('evil.svg','image/svg+xml',[60,115,118,103]),valid),/Format/);
 assert.match(validateMediaDeposit(file('wrong.mp4','image/jpeg',[255,216,255]),valid),/Format/);
 assert.match(validateMediaDeposit(file('too.jpg','image/jpeg',[255,216,255],PHOTO_MAX_BYTES+1),valid),/12 Mo/);
 assert.match(validateMediaDeposit(file('too.mp4','video/mp4',[0,0,0],MEDIA_MAX_BYTES+1),valid),/50 Mo/);
 assert.match(validateMediaDeposit(file('empty.jpg','image/jpeg',[]),valid),/non vide/);
 assert.equal(mediaDepositInfo(file('clip.webm','video/webm',[26,69,223,163])).kind,'video');
});

test('binary signature is checked independently of name/MIME metadata',async()=>{
 const photo=jpg();
 assert.equal(await mediaSignatureValid(photo),true);
 assert.equal(await mediaSignatureValid(file('fake.jpg','image/jpeg',[60,104,116,109,108])),false);
 assert.equal(await mediaSignatureValid(file('image.png','image/png',[137,80,78,71,13,10,26,10])),true);
 assert.equal(await mediaSignatureValid(file('photo.webp','image/webp',[
  82,73,70,70,0,0,0,0,87,69,66,80])),true);
 assert.equal(await mediaSignatureValid(file('photo.avif','image/avif',[
  0,0,0,24,102,116,121,112,97,118,105,102,0,0,0,0])),true);
 assert.equal(await mediaSignatureValid(file('clip.mp4','video/mp4',[0,0,0,18,102,116,121,112])),true);
 assert.equal(await mediaSignatureValid(file('clip.webm','video/webm',[26,69,223,163])),true);
 assert.equal(await mediaSignatureValid(file('clip.webm','video/webm',[0,0,0,0])),false);
});

test('unguessable draft path is safe, unique per secure UUID and accepts neither URLs nor traversal',()=>{
 const path=stagedMediaPath(jpg(),uuid);
 assert.equal(path,'incoming/'+uuid+'.jpg');
 assert.equal(safeMediaPath(path,'photo'),true);
 assert.equal(stagedMediaPath(jpg(),'../../../secret'),null);
 assert.equal(stagedMediaPath(file('x.svg','image/svg+xml',[0]),uuid),null);
 assert.equal(MEDIA_UPLOAD_BUCKET,'boissy-uj-approved');
});

test('storage upload policy is AAL2-only INSERT with pre-registered private metadata',()=>{
 assert.match(sql,/create policy boissy_admin_staged_media_upload/);
 assert.match(sql,/on storage\.objects\s+for insert to authenticated\s+with check/);
 assert.match(sql,/bucket_id='boissy-uj-approved'/);
 assert.match(sql,/app_private\.is_admin\(\)/);
 assert.match(sql,/incoming\/\[0-9a-f\]/);
 assert.match(sql,/a\.storage_path=name/);
 assert.match(sql,/a\.visible=false and a\.rights_reviewed=false/);
 assert.match(sql,/create policy news_media_admin_staged_read\s+on public\.news_media_assets\s+for select to authenticated/);
 assert.doesNotMatch(sql,/grant\s+(?:insert|update|delete|select)\s+on\s+storage\.objects/i);
 assert.doesNotMatch(sql,/for (?:update|delete) to authenticated/);
 assert.doesNotMatch(sql,/insert into public\.news_media_assets|update public\.news_media_assets|update storage\.buckets/i);
 assert.doesNotMatch(sql,/bucket_id=.*public=true/);
});

test('upload registers private metadata then uses create-only Storage with server verification',()=>{
 const register=uploader.indexOf("api.rpc('admin_save_news_media'");
 const transfer=uploader.indexOf('.upload(');
 const verify=uploader.indexOf("api.rpc('admin_check_news_media_file'");
 assert.ok(register>=0&&register<transfer&&transfer<verify);
 assert.match(uploader,/p_visible:false,p_rights_reviewed:false/);
 assert.match(uploader,/p_id:null,p_post_id:postSelect\.value/);
 assert.match(uploader,/upsert:false,contentType:selectedFile\.type/);
 assert.match(uploader,/api\.storage\.from\(MEDIA_UPLOAD_BUCKET\)/);
 assert.match(uploader,/adminSessionStatus\(api,userId\)/);
 assert.match(uploader,/authorized\.status!=='admin'\|\|authorized\.level!=='aal2'/);
 assert.match(uploader,/mediaSignatureValid\(selectedFile\)/);
 assert.match(uploader,/if\(confirmedKey!==key\)/);
 assert.match(uploader,/onUploaded\?\.\(registered\.data\)/);
 assert.doesNotMatch(uploader,/\.getPublicUrl\(|\.createSignedUrl\(|service_role|sk_secret_|\.update\(|\.remove\(/i);
});

test('media editor has separate upload and publish workflows; never automatically changes visibility',()=>{
 assert.match(admin,/mountPrivateMediaUploader\(root,api,userId/);
 assert.match(admin,/assetsForPost:postId=>assets\.filter/);
 assert.match(admin,/onUploaded:async savedId/);
 assert.match(admin,/api\.rpc\('admin_list_news_media'\)/);
 assert.match(admin,/item\.value=savedId/);
 assert.match(admin,/api\.rpc\('admin_save_news_media',params\)/);
 assert.match(admin,/if\(draft\.visible&&verifiedFileKey!==fileKey\(\)\)/);
 assert.match(read('index.html'),/admin-media-upload\.css/);
 assert.match(read('admin-media-upload.css'),/max-width:560px/);
});
