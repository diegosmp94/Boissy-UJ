import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CLUB_TEAMS,teamRoute} from '../club-teams.mjs';
import {clubOutcome,standingComputed,validateStandings,moveRanking,fetchPublicStandings} from '../league-standings.mjs';
import {rankingPayload} from '../admin-league.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const rows=[
 {position:1,name:'Club A',played:4,wins:3,draws:1,losses:0,goals_for:11,goals_against:3,points_adjustment:0},
 {position:2,name:'Boissy UJ',played:4,wins:2,draws:1,losses:1,goals_for:9,goals_against:7,points_adjustment:0},
 {position:3,name:'Club B',played:4,wins:1,draws:0,losses:3,goals_for:4,goals_against:12,points_adjustment:-1}
];
test('W/D/L is computed from Boissy UJ perspective, not from home-team perspective',()=>{
 assert.equal(clubOutcome({match_status:'played',is_home:true,home_score:3,away_score:0}),'V');
 assert.equal(clubOutcome({match_status:'played',is_home:false,home_score:1,away_score:3}),'V');
 assert.equal(clubOutcome({match_status:'played',is_home:false,home_score:3,away_score:0}),'D');
 assert.equal(clubOutcome({match_status:'played',is_home:true,home_score:1,away_score:1}),'N');
 assert.equal(clubOutcome({match_status:'scheduled',is_home:true,home_score:1,away_score:0}),null);
 assert.equal(clubOutcome({match_status:'played',home_score:null,away_score:0}),null);
});
test('league total, goal difference and penalty are recalculated from real rows',()=>{
 assert.equal(standingComputed(rows[0]).points,10);
 assert.equal(standingComputed(rows[1]).points,7);
 assert.equal(standingComputed(rows[1]).goalDifference,2);
 assert.equal(standingComputed(rows[2]).points,2);
 assert.equal(validateStandings(rows).length,3);
});
test('admin can manually reorder rank after a round; original input is unchanged',()=>{
 const moved=moveRanking(rows,1,-1);
 assert.deepEqual(moved.map(x=>x.name),['Boissy UJ','Club A','Club B']);
 assert.deepEqual(moved.map(x=>x.position),[1,2,3]);
 assert.equal(rows[0].name,'Club A');
 assert.deepEqual(moveRanking(rows,0,-1),rows);
 assert.deepEqual(moveRanking(rows,2,1),rows);
});
test('invalid, duplicate, contradictory, and non-integer ranking rows are refused',()=>{
 assert.throws(()=>validateStandings([{...rows[0],played:17}]),/invalide/);
 assert.throws(()=>validateStandings([rows[0],{...rows[1],position:1}]),/invalide/);
 assert.throws(()=>validateStandings([rows[0],{...rows[1],name:'CLUB A'}]),/invalide/);
 assert.throws(()=>rankingPayload([{...rows[0],wins:-2}]),/incohérentes/);
 assert.throws(()=>rankingPayload([{...rows[0],goals_for:'20.5'}]),/incohérentes/);
 assert.throws(()=>rankingPayload([{...rows[0],name:'x'}]),/invalide/);
});
test('data is retrieved only from published Supabase standings, in public read-only mode',async()=>{
 const requests=[];
 const result=await fetchPublicStandings({fetcher:async(url,options)=>{
  requests.push({url,options});
  return {ok:true,json:async()=>[
   {team_id:'foo',published:true,matchday:4,entries:rows},
   {team_id:'bar',published:false,matchday:1,entries:rows}
  ]};
 }});
 assert.equal(result.length,1);
 assert.equal(result[0].entries[0].points,10);
 assert.equal(requests.length,1);
 assert.match(requests[0].url,/published=eq.true/);
 assert.equal(requests[0].options.method,'GET');
 assert.doesNotMatch(requests[0].url,/auth.users|app_private|updated_by|audit/);
});
test('league editor uses protected backend RPC, never directly writes database',()=>{
 const admin=read('admin-league.mjs'),center=read('admin-management.mjs');
 assert.match(admin,/adminSessionStatus\(api,userId\)/);
 assert.match(admin,/api\.rpc\('admin_save_league_standings',payload\)/);
 assert.match(admin,/api\.rpc\('admin_list_league_standings'\)/);
 assert.match(admin,/publish\.checked/);
 assert.match(admin,/key!==confirmKey/);
 assert.match(admin,/moveRanking\(rows,index,-1\)/);
 assert.match(center,/mountAdminLeagueEditor\(leaguePanel,api,userId\)/);
 assert.doesNotMatch(admin,/\.insert\(|\.update\(|\.delete\(|service_role|fetch\(/);
});
test('profile and Match Center mount rankings and real per-team deep links',()=>{
 const app=read('app.js'),sport=read('sport-center.mjs'),month=read('calendar-view.mjs'),
  team=read('team-pages.mjs'),html=read('index.html');
 assert.match(app,/mountLeagueStandings\(activeTeam\.code\)/);
 assert.match(app,/mountLeagueStandings\(route\.teamCode\)/);
 assert.match(app,/id="team-league-standing"/);
 assert.match(html,/league-standings\.css/);
 assert.match(sport,/Fiche '+/);
 assert.match(sport,/clubOutcome\(match\)/);
 assert.match(month,/profile\.href=teamRoute\(team\)/);
 assert.match(team,/publicExternalFixtures\(\{team:code,includePast:true,period:'all'\}\)/);
 for(const t of CLUB_TEAMS)assert.equal(teamRoute(t).startsWith('#/equipes/'),true);
});
test('database migration enforces MFA, private audit and RLS, not fabricated official status',()=>{
 const sql=read('supabase/migrations/202610220010_league_standings_admin.sql');
 assert.match(sql,/app_private\.is_admin\(\)/);
 assert.match(sql,/security definer set search_path=''/);
 assert.match(sql,/team_league_standings enable row level security/);
 assert.match(sql,/using \(published=true\)/);
 assert.match(sql,/revoke all on public\.team_league_standings from public,anon,authenticated/);
 assert.match(sql,/app_private\.league_standings_audit/);
 assert.match(sql,/grant execute on function public\.admin_save_league_standings/);
 assert.doesNotMatch(sql,/insert into public\.team_league_standings.*Boissy/s);
});
