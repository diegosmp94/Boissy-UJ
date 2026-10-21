import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  normalizeAwardText,filterAwards,publishedWinner,fetchPublishedAwards
} from '../awards-center.mjs';

const get=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=get('supabase/migrations/202610210014_public_awards_catalog.sql');
const ui=get('awards-center.mjs');
const app=get('app.js');
const index=get('index.html');
const css=get('styles.css');
const categories=[
  {id:'one',title:'Joueur de la saison',description:'Performances',season_label:'2026/2027',
    team_code:'a',voting_status:'coming',results_published:false},
  {id:'two',title:'Révélation de l’année',description:'Progression',season_label:'2026/2027',
    team_code:'b',voting_status:'finished',results_published:true},
  {id:'three',title:'Esprit d’équipe',description:'Solidarité',season_label:null,
    team_code:'c',voting_status:'closed',results_published:false}
];
const nominee={id:'nom-1',award_id:'two',display_label:'Candidat approuvé',
  published:true,consent_reviewed:true,sort_order:0};

test('public catalogue is restricted to Seniors A/B/C, never fictitious winners or payments',()=>{
 assert.match(sql,/team_code in \('a','b','c'\)/);
 assert.match(sql,/create table if not exists public\.club_awards/);
 assert.match(sql,/create table if not exists public\.club_award_nominees/);
 assert.match(sql,/create table if not exists public\.club_award_results/);
 assert.doesNotMatch(sql,/insert into public\.(club_awards|club_award_nominees|club_award_results)/i);
 assert.doesNotMatch(ui,/stripe|checkout|method:'POST'|\.rpc\(/i);
});

test('RLS restricts draft awards, unreviewed names and unpublished winners',()=>{
 for(const t of ['club_awards','club_award_nominees','club_award_results']){
   assert.match(sql,new RegExp('alter table public\\.'+t+' enable row level security'));
 }
 assert.match(sql,/revoke all on public\.club_awards,public\.club_award_nominees,public\.club_award_results/);
 assert.match(sql,/using \(published=true\)/);
 assert.match(sql,/published=true and consent_reviewed=true/);
 assert.match(sql,/a\.results_published=true and a\.voting_status='finished'/);
 assert.match(sql,/n\.published=true and n\.consent_reviewed=true/);
 assert.match(sql,/foreign key \(award_id,nominee_id\)/);
 assert.doesNotMatch(sql,/grant (insert|update|delete) on public\.club_awards/i);
});

test('filter categories by team, stage and search without accents',()=>{
 assert.equal(normalizeAwardText('ÉDITION RÉVÉLATION'),'edition revelation');
 assert.deepEqual(filterAwards(categories,{team:'a'}).map(x=>x.id),['one']);
 assert.deepEqual(filterAwards(categories,{status:'closed'}).map(x=>x.id),['three']);
 assert.deepEqual(filterAwards(categories,{query:'revelation'}).map(x=>x.id),['two']);
 assert.deepEqual(filterAwards(categories,{query:'seniors c'}).map(x=>x.id),['three']);
 assert.equal(filterAwards(categories,{team:'b',status:'coming'}).length,0);
});

test('winner stays hidden until results are published and nominee reviewed',()=>{
 assert.equal(publishedWinner(categories[0],[],[nominee]),null);
 assert.equal(publishedWinner(categories[1],[],[nominee]),null);
 assert.deepEqual(publishedWinner(categories[1],[{award_id:'two',nominee_id:'nom-1'}],[nominee]),nominee);
 assert.equal(publishedWinner({...categories[1],results_published:false},
   [{award_id:'two',nominee_id:'nom-1'}],[nominee]),null);
 assert.equal(publishedWinner({...categories[1],voting_status:'open'},
   [{award_id:'two',nominee_id:'nom-1'}],[nominee]),null);
 assert.equal(publishedWinner(categories[1],[{award_id:'two',nominee_id:'nom-1'}],
   [{...nominee,consent_reviewed:false}]),null);
});

test('fetch only explicitly published records and consented nominees',async()=>{
 const seen=[];
 const mock=async(url,opt)=>{
   seen.push({url,method:opt.method});
   if(url.includes('club_awards?'))return {ok:true,json:async()=>categories};
   if(url.includes('club_award_nominees?'))return {ok:true,json:async()=>[nominee]};
   if(url.includes('club_award_results?'))return {ok:true,json:async()=>[]};
   throw new Error('Unexpected table');
 };
 const result=await fetchPublishedAwards(undefined,mock);
 assert.equal(result.awards.length,3);
 assert.equal(result.nominees.length,1);
 assert.equal(result.results.length,0);
 assert.equal(seen.length,3);
 assert.ok(seen.every(x=>x.method==='GET'));
 assert.match(seen[0].url,/published=eq.true/);
 assert.match(seen[1].url,/consent_reviewed=eq.true/);
 assert.doesNotMatch(seen.map(x=>x.url).join(''),/user_roles|profiles|email|auth.users/);
});

test('SPA mounts and unmounts awards route; reachable via community and mobile',()=>{
 assert.match(app,/import \{mountAwards,unmountAwards\} from '\.\/awards-center\.mjs'/);
 assert.match(app,/function awards\(\)/);
 assert.match(app,/'\/awards':awards/);
 assert.match(app,/if\(path==='\/awards'\) void mountAwards\(\); else unmountAwards\(\);/);
 assert.match(app,/id="awards-public-catalog"/);
 assert.match(app,/href="#\/awards"/);
 assert.match(index,/href="#\/awards"/);
 assert.match(ui,/controller\?\.abort\(\)/);
 assert.doesNotMatch(ui,/innerHTML\s*=/);
});

test('honest no-vote messaging, accessible filters and mobile overflow constraints',()=>{
 assert.match(app,/Aucun vote actif/);
 assert.match(app,/Aucun achat, vote ou classement fictif/);
 assert.match(ui,/Aucun nominé officiellement publié/);
 assert.match(ui,/Aucune nomination fictive/);
 assert.match(ui,/aria-label/);
 assert.match(css,/\.award-controls/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/env\(safe-area-inset-bottom/);
});
