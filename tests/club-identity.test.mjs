import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {IDENTITY_SECTIONS,TEAM_OVERVIEW,filterIdentitySections,loadPublishedIdentity} from '../club-identity.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610210016_club_identity_public.sql');
const app=read('app.js'),html=read('index.html'),js=read('club-identity.mjs');
test('five teams are grouped into football and futsal with four editorial sections',()=>{
 assert.deepEqual(TEAM_OVERVIEW.map(x=>x.name),['Seniors A','Seniors B','Seniors C','Vétérans','Boissy-UJ Futsal']);
 assert.deepEqual(IDENTITY_SECTIONS.map(x=>x.id),['history','values','governance','projects']);
});
test('unpublished history and private personnel remain hidden',()=>{
 const rows=[{section:'history',title:'Histoire',body:'Vérifiée',published:true,sort_order:2},
 {section:'governance',title:'Direction',body:'Privée',published:false,sort_order:1},
 {section:'values',title:'Égalité',body:'Ensemble',published:true,sort_order:1}];
 assert.deepEqual(filterIdentitySections(rows).map(x=>x.title),['Égalité','Histoire']);
 assert.deepEqual(filterIdentitySections(rows,{section:'history'}).map(x=>x.title),['Histoire']);
 assert.deepEqual(filterIdentitySections(rows,{query:'egalite'}).map(x=>x.title),['Égalité']);
});
test('public fetch is read-only and filtered to published rows',async()=>{
 let url,options;
 const fetcher=async(u,o)=>{url=u;options=o;return {ok:true,json:async()=>[{published:true},{published:false}]};};
 const result=await loadPublishedIdentity(undefined,fetcher);
 assert.equal(options.method,'GET');assert.match(url,/published=eq.true/);
 assert.equal(result.length,1);
 assert.doesNotMatch(url,/profiles|user_roles|auth.users/);
});
test('schema enables RLS and no writes or invented records',()=>{
 assert.match(sql,/create table if not exists public\.club_identity_sections/);
 assert.match(sql,/alter table public\.club_identity_sections enable row level security/);
 assert.match(sql,/using \(published=true\)/);
 assert.match(sql,/grant select on public\.club_identity_sections/);
 assert.doesNotMatch(sql,/insert into public\.club_identity_sections|grant (insert|update|delete)/i);
});
test('club route accessible and no untrusted HTML interpolation',()=>{
 assert.match(app,/'\/club':identity/);
 assert.match(app,/if\(path==='\/club'\) void mountIdentity\(\); else unmountIdentity\(\)/);
 assert.match(html,/href="#\/club"/);
 assert.doesNotMatch(js,/innerHTML\s*=|\.rpc\(|method:'POST'/);
});
