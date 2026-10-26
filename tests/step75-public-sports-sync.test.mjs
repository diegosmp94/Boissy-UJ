import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 PUBLIC_MATCH_LIMIT,PUBLIC_MATCH_COLUMNS,publishedMatchParams,
 filterPublishedMatchRows,sourcedFixtureKey,clubDecisionKeys,
 unconfirmedWithoutClubDecision,watchPublicSportsRefresh
} from '../public-sports-sync.mjs';
import {loadPublishedUpcoming,mergeNextMatchCalendar} from '../home-next-match.mjs';
import {loadPublicSportCatalogs,splitMatches} from '../sport-center.mjs';
import {loadPublicAgenda,combinePublishedAgenda} from '../agenda.mjs';
import {loadTeamPublishedMatches} from '../team-pages.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const teams=[
 {id:'team-a',code:'a',name:'Seniors A',discipline:'football'},
 {id:'team-b',code:'b',name:'Seniors B',discipline:'football'},
 {id:'team-c',code:'c',name:'Seniors C',discipline:'football'},
 {id:'team-v',code:'veterans',name:'Vétérans',discipline:'football'},
 {id:'team-f',code:'futsal',name:'Senior',discipline:'futsal'}
];
const base={team_id:'team-a',scheduled_at:'2027-03-28T15:00:00+02:00',
 opponent_name:'Étoile Sportive',published:true,competition_kind:'league',
 competition_label:'Seniors D3',is_home:true,home_score:null,away_score:null};
const matches=[
 {...base,id:'future',match_status:'scheduled'},
 {...base,id:'past',match_status:'played',home_score:2,away_score:1},
 {...base,id:'delay',match_status:'postponed'},
 {...base,id:'cancellation',match_status:'cancelled'},
 {...base,id:'draft',published:false,match_status:'scheduled'},
 {...base,id:'badScore',match_status:'played',home_score:null,away_score:2}
];

test('all four pages use the identical club-published match projection and upper bound',()=>{
 const names=['sport-center.mjs','agenda.mjs','team-pages.mjs','home-next-match.mjs'];
 for(const path of names){
  const source=read(path);
  assert.match(source,/publishedMatchParams\(/);
  assert.match(source,/filterPublishedMatchRows\(/);
  assert.match(source,/watchPublicSportsRefresh|NEXT_MATCH_REFRESH_MS/);
 }
 assert.equal(PUBLIC_MATCH_LIMIT,500);
 for(const key of ['season_id','competition_kind','competition_label','match_status',
  'published','home_score','away_score'])assert.ok(PUBLIC_MATCH_COLUMNS.includes(key));
 const q=publishedMatchParams();
 assert.equal(q.published,'eq.true');
 assert.equal(q.limit,'500');
 assert.equal(q.order,'scheduled_at.asc');
 assert.equal(publishedMatchParams({team_id:'eq.team-a'}).team_id,'eq.team-a');
 assert.doesNotMatch(JSON.stringify(q),/player|profile|user|staff|service_role/i);
});

test('nonpublished, malformed and scoreless played records never enter official feed',()=>{
 assert.deepEqual(filterPublishedMatchRows(matches).map(x=>x.id),
  ['future','past','delay','cancellation']);
 assert.deepEqual(filterPublishedMatchRows([...matches,matches[0]]).map(x=>x.id),
  ['future','past','delay','cancellation']);
 assert.throws(()=>filterPublishedMatchRows(null),/Invalid/);
});

test('a club cancellation or postponement suppresses same sourced fixture even with accented names and DST',()=>{
 const date='2027-03-28T15:00:00+02:00';
 assert.equal(sourcedFixtureKey('a',date,'Étoile sportive'),
  sourcedFixtureKey('a','2027-03-28','Etoile sportive'));
 const source={team_code:'a',localDay:'2027-03-28',opponent:'Etoile sportive',
  time:Date.parse(date),status:'scheduled',is_home:true,competition:'Championnat'};
 const keys=clubDecisionKeys([{...base,id:'cancellation',match_status:'cancelled'}],teams);
 assert.equal(keys.size,1);
 for(const status of ['scheduled','played','postponed','cancelled']){
  const official={...base,id:'x-'+status,match_status:status,
   ...(status==='played'?{home_score:1,away_score:0}:{})};
  assert.deepEqual(unconfirmedWithoutClubDecision([source],[official],teams),[]);
  assert.deepEqual(mergeNextMatchCalendar([official],[source],teams)
   .filter(x=>!x.published),[]);
 }
 assert.equal(unconfirmedWithoutClubDecision([source],[],teams).length,1);
 assert.equal(unconfirmedWithoutClubDecision([source],
  [{...base,id:'draft',published:false,match_status:'scheduled'}],teams).length,1);
});

test('four public catalogues expose the same four club decisions with common limit',async()=>{
 const seen=[];
 const fetcher=async url=>{
  const table=new URL(url).pathname.split('/').at(-1);
  seen.push({table,url:new URL(url)});
  const data=table==='matches'?matches:table==='club_teams'?teams:
   table==='club_seasons'?[]:table==='club_events'?[]:[];
  return {ok:true,json:async()=>data};
 };
 const sport=await loadPublicSportCatalogs(undefined,fetcher);
 const agenda=await loadPublicAgenda(undefined,fetcher);
 const home=await loadPublishedUpcoming({now:Date.parse('2026-10-26T12:00:00Z'),fetcher});
 const team=await loadTeamPublishedMatches('a',{fetcher});
 for(const rows of [sport.matches,agenda.matches,home.matches,team.matches])
  assert.deepEqual(rows.map(x=>x.id),['future','past','delay','cancellation']);
 for(const item of seen.filter(x=>x.table==='matches')){
  assert.equal(item.url.searchParams.get('published'),'eq.true');
  assert.equal(item.url.searchParams.get('limit'),'500');
  assert.equal(item.url.searchParams.get('select'),PUBLIC_MATCH_COLUMNS);
 }
 assert.equal(sport.teams.at(-1).name,'Senior');
 assert.equal(team.configured,true);
 assert.equal(team.teamId,'team-a');
});

test('agenda shows postponed/cancelled without scores and keeps results for played matches',()=>{
 const entries=combinePublishedAgenda(filterPublishedMatchRows(matches),[],teams,{
  now:Date.parse('2026-10-26T12:00:00Z'),period:'all'
 });
 assert.equal(entries.length,4);
 assert.match(entries.find(x=>x.id==='delay').info,/reportée/i);
 assert.match(entries.find(x=>x.id==='cancellation').info,/annulée/i);
 assert.match(entries.find(x=>x.id==='past').info,/2 – 1/);
 assert.deepEqual(splitMatches(filterPublishedMatchRows(matches)).cancelled.map(x=>x.id),
  ['cancellation']);
 assert.match(read('sport-center.mjs'),/Rencontres annulées/);
 assert.match(read('team-pages.mjs'),/Matchs annulés/);
});

test('mounted page refresh occurs hourly/on resume, and cleanup removes its handlers',()=>{
 const mapW=new Map(),mapD=new Map(),windowTarget={
  addEventListener:(name,fn)=>mapW.set(name,fn),
  removeEventListener:(name,fn)=>{if(mapW.get(name)===fn)mapW.delete(name);}
 };
 const doc={visibilityState:'visible',
  addEventListener:(name,fn)=>mapD.set(name,fn),
  removeEventListener:(name,fn)=>{if(mapD.get(name)===fn)mapD.delete(name);}
 };
 let time=0,calls=0,on=true;
 const cleanup=watchPublicSportsRefresh({
  refresh:()=>{calls++;},active:()=>on,now:()=>time,
  intervalMs:3600000,minResumeMs:60000,
  windowTarget,documentTarget:doc
 });
 mapW.get('focus')();assert.equal(calls,0);
 time=60000;mapW.get('focus')();assert.equal(calls,1);
 doc.visibilityState='hidden';time=180000;mapD.get('visibilitychange')();
 assert.equal(calls,1);
 doc.visibilityState='visible';mapD.get('visibilitychange')();
 assert.equal(calls,2);
 on=false;time=240000;mapW.get('focus')();assert.equal(calls,2);
 cleanup();
 assert.equal(mapW.size,0);assert.equal(mapD.size,0);
});
