import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CONGRATULATED_TEAM_CODES,mondayOfParisWeek,victoryCongratulations,collectiveVictoryCongratulations} from '../victory-congratulations.mjs';
import {loadHomeVictory} from '../victory-home.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const teams=[
 {id:'uuid-a',code:'a'},{id:'uuid-b',code:'b'},{id:'uuid-c',code:'c'},
 {id:'uuid-v',code:'veterans'},{id:'uuid-f',code:'futsal'}
];
const now=Date.parse('2026-10-22T18:00:00+02:00');
const fixture=(team_id,extra={})=>({
 team_id,scheduled_at:'2026-10-18T15:00:00+02:00',
 published:true,match_status:'played',is_home:true,home_score:3,away_score:1,...extra
});
test('exact eligible team list: A, B, Veterans, Senior futsal; never Seniors C',()=>{
 assert.deepEqual(CONGRATULATED_TEAM_CODES,['a','b','veterans','futsal']);
 for(const code of CONGRATULATED_TEAM_CODES){
  const notice=victoryCongratulations(fixture('abc'),code);
  assert.match(notice.title,/Bravo/);
  assert.match(notice.message,/joueurs/);
  assert.match(notice.message,/staff/);
 }
 assert.equal(victoryCongratulations(fixture('abc'),'c'),null);
 assert.equal(victoryCongratulations(fixture('abc'),'unknown'),null);
});
test('victory notice only for published full-time victory; defeats, draws, drafts and sources excluded',()=>{
 const base=fixture('uuid-a');
 assert.ok(victoryCongratulations(base,'a'));
 assert.ok(victoryCongratulations({...base,is_home:false,home_score:1,away_score:2},'b'));
 for(const bad of [
  {...base,home_score:1,away_score:4},
  {...base,home_score:1,away_score:1},
  {...base,match_status:'scheduled'},
  {...base,match_status:'postponed'},
  {...base,published:false},
  {...base,published:undefined},
  {...base,home_score:null},
  {...base,scheduled_at:null}
 ])assert.equal(victoryCongratulations(bad,'a'),null);
});
test('collective celebration requires victories for all four in one Paris week',()=>{
 const wins=[fixture('uuid-a'),fixture('uuid-b'),fixture('uuid-v'),fixture('uuid-f')];
 const banner=collectiveVictoryCongratulations(wins,teams,{now});
 assert.ok(banner);
 assert.match(banner.title,/Boissy UJ/);
 assert.match(banner.message,/staffs/);
 assert.match(banner.message,/Vétérans/);
 assert.equal(banner.weekStart,'2026-10-12');
 assert.equal(collectiveVictoryCongratulations(wins.slice(0,3),teams,{now}),null);
 assert.equal(collectiveVictoryCongratulations(wins.map((x,i)=>i===1?{...x,home_score:1,away_score:2}:x),teams,{now}),null);
 assert.equal(collectiveVictoryCongratulations([...wins,fixture('uuid-a',{home_score:2,away_score:2})],teams,{now}),null);
 assert.ok(collectiveVictoryCongratulations([...wins,fixture('uuid-c',{home_score:7,away_score:0})],teams,{now}));
});
test('no false collective celebration across multiple weeks or from old/future fixtures',()=>{
 const wins=[fixture('uuid-a'),fixture('uuid-b'),fixture('uuid-v'),fixture('uuid-f')];
 const otherWeek=wins.map((x,i)=>i===3?{...x,scheduled_at:'2026-10-11T15:00:00+02:00'}:x);
 assert.equal(collectiveVictoryCongratulations(otherWeek,teams,{now}),null);
 assert.equal(collectiveVictoryCongratulations(wins,teams,{now:Date.parse('2026-12-31T18:00:00Z')}),null);
 assert.equal(collectiveVictoryCongratulations(wins,teams,{now:Date.parse('2026-10-15T18:00:00Z')}),null);
 assert.equal(collectiveVictoryCongratulations(wins.map(x=>({...x,published:false})),teams,{now}),null);
 assert.equal(mondayOfParisWeek('2026-10-18T23:30:00Z'),'2026-10-19');
 assert.equal(mondayOfParisWeek('2026-10-18T23:30:00+02:00'),'2026-10-12');
});
test('homepage reads public REST only and refuses external or missing data',async()=>{
 const seen=[];
 const wins=[fixture('uuid-a'),fixture('uuid-b'),fixture('uuid-v'),fixture('uuid-f')];
 const result=await loadHomeVictory({now,fetcher:async(url,options)=>{
  seen.push({url,options});
  return {ok:true,json:async()=>url.includes('club_teams')?teams:wins};
 }});
 assert.ok(result);
 assert.equal(seen.length,2);
 for(const request of seen){
  assert.equal(request.options.method,'GET');
  assert.doesNotMatch(request.url,/app_private|auth.users|role_requests|user_roles|service_role/);
 }
 assert.match(seen[1].url,/published=eq.true/);
 assert.match(seen[1].url,/match_status=eq.played/);
 assert.equal(await loadHomeVictory({now,fetcher:async(url)=>({
  ok:true,json:async()=>url.includes('club_teams')?teams:wins.slice(0,3)
 })}),null);
});
test('team page, Match Center and homepage mount conditional notices with no unsafe writes',()=>{
 const sport=read('sport-center.mjs'),team=read('team-pages.mjs'),
  app=read('app.js'),notice=read('victory-notice.mjs'),home=read('victory-home.mjs');
 assert.match(sport,/victoryCongratulations\(match,linked\?\.code\)/);
 assert.match(sport,/collectiveVictoryCongratulations\(matches,teams\)/);
 assert.match(sport,/createVictoryNotice\(collective,\{collective:true\}\)/);
 assert.match(team,/victoryCongratulations\(match,code\)/);
 assert.match(sport,/source_kind,published'/);
 assert.match(team,/home_score,away_score,published'/);
 assert.match(app,/id="home-victory-banner"/);
 assert.match(app,/mountHomeVictory\(\)/);
 assert.match(app,/unmountHomeVictory\(\)/);
 assert.match(notice,/heading\.textContent=title/);
 assert.match(notice,/paragraph\.textContent=message/);
 assert.match(home,/root\.replaceChildren\(\)/);
 assert.doesNotMatch(home+notice,/(?:innerHTML\s*=|method:'POST'|\.rpc\(|service_role)/);
 assert.match(read('index.html'),/victory-notice\.css/);
});
