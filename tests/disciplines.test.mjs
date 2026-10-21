import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CLUB_TEAMS,DISCIPLINES,teamsByDiscipline,disciplineLabel} from '../club-teams.mjs';
import {filterPublishedFixtures} from '../sport-center.mjs';
import {validateTeamFormRows} from '../team-stats.mjs';
import {validateMatchDraft} from '../match-workspace.mjs';
import {combinePublishedAgenda} from '../agenda.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610210019_football_futsal_teams.sql');
const app=read('app.js'),styles=read('disciplines.css');

test('four football teams and one futsal D2 with unique codes',()=>{
  assert.equal(CLUB_TEAMS.length,5);
  assert.deepEqual(DISCIPLINES.map(x=>x.id),['football','futsal']);
  assert.deepEqual(teamsByDiscipline('football').map(t=>t.code),['a','b','c','veterans']);
  assert.deepEqual(teamsByDiscipline('futsal').map(t=>t.code),['futsal']);
  assert.equal(CLUB_TEAMS.find(t=>t.code==='futsal').division,'Départemental 2');
  assert.equal(disciplineLabel('futsal'),'Futsal');
  assert.equal(new Set(CLUB_TEAMS.map(t=>t.code)).size,5);
});

test('sport filtering never mixes football and futsal fixtures',()=>{
  const teams=[
    {id:'football-uuid',discipline:'football'},
    {id:'futsal-uuid',discipline:'futsal'}
  ];
  const matches=[
    {id:'1',team_id:'football-uuid',season_id:'s1',published:true},
    {id:'2',team_id:'futsal-uuid',season_id:'s1',published:true},
    {id:'3',team_id:'futsal-uuid',season_id:'s2',published:true}
  ];
  assert.deepEqual(filterPublishedFixtures(matches,{discipline:'football',teams}).map(m=>m.id),['1']);
  assert.deepEqual(filterPublishedFixtures(matches,{discipline:'futsal',teams}).map(m=>m.id),['2','3']);
  assert.deepEqual(filterPublishedFixtures(matches,{discipline:'futsal',teams,seasonId:'s1'}).map(m=>m.id),['2']);
  assert.deepEqual(filterPublishedFixtures(matches,{teamId:'football-uuid',discipline:'futsal',teams}),[]);
});

test('futsal results are computed only from published rows (all five summary entries)',()=>{
  const rows=CLUB_TEAMS.map(t=>({code:t.code,name:t.name,division:t.division,
    played:0,wins:0,draws:0,losses:0,goals_for:0,goals_against:0
  }));
  assert.equal(validateTeamFormRows(rows).length,5);
  assert.throws(()=>validateTeamFormRows(rows.slice(0,4)),/Incomplete team summary/);
  assert.throws(()=>validateTeamFormRows([...rows.slice(0,4),{...rows[4],played:1}]),/Inconsistent results/);
});
test('futsal match drafts are accepted but falsely verified FFF origin is rejected',()=>{
  const values={team:'futsal',opponent:'Adversaire',when:'2026-11-08T15:00',
    venue:'',status:'scheduled',source:'manual',reference:'',
    homeScore:'',awayScore:'',season:''};
  assert.equal(validateMatchDraft(values).valid,true);
  assert.equal(validateMatchDraft({...values,source:'fff',reference:'invented'}).valid,false);
  assert.equal(validateMatchDraft({...values,team:'a',source:'fff',reference:'reference club'}).valid,true);
});
test('agenda contains distinct futsal discipline label',()=>{
  const futsalId='futsal-id';
  const published=[{id:'fixture',team_id:futsalId,opponent_name:'Adversaire',
    scheduled_at:'2026-11-08T15:00:00Z',published:true,match_status:'scheduled'}];
  const events=combinePublishedAgenda(published,[],[
    {id:futsalId,name:'Boissy-UJ Futsal',discipline:'futsal'}],{now:Date.parse('2026-10-21T12:00:00Z')});
  assert.equal(events[0].subtitle,'Futsal · Boissy-UJ Futsal');
});
test('migration preserves existing UUIDs and RLS and adds only futsal club team',()=>{
  assert.match(sql,/add column if not exists discipline text not null default 'football'/);
  assert.match(sql,/check \(sort_order between 1 and 5\)/);
  assert.match(sql,/discipline='futsal' and code='futsal'/);
  assert.match(sql,/on conflict \(code\) do nothing/);
  assert.match(sql,/values \('futsal','Boissy-UJ Futsal','Départemental 2','manual',5,'futsal'\)/);
  assert.doesNotMatch(sql,/delete from|truncate|drop table|update public\.user_roles|insert into public\.matches/i);
});
test('UI separates teams and provides safe local navigation, unchanged auth',()=>{
  assert.match(app,/teamsByDiscipline\('football',teams\)/);
  assert.match(app,/teamsByDiscipline\('futsal',teams\)/);
  assert.match(app,/id="football-section"/);
  assert.match(app,/id="futsal-section"/);
  assert.match(app,/data-discipline-target="futsal-section"/);
  assert.match(app,/BOISSY-UJ FUTSAL/);
  assert.match(styles,/\.discipline-section/);
  assert.match(styles,/@media\(max-width:760px\)/);
  assert.match(read('auth-config.mjs'),/enabled:\s*false/);
});
