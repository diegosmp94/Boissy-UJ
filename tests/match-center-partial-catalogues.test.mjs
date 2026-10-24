import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadPublicSportCatalogs} from '../sport-center.mjs';
import {boundedPublicRequest} from '../public-catalog-timeout.mjs';

const code=readFileSync(new URL('../sport-center.mjs',import.meta.url),'utf8');
const teams=[
 {id:'a-id',code:'a',name:'Seniors A',discipline:'football'},
 {id:'b-id',code:'b',name:'Seniors B',discipline:'football'},
 {id:'c-id',code:'c',name:'Seniors C',discipline:'football'},
 {id:'v-id',code:'veterans',name:'Vétérans',discipline:'football'},
 {id:'f-id',code:'futsal',name:'Senior',discipline:'futsal'}
];
const match=(id='approved',team_id='a-id',published=true)=>({
 id,team_id,published,opponent_name:'Visiteurs',match_status:'played',
 scheduled_at:'2026-10-22T14:00:00Z',home_score:1,away_score:0
});
const rows={
 club_teams:teams,
 matches:[match(),match('draft','a-id',false)],
 club_seasons:[{id:'season-id',label:'2026-2027',state:'active'}]
};
const tableOf=url=>{
 for(const table of Object.keys(rows))if(url.includes('/'+table+'?'))return table;
 throw Error('Unexpected REST path');
};
function mock(changes={}){
 const calls=[];
 const fetcher=async(url,options)=>{
  assert.equal(options.method,'GET');
  assert.equal(options.cache,'no-store');
  assert.ok(url.includes('https://'));
  assert.ok(options.headers.apikey);
  const table=tableOf(url);
  calls.push({table,url});
  if(changes[table]==='error')return {ok:false,status:503};
  if(changes[table]==='invalid')return {ok:true,json:async()=>({error:'malformed'})};
  return {ok:true,json:async()=>changes[table]??rows[table]};
 };
 return {fetcher,calls};
}

test('successful independent catalogue reads retain published fixtures and five correct teams',async()=>{
 const {fetcher,calls}=mock();
 const data=await loadPublicSportCatalogs(undefined,fetcher);
 assert.equal(data.teams.length,5);
 assert.deepEqual(data.teams.map(t=>t.code),['a','b','c','veterans','futsal']);
 assert.equal(data.teams.at(-1).name,'Senior');
 assert.deepEqual(data.matches.map(x=>x.id),['approved']);
 assert.equal(data.seasons.length,1);
 assert.deepEqual(data.unavailable,[]);
 assert.deepEqual(calls.map(c=>c.table),['club_teams','matches','club_seasons']);
 assert.ok(calls.find(c=>c.table==='matches').url.includes('published=eq.true'));
 assert.ok(calls.every(c=>!/user_roles|auth.users|profiles|app_private/.test(c.url)));
});

test('season service outage never hides verified team fixtures or their scores',async()=>{
 const {fetcher}=mock({club_seasons:'error'});
 const data=await loadPublicSportCatalogs(undefined,fetcher);
 assert.deepEqual(data.matches.map(x=>x.id),['approved']);
 assert.deepEqual(data.seasons,[]);
 assert.deepEqual(data.unavailable,['club_seasons']);
 assert.ok(data.teams.every(t=>!t.id.startsWith('pending-')));
});

test('matches unavailable are not mislabeled as an empty official season',async()=>{
 const {fetcher}=mock({matches:'error'});
 const data=await loadPublicSportCatalogs(undefined,fetcher);
 assert.deepEqual(data.unavailable,['matches']);
 assert.deepEqual(data.matches,[]);
 assert.equal(data.teams.length,5);
 assert.equal(data.seasons.length,1);
 assert.match(code,/Rencontres publiées : source momentanément indisponible/);
 assert.match(code,/Calendrier du club momentanément indisponible/);
 assert.match(code,/Les autres rencontres restent consultables, mais ne sont pas confirmées par Boissy UJ/);
});

test('team catalogue unavailable does not bind official matches to fabricated team IDs',async()=>{
 const {fetcher}=mock({club_teams:'error'});
 const data=await loadPublicSportCatalogs(undefined,fetcher);
 assert.ok(data.teams.every(t=>t.id.startsWith('pending-')));
 assert.deepEqual(data.matches,[]);
 assert.deepEqual(data.unavailable,['club_teams']);
 assert.equal(data.seasons.length,1);
});

test('partial team catalogue retains verified games but never misattributes missing squads',async()=>{
 const {fetcher}=mock({
  club_teams:teams.filter(t=>t.code!=='b'),
  matches:[match('a-known','a-id'),match('b-unverified','b-id')]
 });
 const data=await loadPublicSportCatalogs(undefined,fetcher);
 assert.deepEqual(data.matches.map(x=>x.id),['a-known']);
 assert.equal(data.teams.find(t=>t.code==='a').id,'a-id');
 assert.equal(data.teams.find(t=>t.code==='b').id,'pending-b');
 assert.deepEqual(data.unavailable,['club_teams']);
});

test('invalid team disciplines and duplicate IDs never grant a false team mapping',async()=>{
 const invalidTeams=teams.map(t=>t.code==='futsal'
   ?{...t,id:'a-id',discipline:'football'}:t);
 const {fetcher}=mock({club_teams:invalidTeams,matches:[
  match('a-real','a-id'),match('f-unverifiable','f-id')
 ]});
 const data=await loadPublicSportCatalogs(undefined,fetcher);
 assert.deepEqual(data.matches.map(x=>x.id),['a-real']);
 assert.equal(data.teams.find(t=>t.code==='futsal').id,'pending-futsal');
 assert.deepEqual(data.unavailable,['club_teams']);
});

test('aborted route cancels outstanding requests instead of rendering misleading empty results',async()=>{
 const route=new AbortController();
 const deadline=boundedPublicRequest(route.signal,20);
 const stalled=(_url,{signal})=>new Promise((_,reject)=>{
  if(signal.aborted)return reject(new Error('aborted'));
  signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});
 });
 try{
  await assert.rejects(loadPublicSportCatalogs(deadline.signal,stalled),/Requête annulée/);
  assert.equal(deadline.signal.aborted,true);
  assert.equal(route.signal.aborted,false);
 }finally{deadline.dispose();}
});

test('partial publication UI retains internal navigation and never activates privileged writes',()=>{
 assert.match(code,/const settled=await Promise\.allSettled\(requests\)/);
 assert.match(code,/displayFixtures\(root,teams,matches,seasons,initialTeamCode,\{unavailable\}\)/);
 assert.match(code,/notice\.setAttribute\('role','status'\)/);
 assert.match(code,/if \(abort\.signal\.aborted \|\| generation!==renderGeneration/);
 assert.match(code,/publicExternalFixtures\(/);
 assert.match(code,/Ces rencontres restent à confirmer par le club/);
 assert.doesNotMatch(code,/method:'POST'|service_role|\.insert\(|\.upsert\(|\.delete\(|innerHTML\s*=/);
});
