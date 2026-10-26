import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 safeMediaPath,approvedMediaUrl,signApprovedMediaRows,
 MEDIA_URL_TTL_SECONDS,mediaKindsFor
} from '../news-media-gallery.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610230002_verified_news_media_assets.sql');
const gallery=read('news-media-gallery.mjs');
const editor=read('admin-news-media.mjs');
const origin='https://dahzewvbybujqhogumte.supabase.co';
const sign=(path,token='sample')=>origin+'/storage/v1/object/sign/boissy-uj-approved/'+path+'?token='+token;
const asset=(path='club/match.webp')=>({id:path,post_id:'article',kind:'photo',
 storage_path:path,alt_text:'Équipe avant le match',visible:true,rights_reviewed:true});

test('bucket is PRIVATE and does not serve guessed or raw public object links',()=>{
 assert.match(sql,/values \('boissy-uj-approved','boissy-uj-approved',false,50000000/);
 assert.match(sql,/on conflict\(id\) do update set public=false/);
 assert.match(sql,/allowed_mime_types=excluded\.allowed_mime_types/);
 assert.match(sql,/where o\.bucket_id='boissy-uj-approved' and b\.public=false/);
 assert.doesNotMatch(gallery,/\/storage\/v1\/object\/public\//);
 assert.equal(approvedMediaUrl('club/match.webp','photo'),null);
 assert.equal(approvedMediaUrl('club/match.webp','photo',origin+'/storage/v1/object/public/boissy-uj-approved/club/match.webp'),null);
 assert.equal(approvedMediaUrl('club/match.webp','photo',sign('club/match.webp')),sign('club/match.webp'));
 assert.equal(approvedMediaUrl('club/match.webp','photo',sign('private/match.webp')),null);
 assert.equal(approvedMediaUrl('club/match.webp','photo',sign('club/match.webp').replace('token=','other=')),null);
 assert.equal(approvedMediaUrl('club/match.webp','photo','https://elsewhere.example/club/match.webp?token=foo'),null);
 assert.equal(approvedMediaUrl('../secret.webp','photo',sign('club/match.webp')),null);
 assert.equal(safeMediaPath('club/../secret.jpg','photo'),false);
});

test('storage SELECT policy limits signature creation to approved assets with a published consenting parent',()=>{
 assert.match(sql,/create policy boissy_approved_media_sign_read\s+on storage\.objects for select to anon,authenticated/);
 assert.match(sql,/bucket_id='boissy-uj-approved'/);
 assert.match(sql,/select 1 from public\.news_media_assets a\s+join public\.news_posts p on p\.id=a\.post_id/);
 for(const x of [
  'a.storage_path=name','a.visible=true','a.rights_reviewed=true',
  "p.visibility='public'","p.status='published'",
  'p.consent_reviewed=true','p.published_at<=now()'
 ])assert.ok(sql.includes(x),x);
 assert.match(sql,/alter table public\.news_media_assets enable row level security/);
 assert.match(sql,/visible and rights_reviewed/);
 assert.doesNotMatch(sql,/create policy .* on storage\.objects for (?:insert|update|delete)/i);
 assert.doesNotMatch(sql,/grant (?:insert|update|delete) on storage\.objects/i);
});

test('signer only accepts approved objects and exact-path signed URLs from the same origin',async()=>{
 const calls=[];
 const mock={storage:{from(bucket){
  assert.equal(bucket,'boissy-uj-approved');
  return {async createSignedUrls(paths,ttl){
   calls.push({paths,ttl});
   return {data:paths.map(path=>({path,signedUrl:sign(path)})),error:null};
  }};
 }}};
 const rows=[asset(),{...asset('club/other.webp'),visible:false},
  {...asset('club/rights.webp'),rights_reviewed:false},
  {...asset('club/untrusted.svg'),storage_path:'club/untrusted.svg'}];
 const signed=await signApprovedMediaRows(rows,mock);
 assert.deepEqual([...signed.keys()],['club/match.webp']);
 assert.equal(signed.get('club/match.webp'),sign('club/match.webp'));
 assert.equal(calls.length,1);
 assert.equal(calls[0].ttl,600);
 assert.equal(MEDIA_URL_TTL_SECONDS,600);
 assert.equal(mediaKindsFor({id:'article'},[asset()]).length,0);
 assert.deepEqual(mediaKindsFor({id:'article'},[{...asset(),signed_url:sign('club/match.webp')}]),['photo']);
});

test('an incorrect signature, failed signing or wrong object must never cause a public fallback',async()=>{
 for(const data of [
  [{path:'club/wrong.webp',signedUrl:sign('club/wrong.webp')}],
  [{path:'club/match.webp',signedUrl:sign('club/wrong.webp')}],
  [{path:'club/match.webp',signedUrl:'https://evil.invalid/match.webp?token=bad'}],
  [{path:'club/match.webp',signedUrl:origin+'/storage/v1/object/public/boissy-uj-approved/club/match.webp'}]
 ]){
  const api={storage:{from:()=>({createSignedUrls:async()=>({data,error:null})})}};
  const results=await signApprovedMediaRows([asset()],api);
  assert.equal(results.size,0);
 }
 const failure={storage:{from:()=>({createSignedUrls:async()=>{throw Error('offline');}})}};
 assert.equal((await signApprovedMediaRows([asset()],failure)).size,0);
});

test('batch signing is bounded and never passes access tokens through query strings or storage',async()=>{
 const calls=[],rows=[];
 for(let i=0;i<101;i++)rows.push(asset('gallery/item'+i+'.webp'));
 const api={storage:{from:()=>({createSignedUrls:async(paths,ttl)=>{
  calls.push(paths);
  return {data:paths.map(path=>({path,signedUrl:sign(path)})),error:null};
 }})}};
 const urls=await signApprovedMediaRows(rows,api);
 assert.equal(urls.size,101);
 assert.deepEqual(calls.map(batch=>batch.length),[50,50,1]);
 assert.match(gallery,/createSignedUrls\(paths,ttl\)/);
 assert.match(gallery,/await import\('\.\/auth\.mjs'\)/);
 assert.match(gallery,/if\(signal\?\.aborted\)return new Map\(\)/);
 assert.doesNotMatch(gallery,/localStorage|sessionStorage|service_role|sb_secret_|getPublicUrl/);
});

test('dashboard admin metadata controls, mime checks and private audit are not bypassed',()=>{
 assert.match(sql,/if p_visible and not \(select app_private\.media_file_ready\(p_path,p_kind\)\)/);
 assert.match(sql,/p_visible and not p_rights_reviewed/);
 assert.match(sql,/revoke all on app_private\.news_media_change_audit from public,anon,authenticated/);
 assert.match(sql,/app_private\.is_admin\(\)/);
 assert.match(sql,/Maximum 12 assets per article/);
 for(const mime of ['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm'])
  assert.ok(sql.includes("o.metadata->>'mimetype'='"+mime));
 assert.match(editor,/bucket Supabase est privé/);
 assert.match(editor,/liens signés temporaires \(10 minutes\)/);
 assert.match(editor,/admin_check_news_media_file/);
 assert.match(editor,/if\(pending!==key\)/);
});
