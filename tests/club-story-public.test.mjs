import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  STORY_THEMES,CLUB_GROUPS,filterPublishedStory,publishedMilestones,
  publishedPublicPositions,loadClubStory
} from '../club-story.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610210016_club_story_public.sql');
const src=read('club-story.mjs');
const app=read('app.js');
const html=read('index.html');
const css=read('styles.css');
const demo=read('presentation.mjs');
const rows=[
  {id:'1',kind:'history',heading:'Fondation vérifiée',body:'Documentation',published:true,sort_order:3},
  {id:'2',kind:'history',heading:'Brouillon secret',body:'Unpublished',published:false,sort_order:0},
  {id:'3',kind:'values',heading:'Le collectif',body:'Engagement',published:true,sort_order:2},
  {id:'4',kind:'history',heading:'Anciens moments',body:'Détails',published:true,sort_order:1}
];

test('four known club categories stay precise and no invented association history',()=>{
 assert.deepEqual(CLUB_GROUPS.map(x=>x.name),['Seniors A','Seniors B','Seniors C','Vétérans']);
 assert.deepEqual(CLUB_GROUPS.map(x=>x.division),
  ['Départemental 3','Départemental 4','Matchs amicaux','Départemental 3']);
 assert.deepEqual(STORY_THEMES.map(x=>x.id),
  ['history','values','organization','projects']);
 assert.match(src,/aucune date historique n’est supposée/);
});

test('public story is filtered by explicit publication, theme and sort order',()=>{
 assert.deepEqual(filterPublishedStory(rows,'history').map(x=>x.id),['4','1']);
 assert.deepEqual(filterPublishedStory(rows,'values').map(x=>x.id),['3']);
 assert.equal(filterPublishedStory(rows,'projects').length,0);
 assert.deepEqual(filterPublishedStory(rows,'all').map(x=>x.id),['4','3','1']);
});

test('history and governance never expose drafts or unreviewed personal names',()=>{
 const timeline=[
  {period_label:'2020',published:false,sort_order:0},
  {period_label:'2024',published:true,sort_order:3},
  {period_label:'2026',published:true,sort_order:1}
 ];
 assert.deepEqual(publishedMilestones(timeline).map(x=>x.period_label),['2026','2024']);
 const roles=[
  {role_title:'Présidence',display_name:'Personne privée',published:true,consent_reviewed:false,sort_order:0},
  {role_title:'Commission sportive',display_name:null,published:true,consent_reviewed:false,sort_order:3},
  {role_title:'Trésorerie',display_name:'Nom autorisé',published:true,consent_reviewed:true,sort_order:2},
  {role_title:'Brouillon',display_name:null,published:false,consent_reviewed:true,sort_order:1}
 ];
 assert.deepEqual(publishedPublicPositions(roles).map(x=>x.role_title),
  ['Trésorerie','Commission sportive']);
});

test('RLS protects club content and consented governance names',()=>{
 for(const table of ['club_story_sections','club_story_milestones','club_public_positions']){
   assert.match(sql,new RegExp('create table if not exists public\\.'+table));
   assert.match(sql,new RegExp('alter table public\\.'+table+' enable row level security'));
 }
 assert.match(sql,/grant select on public\.club_story_sections,public\.club_story_milestones/);
 assert.match(sql,/revoke all on public\.club_story_sections,public\.club_story_milestones/);
 assert.match(sql,/using\(published=true\)/);
 assert.match(sql,/published=true and \(display_name is null or consent_reviewed=true\)/);
 assert.match(sql,/constraint public_position_consent check/);
 assert.doesNotMatch(sql,/insert into public\.(club_story_sections|club_story_milestones|club_public_positions)/i);
 assert.doesNotMatch(sql,/grant (insert|update|delete) on public\.club_/i);
});

test('no private data or writes in published-only public REST calls',async()=>{
 const urls=[];
 const fetcher=async(url,opts)=>{
   assert.equal(opts.method,'GET');
   urls.push(url);
   return {ok:true,json:async()=>[]};
 };
 const data=await loadClubStory(undefined,fetcher);
 assert.deepEqual(data,{sections:[],milestones:[],positions:[]});
 assert.equal(urls.length,3);
 assert.ok(urls.every(url=>url.includes('published=eq.true')));
 assert.ok(urls.some(url=>url.includes('/club_story_sections?')));
 assert.ok(urls.some(url=>url.includes('/club_story_milestones?')));
 assert.ok(urls.some(url=>url.includes('/club_public_positions?')));
 assert.doesNotMatch(urls.join(''),/profiles|user_roles|player_user_id|service_role/i);
 assert.doesNotMatch(src,/\.rpc\(|\.insert\(|\.update\(|innerHTML\s*=|method:'POST'/);
 assert.match(src,/textContent=String\(value\)/);
});

test('club page works in navigation, homepage and interactive demo',()=>{
 assert.match(app,/import \{mountClubStory,unmountClubStory\} from '\.\/club-story\.mjs'/);
 assert.match(app,/function club\(\)/);
 assert.match(app,/'\/club':club/);
 assert.match(app,/id="club-story-hub"/);
 assert.match(app,/if\(path==='\/club'\) void mountClubStory\(\); else unmountClubStory\(\);/);
 assert.match(app,/href="#\/club"/);
 assert.match(html,/href="#\/club"/);
 assert.match(demo,/label:'Le club',href:'#\/club'/);
 assert.match(src,/currentController\?\.abort\(\)/);
 assert.match(src,/generation!==current/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/safe-area-inset-bottom/);
});

test('a network failure cannot imply a fictional club biography',()=>{
 assert.match(src,/Aucune histoire, personne ou date non vérifiée n’est affichée/);
 assert.match(src,/La présentation officielle des fonctions et responsables n’a pas encore été publiée/);
 assert.match(src,/Les projets et événements seront décrits lorsqu’ils seront annoncés officiellement/);
});
