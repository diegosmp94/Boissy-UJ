import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REMAINING_OFFICIAL_SEASON_FIXTURES} from '../remaining-official-season-fixtures.mjs';
import {publicExternalFixtures,EXTERNAL_FIXTURE_REVIEWED_AT} from '../external-match-previews.mjs';
import {mergeCalendarPublicEntries,monthGrid} from '../calendar-month.mjs';
import {competitionKind} from '../competition-tabs.mjs';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('remaining verified-source league fixtures run from 2026 through end May 2027',()=>{
 assert.equal(REMAINING_OFFICIAL_SEASON_FIXTURES.length,43);
 const expected={a:['2027-05-30',10],b:['2027-05-30',11],
  veterans:['2027-05-23',10],futsal:['2027-05-17',12]};
 for(const [code,[end,count]] of Object.entries(expected)){
  const list=REMAINING_OFFICIAL_SEASON_FIXTURES.filter(x=>x.team_code===code);
  assert.equal(list.length,count);
  assert.equal(list.at(-1).date.slice(0,10),end);
  assert.ok(list.every(x=>x.status==='scheduled'&&x.home_score===undefined&&
    x.away_score===undefined&&x.date_confirmed_by_club===false));
 }
 assert.equal(REMAINING_OFFICIAL_SEASON_FIXTURES.some(x=>x.team_code==='c'),false);
 assert.equal(REMAINING_OFFICIAL_SEASON_FIXTURES.some(x=>x.opponent==='Exempt'),false);
 assert.equal(REMAINING_OFFICIAL_SEASON_FIXTURES.some(x=>/Boissy FC|Boissy 91/.test(x.opponent)),false);
 assert.equal(EXTERNAL_FIXTURE_REVIEWED_AT,'2026-10-23');
});
test('date-only FUTSAL fixture has no invented kickoff hour or future score',()=>{
 const match=publicExternalFixtures({team:'futsal',season:'2026-2027',period:'all',includePast:true})
  .find(x=>x.localDay==='2027-02-20');
 assert.equal(match.dateOnly,true);
 assert.equal(match.status,'scheduled');
 assert.equal(match.result,null);
 assert.equal(match.home_score,undefined);
 assert.equal(match.competition,'Senior futsal D2 · Poule B');
});
test('season calendar has no duplicated team-day-opponent or cup entries from new league schedule',()=>{
 const list=publicExternalFixtures({season:'2026-2027',period:'all',includePast:true});
 const keys=new Set();
 for(const x of list){
  const key=x.team_code+'|'+x.localDay+'|'+x.opponent;
  assert.equal(keys.has(key),false,'duplicate '+key);
  keys.add(key);
  assert.ok(Number.isFinite(x.time));
  if(x.status==='scheduled'){
   assert.equal(x.result,null);
   assert.equal(x.validated_by_club,false);
  }
 }
 assert.ok(list.length>=66);
 assert.ok(REMAINING_OFFICIAL_SEASON_FIXTURES.every(x=>competitionKind(x)==='league'));
 for(const x of REMAINING_OFFICIAL_SEASON_FIXTURES){
  const fixture=list.find(y=>y.team_code===x.team_code&&y.localDay===x.date.slice(0,10)&&
   y.opponent===x.opponent);
  assert.ok(fixture);
  assert.equal(fixture.date_confirmed_by_club,false);
  assert.equal(fixture.source_label,'SportCorico');
 }
});
test('monthly public calendar shows spring 2027 fixtures and team profile links',()=>{
 const list=publicExternalFixtures({period:'all',includePast:true,season:'2026-2027'});
 const merged=mergeCalendarPublicEntries([],list,[]);
 for(const [year,month,team] of [[2027,0,'veterans'],[2027,2,'b'],[2027,4,'a']]){
  const days=monthGrid(year,month,merged);
  assert.ok(days.some(d=>d.inMonth&&d.entries.some(e=>e.teamCode===team)));
 }
 assert.ok(merged.filter(x=>x.localDay.startsWith('2027-05')).length>=4);
 assert.ok(merged.every(x=>x.external&&!x.href));
 assert.match(src('team-pages.mjs'),/publicExternalFixtures\(\{team:code,includePast:true,period:'all'\}\)/);
 assert.match(src('sport-center.mjs'),/publicExternalFixtures\(/);
 assert.match(src('agenda.mjs'),/mergeCalendarPublicEntries\(allPublished,sourced,rows\.teams\)/);
});
test('older published club results remain separate; external match dates do not trigger congratulations',()=>{
 const page=src('team-pages.mjs'),center=src('sport-center.mjs');
 assert.match(page,/victoryCongratulations\(match,code\)/);
 assert.doesNotMatch(src('remaining-official-season-fixtures.mjs'),/club_validated:true|validated_by_club:true/);
 assert.match(center,/Ces rencontres restent à confirmer par le club/);
});
