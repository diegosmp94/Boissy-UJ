import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hydrateNewsIndependently} from '../news-progressive-hydration.mjs';
import {readEditorialOperationalStatus} from '../admin-editorial-status.mjs';
import {ADMIN_MODULES} from '../admin-center.mjs';
import {availableAdminModules} from '../admin-navigation.mjs';
import {approvedMediaUrl} from '../news-media-gallery.mjs';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const samplePosts=[
 {id:'draft',status:'draft',visibility:'public',consent_reviewed:false,published_at:null},
 {id:'published',status:'published',visibility:'public',consent_reviewed:true,
  published_at:'2026-10-01T08:00:00Z'},
 {id:'unapproved',status:'published',visibility:'public',consent_reviewed:false,
  published_at:'2026-10-01T08:00:00Z'},
 {id:'private',status:'published',visibility:'private',consent_reviewed:true,
  published_at:'2026-10-01T08:00:00Z'}
];
function fakeAdmin({postResult={data:samplePosts,error:null},
 mediaResult={data:[
  {visible:true,rights_reviewed:true,storage_path:'private/not-displayed.webp'},
  {visible:true,rights_reviewed:false},{visible:false,rights_reviewed:true}
 ],error:null},reactionResult={data:[],error:null}}={}){
 const calls=[];
 return {calls,
  rpc:async name=>{
   calls.push('rpc:'+name);
   return name==='admin_list_management_news'?postResult:mediaResult;
  },
  from:table=>{
   calls.push('from:'+table);
   return {select:column=>{
    assert.equal(column,'post_id');
    return {limit:async size=>{
     assert.equal(size,1);
     return reactionResult;
    }};
   }};
  }
 };
}
test('step 59 editorial monitoring uses only protected list RPCs and a private self-reaction probe',async()=>{
 const api=fakeAdmin(),r=await readEditorialOperationalStatus(api);
 assert.equal(r.postsAvailable,true);
 assert.equal(r.mediaAvailable,true);
 assert.equal(r.reactionsAvailable,true);
 assert.equal(r.checkedArticles,4);
 assert.equal(r.publishedArticles,1);
 assert.equal(r.nonPublishedArticles,3);
 assert.equal(r.visibleRightsCheckedAssets,1);
 assert.equal(r.notFullyApprovedAssets,2);
 assert.equal(r.limitedArticles,false);
 assert.equal(r.limitedMedia,false);
 assert.deepEqual(api.calls.sort(),[
  'from:news_reactions','rpc:admin_list_management_news','rpc:admin_list_news_media'
 ]);
 assert.ok(!Object.keys(r).some(k=>k.includes('user')||k.includes('path')||k.includes('body')));
 assert.equal(Object.isFrozen(r),true);
});
test('missing media and reaction migrations are reported as not available, never as a successful test',async()=>{
 const api=fakeAdmin({mediaResult:{data:null,error:{code:'PGRST205'}},
  reactionResult:{data:null,error:{code:'PGRST205'}}});
 const report=await readEditorialOperationalStatus(api);
 assert.equal(report.postsAvailable,true);
 assert.equal(report.mediaAvailable,false);
 assert.equal(report.reactionsAvailable,false);
 assert.equal(report.checkedMedia,null);
 assert.equal(report.visibleRightsCheckedAssets,null);
 assert.equal(report.notFullyApprovedAssets,null);
 const broken=await readEditorialOperationalStatus(fakeAdmin({
  postResult:{data:null,error:{code:'42501'}}
 }));
 assert.equal(broken.postsAvailable,false);
 assert.equal(broken.checkedArticles,null);
 assert.equal(broken.publishedArticles,null);
});
test('editorial module stays behind AAL2-gated admin hub and does not pretend media backend is installed',()=>{
 const center=read('admin-center.mjs'),source=read('admin-editorial-status.mjs');
 assert.equal(ADMIN_MODULES.some(m=>m.id==='editorial'),true);
 assert.equal(availableAdminModules(ADMIN_MODULES).some(m=>m.id==='editorial'),true);
 assert.equal(availableAdminModules(ADMIN_MODULES).some(m=>m.id==='news-media'),false);
 assert.match(center,/const check=await adminSessionStatus\(api,verified\.userId\)/);
 assert.match(center,/case 'editorial':void mountAdminEditorialStatus\(view,api,verified\.userId/);
 assert.match(source,/adminSessionStatus\(api,userId\)/);
 assert.match(source,/if\(role.status!=='admin'\)/);
 assert.match(source,/if\(auth.status!=='admin'\)/);
 assert.match(source,/diagnostics\.replaceChildren\(news,media,reactions,cap\)/);
 assert.doesNotMatch(source,/innerHTML|service_role|\.insert\(|\.delete\(|\.update\(|upload\(/);
});
test('published news renders immediately even when optional reactions never resolve',async()=>{
 const seen=[],pendingReactions=new Promise(()=>{});
 const done=hydrateNewsIndependently({
  loadMedia:async()=>new Map([['article',[]]]),
  loadReactions:()=>pendingReactions,
  applyMedia:()=>seen.push('media'),
  applyReactions:()=>seen.push('reactions'),
  isActive:()=>true
 });
 await new Promise(r=>setTimeout(r,0));
 assert.deepEqual(seen,['media']);
 // Optional reaction request is deliberately pending: original articles remain visible.
 assert.ok(done instanceof Promise);
});
test('failed one optional news service never blocks the other, and navigation drops stale results',async()=>{
 const seen=[];
 await hydrateNewsIndependently({
  loadMedia:async()=>{throw Error('media unavailable');},
  loadReactions:async()=>({render(){}}),
  applyMedia:()=>seen.push('media'),
  applyReactions:()=>seen.push('reactions'),
  isActive:()=>true
 });
 assert.deepEqual(seen,['reactions']);
 let active=true,complete;
 const wait=new Promise(resolve=>{complete=resolve;});
 const task=hydrateNewsIndependently({
  loadMedia:()=>wait,
  loadReactions:async()=>null,
  applyMedia:()=>seen.push('stale'),
  applyReactions:()=>{},
  isActive:()=>active
 });
 active=false;complete([]);
 await task;
 assert.equal(seen.includes('stale'),false);
});
test('photo lightbox never navigates visitors away from Boissy-UJ or enables autoplay',()=>{
 const media=read('news-media-gallery.mjs'),css=read('news-media-gallery.css');
 const allowed=approvedMediaUrl('club/match.webp','photo');
 assert.match(allowed,/\/storage\/v1\/object\/public\/boissy-uj-approved\//);
 assert.match(media,/dialog\.showModal\(\)/);
 assert.match(media,/dialog\.addEventListener\('close',cleanup/);
 assert.match(media,/button\.focus\(\{preventScroll:true\}\)/);
 assert.match(media,/expand\.setAttribute\('aria-haspopup','dialog'\)/);
 assert.match(media,/asset\.alt_text/);
 assert.match(css,/\.news-media-lightbox::backdrop/);
 assert.match(css,/\.news-media-lightbox-close:focus-visible/);
 assert.doesNotMatch(media,/window\.open|autoplay\s*=\s*true|iframe|innerHTML/);
});
test('news module hydrates galleries and likes independently only while current route is active',()=>{
 const feed=read('media-center.mjs');
 assert.match(feed,/hydrateNewsIndependently/);
 assert.match(feed,/loadMedia:\(\)=>loadPublishedMedia\(data,ctrl\.signal\)/);
 assert.match(feed,/loadReactions:\(\)=>loadNewsReactions\(data\)/);
 assert.match(feed,/const alive=\(\)=>!ctrl\.signal\.aborted&&id===generation&&root\.isConnected/);
 assert.match(feed,/showFeed\(root,data,true,teams,initialTeamCode\)/);
});
