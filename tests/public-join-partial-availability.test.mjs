import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadPublicClubInfo} from '../join-center.mjs';
import {boundedPublicRequest} from '../public-catalog-timeout.mjs';

const join=readFileSync(new URL('../join-center.mjs',import.meta.url),'utf8');
const sample={
 listing:{id:'public-listing',title:'Information approuvée',description:'Annonce vérifiée',audience:'player',published:true,sort_order:1},
 notice:{id:'public-notice',heading:'Horaire approuvé',body:'Information publiée',topic:'training',published:true,sort_order:1},
 contact:{id:'public-contact',label:'Contact officiel',channel_type:'email',channel_value:'club@example.org',audience:'general',published:true,sort_order:1}
};
function fakeSource(failed=[]){
 const calls=[];
 const fetcher=async(url,opts)=>{
  calls.push(url);
  assert.equal(opts.method,'GET');
  assert.ok(url.includes('published=eq.true'));
  if(url.includes('club_join_opportunities')){
   if(failed.includes('listings'))return {ok:false,status:503};
   return {ok:true,json:async()=>[sample.listing]};
  }
  if(url.includes('club_public_notices')){
   if(failed.includes('notices'))throw new Error('not available');
   return {ok:true,json:async()=>[sample.notice]};
  }
  if(url.includes('club_contact_channels')){
   if(failed.includes('contacts'))return {ok:true,json:async()=>({error:'bad payload'})};
   return {ok:true,json:async()=>[sample.contact]};
  }
  throw new Error('Unexpected table');
 };
 return {fetcher,calls};
}
test('all three independent published catalogues survive normal reads',async()=>{
 const {fetcher,calls}=fakeSource();
 const result=await loadPublicClubInfo(undefined,fetcher);
 assert.deepEqual(result,{
  listings:[sample.listing],notices:[sample.notice],contacts:[sample.contact],unavailable:[]
 });
 assert.equal(calls.length,3);
 assert.equal(calls.some(u=>u.includes('/profiles?')),false);
});
for(const failed of ['listings','notices','contacts']){
 test('failure in '+failed+' does not hide other valid public catalogues',async()=>{
  const result=await loadPublicClubInfo(undefined,fakeSource([failed]).fetcher);
  assert.deepEqual(result.unavailable,[failed]);
  for(const area of ['listings','notices','contacts']){
   assert.deepEqual(result[area],area===failed?[]:[
    area==='listings'?sample.listing:area==='notices'?sample.notice:sample.contact
   ]);
  }
 });
}
test('all three sources unavailable is not misrepresented as three empty catalogues',async()=>{
 const result=await loadPublicClubInfo(undefined,
  fakeSource(['listings','notices','contacts']).fetcher);
 assert.deepEqual(result,{
  listings:[],notices:[],contacts:[],
  unavailable:['listings','notices','contacts']
 });
});
test('abort is not hidden by Promise.allSettled even when providers all fail',async()=>{
 const route=new AbortController();
 const deadline=boundedPublicRequest(route.signal,25);
 const pending=(_url,{signal})=>new Promise((_,reject)=>{
  signal.addEventListener('abort',()=>reject(new Error('network aborted')),{once:true});
 });
 await assert.rejects(loadPublicClubInfo(deadline.signal,pending),/Requête annulée/);
 assert.equal(deadline.signal.aborted,true);
 deadline.dispose();
});
test('unavailable notices and contacts have explicit per-section status instead of false empty copy',()=>{
 assert.match(join,/Promise\.allSettled\(/);
 assert.match(join,/if\(signal\?\.aborted\)throw new Error\('Requête annulée'\)/);
 assert.match(join,/data\.unavailable\.includes\('listings'\)/);
 assert.match(join,/data\.unavailable\.includes\('notices'\)/);
 assert.match(join,/data\.unavailable\.includes\('contacts'\)/);
 assert.match(join,/Les contacts officiels sont momentanément indisponibles/);
 assert.match(join,/Les annonces officielles sont momentanément indisponibles/);
 assert.match(join,/Les informations pratiques officielles sont momentanément indisponibles/);
 assert.match(join,/Les questions et informations officielles du club ne peuvent pas être chargées/);
 assert.match(join,/warning\.setAttribute\('role','status'\)/);
 assert.match(join,/if\(!found\.length\)/);
 assert.match(join,/if\(!rows\.length\)/);
 assert.doesNotMatch(join,/\.innerHTML\s*=|admin_save|service_role|\.insert\(|\.upsert\(|\.delete\(/);
});
test('public-only fallback never makes up an email, coach, training session or a published news item',()=>{
 assert.match(join,/Seuls les moyens de contact explicitement publiés/);
 assert.match(join,/Ne communique pas de dossier de santé/);
 assert.match(join,/filterPublicContacts\(data\.contacts/);
 assert.match(join,/filterPublicNotices\(data\.notices/);
 assert.match(join,/filterJoinListings\(listings/);
});
