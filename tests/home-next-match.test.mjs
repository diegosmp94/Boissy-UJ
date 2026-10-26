import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 NEXT_MATCH_REFRESH_MS,parisNextMidnight,nextMatchBoundary,
 nextUpcomingMatch,nextMatchRefreshDelay,mergeNextMatchCalendar,loadPublishedUpcoming
} from '../home-next-match.mjs';
import {publicExternalFixtures} from '../external-match-previews.mjs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const fixture=(time,other={})=>({
 time:Date.parse(time),localDay:time.slice(0,10),dateOnly:false,status:'scheduled',
 teamCode:'a',opponent:'Club visiteur',is_home:true,published:false,...other
});
test('home synchronizes from same 2026-27 calendar as Match Center and Agenda',()=>{
 const sourced=publicExternalFixtures({now:0,period:'all',includePast:true,season:'2026-2027'});
 const combined=mergeNextMatchCalendar([],sourced,[]);
 const now=Date.parse('2026-10-23T09:50:00+02:00');
 const next=nextUpcomingMatch(combined,now);
 assert.ok(next);
 assert.equal(next.teamCode,'futsal');
 assert.equal(next.opponent,'FC Chennevières 1');
 assert.equal(next.localDay,'2026-10-24');
 assert.equal(next.published,false);
 assert.equal(next.clubConfirmed,false);
 assert.equal(next.status,'scheduled');
 assert.equal(combined.some(x=>x.localDay.startsWith('2027-05')),true);
 assert.ok(combined.every(x=>!('href' in x)&&!('source' in x)));
});
test('at kickoff time the card immediately picks following fixture, even if DB status remains scheduled',()=>{
 const first=fixture('2027-05-09T15:00:00+02:00',{opponent:'Moldavie FC'});
 const second=fixture('2027-05-16T15:00:00+02:00',{opponent:'Nogent FC'});
 const fixtures=[second,first];
 const kick=first.time;
 assert.equal(nextUpcomingMatch(fixtures,kick-1).opponent,'Moldavie FC');
 assert.equal(nextUpcomingMatch(fixtures,kick).opponent,'Nogent FC');
 assert.equal(nextUpcomingMatch(fixtures,second.time),null);
 assert.equal(nextMatchRefreshDelay(fixtures,kick-15000),16000);
 assert.equal(nextMatchRefreshDelay(fixtures,kick-4*3600000),NEXT_MATCH_REFRESH_MS);
 assert.equal(nextMatchRefreshDelay([],kick),NEXT_MATCH_REFRESH_MS);
});
test('actual kickoff, not midday placeholder, controls day-only entries and DST',()=>{
 const d='2027-02-20';
 const end=parisNextMidnight(d);
 assert.equal(new Date(end).toISOString(),'2027-02-20T23:00:00.000Z');
 assert.equal(new Date(parisNextMidnight('2027-05-16')).toISOString(),'2027-05-16T22:00:00.000Z');
 assert.equal(new Date(parisNextMidnight('2027-03-28')).toISOString(),'2027-03-28T22:00:00.000Z');
 const dayOnly=fixture('2027-02-20T12:00:00Z',{dateOnly:true,localDay:d,opponent:'FC Chennevières'});
 const before=Date.parse('2027-02-20T19:00:00Z');
 assert.equal(nextMatchBoundary(dayOnly),end);
 assert.equal(nextUpcomingMatch([dayOnly],before).opponent,'FC Chennevières');
 assert.equal(nextUpcomingMatch([dayOnly],end),null);
 assert.equal(nextMatchRefreshDelay([dayOnly],end-4000),5000);
});
test('played, unknown, cancelled and expired matches cannot remain next match',()=>{
 const now=Date.parse('2026-11-15T15:00:00+01:00');
 const cases=[
  fixture('2026-11-15T14:00:00+01:00',{opponent:'Déjà commencé'}),
  fixture('2026-11-16T10:00:00+01:00',{status:'played'}),
  fixture('2026-11-16T12:00:00+01:00',{status:'unknown'}),
  fixture('2026-11-16T14:00:00+01:00',{status:'cancelled'}),
  fixture('2026-11-16T16:00:00+01:00',{status:'scheduled',opponent:''}),
  fixture('2026-11-22T15:00:00+01:00',{opponent:'Match suivant'})
 ];
 assert.equal(nextUpcomingMatch(cases,now).opponent,'Match suivant');
});
test('source calendar de-duplicates same team/day/opponent when club has published it',()=>{
 const source=publicExternalFixtures({period:'all',includePast:true,season:'2026-2027'})
  .find(x=>x.team_code==='futsal'&&x.opponent==='FC Chennevières 1');
 assert.ok(source);
 const official={id:'uuid-match',team_id:'futsal-id',scheduled_at:source.date,
  opponent_name:source.opponent,is_home:false,published:true,match_status:'scheduled',
  competition_label:'Senior futsal D2 · Poule B',venue:'Gymnase municipal'};
 const result=mergeNextMatchCalendar([official],[source],[{id:'futsal-id',code:'futsal'}]);
 assert.equal(result.length,1);
 assert.equal(result[0].published,true);
 assert.equal(result[0].sourceLabel,'Boissy UJ');
 assert.equal(result[0].venue,'Gymnase municipal');
 assert.equal(result[0].clubConfirmed,true);
 const notApproved=mergeNextMatchCalendar(
  [{...official,published:false,match_status:'played'}],[source],[{id:'futsal-id',code:'futsal'}]);
 assert.equal(notApproved.length,1);
 assert.equal(notApproved[0].published,false);
});
test('published cancellations, postponements and results suppress the sourced next match',()=>{
 const source=publicExternalFixtures({period:'all',includePast:true,season:'2026-2027'})
  .find(x=>x.team_code==='futsal'&&x.opponent==='FC Chennevières 1');
 const club={id:'decision',team_id:'futsal-id',scheduled_at:source.date,
  opponent_name:source.opponent,is_home:source.is_home,published:true};
 const teams=[{id:'futsal-id',code:'futsal'}];
 for(const match_status of ['cancelled','postponed','played']){
  const fixtures=mergeNextMatchCalendar([{...club,match_status}],[source],teams);
  assert.deepEqual(fixtures,[],match_status+' must not restore source');
  assert.equal(nextUpcomingMatch(fixtures,0),null);
 }
 // Another team/date/opponent is a separate fixture and must remain visible.
 for(const change of [{team_id:'a-id'},{scheduled_at:'2026-10-25T15:00:00+01:00'},
   {opponent_name:'Autre club'},{published:false}]){
  const fixtures=mergeNextMatchCalendar([{...club,match_status:'cancelled',...change}],
   [source],[...teams,{id:'a-id',code:'a'}]);
  assert.equal(fixtures.length,1);
  assert.equal(fixtures[0].opponent,source.opponent);
 }
});
test('read-only Supabase loader includes published status changes for source overrides',async()=>{
 const requests=[];
 const values=[[{id:'id-a',code:'a',name:'Seniors A'}],[
  {id:'one',team_id:'id-a',opponent_name:'FC Hoverla 1',
   scheduled_at:'2027-02-10T15:00:00+01:00',published:true,match_status:'scheduled'}
 ]];
 const rows=await loadPublishedUpcoming({now:Date.parse('2027-01-20T12:00:00Z'),
  fetcher:async(url,opts)=>{
   const index=requests.length;
   requests.push({url,opts});
   return {ok:true,json:async()=>values[index]};
  }});
 assert.equal(rows.teams[0].code,'a');
 assert.equal(rows.matches[0].opponent_name,'FC Hoverla 1');
 assert.equal(requests.length,2);
 assert.ok(requests.every(x=>x.opts.method==='GET'&&x.opts.cache==='no-store'));
 assert.ok(requests.every(x=>x.opts.headers.apikey));
 assert.match(requests[1].url,/published=eq.true/);
 assert.equal(new URL(requests[1].url).searchParams.has('match_status'),false);
 assert.match(requests[1].url,/limit=500/);
 assert.ok(requests.every(x=>!x.url.includes('service_role')));
});
test('homepage scoreboard is mounted only at home with cleanup and internal link destinations',()=>{
 const app=read('app.js'),module=read('home-next-match.mjs'),styles=read('home-next-match.css'),
 html=read('index.html');
 assert.match(app,/id="home-next-match"/);
 assert.match(app,/mountHomeNextMatch\(\); else unmountHomeNextMatch\(\)/);
 assert.doesNotMatch(app,/Calendrier en cours de préparation/);
 assert.match(module,/setTimeout\(/);
 assert.match(module,/NEXT_MATCH_REFRESH_MS=60\*60\*1000/);
 assert.match(module,/visibilitychange/);
 assert.match(module,/window\.addEventListener\('focus'/);
 assert.match(module,/controller\?\.abort\(\)/);
 assert.match(module,/draw\(\);\s*void sync\(\)/);
 assert.match(module,/\.href='#\/matchs'/);
 assert.match(module,/profile\.href=teamRoute\(team\)/);
 assert.doesNotMatch(module,/\.href=[a-z]+\.source|window\.open|target='_blank'/);
 assert.match(html,/home-next-match\.css/);
 assert.match(styles,/@media\(max-width:380px\)/);
});
