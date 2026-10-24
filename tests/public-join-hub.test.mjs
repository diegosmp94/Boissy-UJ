import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 JOIN_AUDIENCES,OPPORTUNITY_STAGES,NOTICE_TOPICS,filterJoinListings,
 filterPublicNotices,verifiedContactHref,filterPublicContacts,loadPublicClubInfo
} from '../join-center.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610210015_join_public_information.sql');
const app=read('app.js');
const html=read('index.html');
const css=read('styles.css');
const js=read('join-center.mjs');
const listings=[
 {id:1,title:'Atelier football',description:'Une annonce certifiée',audience:'player',team_code:'a',stage:'open',published:true,sort_order:3},
 {id:2,title:'Coach Seniors B',description:'Besoin d’encadrement',audience:'coach',team_code:'b',stage:'planned',published:true,sort_order:2},
 {id:3,title:'Bénévole club',description:'Participer à la vie associative',audience:'volunteer',team_code:null,stage:'open',published:true,sort_order:1},
 {id:4,title:'Secret non vérifié',description:'Brouillon',audience:'player',team_code:'c',stage:'open',published:false,sort_order:0},
 {id:5,title:'Joueur polyvalent',description:'Toutes équipes',audience:'player',team_code:null,stage:'planned',published:true,sort_order:1}
];
const notices=[
 {id:1,heading:'Où sont les entraînements ?',body:'En cours de publication',topic:'training',published:true,sort_order:0},
 {id:2,heading:'Adhésion',body:'Contacter le club',topic:'membership',published:true,sort_order:1},
 {id:3,heading:'Adresse cachée',body:'Non public',topic:'venue',published:false,sort_order:0}
];

test('public recruitment schema has no intake of personal data or fictional content',()=>{
 for(const table of ['club_join_opportunities','club_public_notices','club_contact_channels']){
   assert.match(sql,new RegExp('create table if not exists public\\.'+table));
   assert.match(sql,new RegExp('alter table public\\.'+table+' enable row level security'));
 }
 assert.match(sql,/published boolean not null default false/g);
 assert.match(sql,/check\(audience in \('player','coach','volunteer','partner'\)\)/);
 assert.doesNotMatch(sql,/insert into public\.(club_join_opportunities|club_public_notices|club_contact_channels)/i);
 assert.doesNotMatch(sql,/password|birth_date|player_user_id|medical_record|residence_address/i);
});

test('RLS is only SELECT of explicitly published contact, notices and opportunities',()=>{
 for(const table of ['club_join_opportunities','club_public_notices','club_contact_channels']){
   assert.match(sql,new RegExp('using\\(published=true\\)'));
 }
 assert.match(sql,/revoke all on public\.club_join_opportunities,public\.club_public_notices/);
 assert.match(sql,/grant select on public\.club_join_opportunities,public\.club_public_notices/);
 assert.doesNotMatch(sql,/grant (insert|update|delete) on public\.club_/i);
});

test('role journeys include player, coach, volunteer and partner without collecting applications',()=>{
 assert.deepEqual(JOIN_AUDIENCES.map(x=>x.id),['player','coach','volunteer','partner']);
 assert.equal(OPPORTUNITY_STAGES.open,'Annonce ouverte');
 assert.equal(NOTICE_TOPICS.training,'Entraînements');
 assert.match(js,/Aucun formulaire de recrutement|Aucun joueur|Aucun moyen de contact officiel/);
 assert.doesNotMatch(js,/document\.createElement\('form'\)|innerHTML\s*=|\.rpc\(|localStorage|sessionStorage/);
});

test('open and draft opportunities remain separated in filters',()=>{
 assert.deepEqual(filterJoinListings(listings,{audience:'player'}).map(x=>x.id),[5,1]);
 assert.deepEqual(filterJoinListings(listings,{audience:'player',team:'c'}).map(x=>x.id),[5]);
 assert.deepEqual(filterJoinListings(listings,{audience:'coach',team:'b'}).map(x=>x.id),[2]);
 assert.deepEqual(filterJoinListings(listings,{audience:'volunteer'}).map(x=>x.id),[3]);
 assert.equal(filterJoinListings(listings,{audience:'partner'}).length,0);
 assert.equal(filterJoinListings(listings,{audience:'player',query:'ATÉLIER'}).length,1);
});

test('draft practical notices never render, search is accent insensitive',()=>{
 assert.deepEqual(filterPublicNotices(notices,{topic:'training'}).map(x=>x.id),[1]);
 assert.deepEqual(filterPublicNotices(notices,{query:'adhesion'}).map(x=>x.id),[2]);
 assert.equal(filterPublicNotices(notices,{topic:'venue'}).length,0);
});

test('contact hrefs are restricted to verified HTTPS, mailto and tel',()=>{
 const base={published:true,audience:'general',sort_order:1};
 assert.equal(verifiedContactHref({...base,channel_type:'email',channel_value:'club@example.org'}),'mailto:club@example.org');
 assert.equal(verifiedContactHref({...base,channel_type:'phone',channel_value:'+33123456789'}),'tel:+33123456789');
 assert.equal(verifiedContactHref({...base,channel_type:'website',channel_value:'https://example.org/contact'}),'https://example.org/contact');
 assert.equal(verifiedContactHref({...base,channel_type:'website',channel_value:'javascript:alert(1)'}),null);
 assert.equal(verifiedContactHref({...base,channel_type:'website',channel_value:'http://example.com'}),null);
 assert.equal(verifiedContactHref({...base,channel_type:'website',channel_value:'https://x:y@example.org'}),null);
 assert.equal(verifiedContactHref({...base,published:false,channel_type:'email',channel_value:'club@example.org'}),null);
});

test('contacts are audience-scoped and unpublished details hidden',()=>{
 const all=[
  {published:true,channel_type:'email',channel_value:'a@example.org',audience:'general',sort_order:0},
  {published:true,channel_type:'email',channel_value:'b@example.org',audience:'coach',sort_order:1},
  {published:false,channel_type:'email',channel_value:'c@example.org',audience:'player',sort_order:2},
  {published:true,channel_type:'website',channel_value:'javascript:evil()',audience:'general',sort_order:3}
 ];
 assert.equal(filterPublicContacts(all,'player').length,1);
 assert.equal(filterPublicContacts(all,'coach').length,2);
});

test('three REST reads use only select + published filter and no personal submissions',async()=>{
 const urls=[];
 const fake=async(url,opts)=>{
   urls.push(url);
   assert.equal(opts.method,'GET');
   return {ok:true,json:async()=>[]};
 };
 const data=await loadPublicClubInfo(undefined,fake);
 assert.deepEqual(data,{listings:[],notices:[],contacts:[],unavailable:[]});
 assert.equal(urls.length,3);
 assert.ok(urls.every(url=>url.includes('published=eq.true')));
 assert.ok(urls.some(url=>url.includes('/club_join_opportunities?')));
 assert.ok(urls.some(url=>url.includes('/club_public_notices?')));
 assert.ok(urls.some(url=>url.includes('/club_contact_channels?')));
 assert.doesNotMatch(urls.join(''),/profiles|auth.users|player_user_id|user_roles/);
});

test('pages are wired in app and mobile navigation with proper cancellation',()=>{
 assert.match(app,/import \{mountJoin,unmountJoin,mountPractical,unmountPractical\} from '\.\/join-center\.mjs'/);
 assert.match(app,/'\/rejoindre':join,'\/infos-pratiques':practical/);
 assert.match(app,/if\(path==='\/rejoindre'\) void mountJoin\(\); else unmountJoin\(\);/);
 assert.match(app,/if\(path==='\/infos-pratiques'\) void mountPractical\(\); else unmountPractical\(\);/);
 assert.match(app,/id="join-public-hub"/);
 assert.match(app,/id="practical-public-hub"/);
 assert.match(html,/href="#\/infos-pratiques"/);
 assert.match(js,/state\.controller\?\.abort\(\)/);
 assert.match(js,/if\(ctrl\.signal\.aborted\|\|generation!==state\.generation\|\|!root\.isConnected\)return/);
 assert.match(app,/Aucun formulaire de recrutement ou d’envoi de données personnelles n’est activé/);
 assert.match(css,/\.join-public-hub/);
 assert.match(css,/safe-area-inset-bottom/);
});
