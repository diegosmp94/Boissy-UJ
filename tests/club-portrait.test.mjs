import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 CONFIRMED_TEAMS,STORY_CATEGORIES,normalizedStorySearch,
 filterPublicStory,filterVerifiedMilestones,milestoneDate,loadClubPortrait
} from '../club-portrait.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const db=read('supabase/migrations/202610210016_public_club_story.sql');
const src=read('club-portrait.mjs');
const app=read('app.js');
const html=read('index.html');
const css=read('styles.css');
const approved=[
 {id:'1',category:'history',heading:'Histoire vérifiée',body:'Un texte officiel',published:true,
  reviewed_at:'2026-10-21T12:00:00Z',sort_order:2},
 {id:'2',category:'values',heading:'Valeurs vérifiées',body:'Engagement collectif',published:true,
  reviewed_at:'2026-10-21T12:00:00Z',sort_order:1},
 {id:'3',category:'governance',heading:'Texte confidentiel',body:'Non diffusé',published:false,
  reviewed_at:'2026-10-21T12:00:00Z',sort_order:0},
 {id:'4',category:'projects',heading:'Projet non vérifié',body:'Brouillon',published:true,
  reviewed_at:null,sort_order:0}
];

test('show confirmed team divisions without inventing founding history',()=>{
 assert.deepEqual(CONFIRMED_TEAMS.map(x=>x.name),
  ['Seniors A','Seniors B','Seniors C','Vétérans']);
 assert.deepEqual(CONFIRMED_TEAMS.map(x=>x.division),
  ['Départemental 3','Départemental 4','Matchs amicaux','Départemental 3']);
 assert.deepEqual(STORY_CATEGORIES.map(x=>x.key),
  ['history','identity','values','governance','projects']);
 assert.doesNotMatch(src,/fondé en \d{4}|fondation en \d{4}/i);
});
test('private, unpublished and unreviewed history remains invisible',()=>{
 assert.deepEqual(filterPublicStory(approved).map(x=>x.id),['2','1']);
 assert.deepEqual(filterPublicStory(approved,{category:'history'}).map(x=>x.id),['1']);
 assert.equal(filterPublicStory(approved,{category:'governance'}).length,0);
 assert.equal(filterPublicStory(approved,{category:'projects'}).length,0);
 assert.equal(filterPublicStory(approved,{query:'historie'}).length,0);
 assert.equal(filterPublicStory(approved,{query:'verifiees'}).length,0);
 assert.equal(filterPublicStory(approved,{query:'histoire'}).length,1);
 assert.equal(normalizedStorySearch('ÉQUIPE'), 'equipe');
});
test('timeline requires a reviewed, published event and valid date',()=>{
 const events=[
  {id:'1',occurred_on:'2026-10-21',date_precision:'day',published:true,reviewed_at:'verified',sort_order:2},
  {id:'2',occurred_on:'2025-02-01',date_precision:'year',published:true,reviewed_at:'verified',sort_order:1},
  {id:'3',occurred_on:'2024-01-01',date_precision:'year',published:false,reviewed_at:'verified',sort_order:0},
  {id:'4',occurred_on:'2023-01-01',date_precision:'year',published:true,reviewed_at:null,sort_order:0},
  {id:'5',occurred_on:'not-date',date_precision:'day',published:true,reviewed_at:'verified',sort_order:0}
 ];
 assert.deepEqual(filterVerifiedMilestones(events).map(x=>x.id),['2','1']);
 assert.equal(milestoneDate(events[1]),'2025');
 assert.match(milestoneDate(events[0]),/octobre 2026/);
});
test('public story tables are read-only under explicit RLS and require review',()=>{
 for(const table of ['club_story_sections','club_story_milestones']){
  assert.match(db,new RegExp('create table if not exists public\\.'+table));
  assert.match(db,new RegExp('alter table public\\.'+table+' enable row level security'));
 }
 assert.match(db,/create policy club_story_sections_public_read/);
 assert.match(db,/create policy club_story_milestones_public_read/);
 assert.match(db,/published=true and reviewed_at is not null/g);
 assert.match(db,/revoke all on public\.club_story_sections,public\.club_story_milestones/);
 assert.match(db,/grant select on public\.club_story_sections,public\.club_story_milestones/);
 assert.doesNotMatch(db,/grant (?:insert|update|delete) on public\.club_story_/i);
 assert.doesNotMatch(db,/insert into public\.club_story_/i);
});
test('public fetch reads only published content from two catalogues',async()=>{
 const calls=[];
 const fetcher=async(url,opts)=>{
  calls.push({url,method:opts.method});
  return {ok:true,json:async()=>[]};
 };
 const data=await loadClubPortrait(undefined,fetcher);
 assert.deepEqual(data,{sections:[],milestones:[]});
 assert.equal(calls.length,2);
 assert.ok(calls.every(x=>x.method==='GET'&&x.url.includes('published=eq.true')));
 assert.match(calls[0].url,/club_story_sections\?/);
 assert.match(calls[1].url,/club_story_milestones\?/);
 assert.doesNotMatch(calls.map(x=>x.url).join(''),/user_roles|profiles|auth.users|email/);
});
test('SPA club portrait is accessible from welcome, footer and mobile',()=>{
 assert.match(app,/import \{mountClubPortrait,unmountClubPortrait\} from '\.\/club-portrait\.mjs'/);
 assert.match(app,/function clubPortrait\(\)/);
 assert.match(app,/'\/le-club':clubPortrait/);
 assert.match(app,/if\(path==='\/le-club'\) void mountClubPortrait\(\); else unmountClubPortrait\(\);/);
 assert.match(app,/id="club-portrait-public"/);
 assert.match(app,/href="#\/le-club"/);
 assert.match(html,/href="#\/le-club"/);
 assert.match(src,/activeRequest\?\.abort\(\)/);
 assert.match(src,/myVersion!==version/);
 assert.doesNotMatch(src,/innerHTML\s*=|\.rpc\(|localStorage|method:'POST'/);
});
test('empty states do not invent claims and mobile layout is supported',()=>{
 assert.match(src,/Aucun texte institutionnel vérifié n’est encore publié/);
 assert.match(src,/Aucune date de fondation ou étape historique/);
 assert.match(src,/La chronologie officielle est en cours de constitution/);
 assert.match(src,/Les quatre équipes confirmées restent consultables/);
 assert.match(css,/\.club-portrait-public/);
 assert.match(css,/@media\(max-width:680px\)/);
 assert.match(css,/safe-area-inset-bottom/);
});
