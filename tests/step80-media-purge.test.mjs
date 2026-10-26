import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 MEDIA_PURGE_BUCKET,mediaPurgeTarget,validPurgeTicket,purgePrivateMedia
} from '../admin-media-purge.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610260017_media_purge_queue.sql');
const editor=read('admin-news-media.mjs');
const ui=read('admin-media-purge.mjs');
const asset={id:'9a000000-0000-4000-8000-000000000001',post_id:'c',
 kind:'photo',storage_path:'incoming/9a000000-0000-4000-8000-000000000001.jpg'};
const goodAuth={
 getUser:async()=>({data:{user:{id:'admin-id'}}}),
 mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'}})}
};
function mock({removeError=null,finishError=null,beginError=null,roles=['admin'],level='aal2'}={}){
 const calls=[];
 const api={
  auth:{...goodAuth,mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:level}})}},
  from:()=>({select:()=>({eq:async()=>({data:roles.map(role=>({role}))})})}),
  rpc:async(name,params)=>{
   calls.push(['rpc',name,params]);
   if(name==='admin_begin_news_media_purge')
    return beginError?{error:{message:'refused'}}:
     {data:{status:'pending',path:asset.storage_path}};
   if(name==='admin_finish_news_media_purge')
    return finishError?{error:{message:'file remains'}}:{data:true};
   throw new Error(name);
  },
  storage:{from:bucket=>{
   calls.push(['bucket',bucket]);
   return {remove:async paths=>{
    calls.push(['remove',paths]);
    return removeError?{error:{message:'Storage failed'}}:{data:[]};
   }};
  }}
 };
 return {api,calls};
}
test('only a matching, safe asset can be purged',()=>{
 assert.equal(MEDIA_PURGE_BUCKET,'boissy-uj-approved');
 assert.equal(mediaPurgeTarget([asset],asset.id),asset);
 assert.equal(mediaPurgeTarget([asset],'new'),null);
 assert.equal(mediaPurgeTarget([{...asset,storage_path:'https://evil.invalid/x.jpg'}],asset.id),null);
 assert.equal(validPurgeTicket({status:'pending',path:asset.storage_path},asset),true);
 assert.equal(validPurgeTicket({status:'completed',path:asset.storage_path},asset),false);
 assert.equal(validPurgeTicket({status:'pending',path:'incoming/other.jpg'},asset),false);
});
test('successful purge orders revoke -> Storage remove -> server verification',async()=>{
 const {api,calls}=mock();
 assert.deepEqual(await purgePrivateMedia(api,'admin-id',asset),{status:'completed'});
 assert.deepEqual(calls.filter(x=>x[0]==='rpc').map(x=>x[1]),[
  'admin_begin_news_media_purge','admin_finish_news_media_purge'
 ]);
 assert.equal(calls.findIndex(x=>x[0]==='remove')>
  calls.findIndex(x=>x[1]==='admin_begin_news_media_purge'),true);
 assert.equal(calls.findIndex(x=>x[0]==='remove')<
  calls.findIndex(x=>x[1]==='admin_finish_news_media_purge'),true);
 assert.deepEqual(calls.find(x=>x[0]==='remove')[1],[asset.storage_path]);
 assert.equal(calls.find(x=>x[0]==='bucket')[1],MEDIA_PURGE_BUCKET);
});
test('Storage failure keeps tombstone pending and never falsely finalizes',async()=>{
 const {api,calls}=mock({removeError:true});
 assert.deepEqual(await purgePrivateMedia(api,'admin-id',asset),
  {status:'pending',reason:'storage-error'});
 assert.equal(calls.some(x=>x[1]==='admin_finish_news_media_purge'),false);
});
test('server verification failure remains pending, and AAL1 cannot start',async()=>{
 const bad=mock({finishError:true});
 assert.deepEqual(await purgePrivateMedia(bad.api,'admin-id',asset),
  {status:'pending',reason:'finalize-error'});
 const low=mock({level:'aal1'});
 assert.deepEqual(await purgePrivateMedia(low.api,'admin-id',asset),{status:'unauthorized'});
 assert.equal(low.calls.length,0);
});
test('SQL requires AAL2 and a durable pending job before Storage DELETE',()=>{
 for(const fragment of [
  'app_private.news_media_purge_jobs','enable row level security',
  'revoke all on app_private.news_media_purge_jobs',
  'news_media_guard_purge',
  'before insert or update or delete on public.news_media_assets',
  'boissy_admin_queued_media_delete',
  'on storage.objects for delete to authenticated',
  "storage.allow_only_operation('object.delete')",
  "bucket_id='boissy-uj-approved'",
  'app_private.media_purge_authorized(name)',
  'app_private.is_admin()',
  'public.admin_begin_news_media_purge(p_asset_id uuid)',
  'public.admin_finish_news_media_purge(p_asset_id uuid)',
  'set visible=false,rights_reviewed=false',
  'news_media_change_audit',
  'Storage file still exists; retry deletion',
  "o.name=v_job.storage_path",
  'delete from public.news_media_assets',
  'grant execute on function public.admin_begin_news_media_purge(uuid) to authenticated',
  'grant execute on function public.admin_finish_news_media_purge(uuid) to authenticated'
 ])assert.ok(sql.includes(fragment),fragment);
 assert.doesNotMatch(sql,/delete\s+from\s+storage\.(objects|buckets)/i);
 assert.doesNotMatch(sql,/grant\s+(?:select|update|insert|delete)\s+on\s+storage\.objects/i);
 assert.doesNotMatch(sql,/for delete to (?:anon|public)/i);
});
test('UI separates irreversibly deleting an asset from publication and upload',()=>{
 assert.match(editor,/mountAdminMediaPurge\(root,api,userId/);
 assert.match(editor,/assetsForPost:\(\)=>assets\.filter/);
 assert.match(editor,/onPurged:async\(\)=>/);
 assert.match(ui,/pendingKey!==key/);
 assert.match(ui,/adminSessionStatus\(api,userId\)/);
 assert.match(ui,/\.remove\(\[started\.data\.path\]\)/);
 assert.match(ui,/Média masqué par le serveur/);
 assert.doesNotMatch(ui,/getPublicUrl|service_role|\.upsert\(/i);
});
