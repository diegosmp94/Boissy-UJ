import test from 'node:test';
import assert from 'node:assert/strict';
import {publicExternalFixtures} from '../external-match-previews.mjs';
import {mergeCalendarPublicEntries} from '../calendar-month.mjs';
import {clubOutcome} from '../league-standings.mjs';
import {knownClubSeasonForm} from '../sourced-standings.mjs';

const rows=publicExternalFixtures({season:'2026-2027',period:'all',includePast:true});
const past=rows.filter(x=>x.localDay<'2026-10-23');
test('all ten documented current-season matches before 23 October have reviewed scores and kickoffs',()=>{
 assert.equal(past.length,10);
 assert.ok(past.every(x=>x.status==='played'&&x.reviewed_at==='2026-10-23'));
 assert.ok(past.every(x=>Number.isInteger(x.home_score)&&Number.isInteger(x.away_score)));
 assert.ok(past.every(x=>!x.dateOnly&&x.source.startsWith('https://www.sportcorico.com/match/')));
 assert.ok(past.every(x=>x.validated_by_club===false));
 const result=(team,day)=>past.find(x=>x.team_code===team&&x.localDay===day);
 for(const [team,day,score,outcome] of [
  ['b','2026-10-04','0 – 9','D'],['b','2026-10-18','2 – 2','N'],
  ['veterans','2026-10-04','10 – 2','D'],['veterans','2026-10-18','12 – 1','V'],
  ['futsal','2026-10-17','3 – 11','D']]){
  const match=result(team,day);
  assert.equal(match.result,score);
  assert.equal(clubOutcome({...match,match_status:'played'}),outcome);
 }
 assert.equal(result('a','2026-10-18').date,'2026-10-18T15:30:00+02:00');
 assert.equal(result('futsal','2026-10-17').venue,undefined,'inconsistent futsal venue not asserted');
 assert.ok(rows.filter(x=>x.localDay>='2026-10-23').every(x=>x.status==='scheduled'&&x.result===null));
});
test('shared month calendar carries new results, draw and victory colors and sourced venues',()=>{
 const calendar=mergeCalendarPublicEntries([],past,[]);
 assert.equal(calendar.length,10);
 const b=calendar.find(x=>x.teamCode==='b'&&x.localDay==='2026-10-18');
 assert.equal(b.outcome,'N');assert.match(b.info,/2 – 2/);
 assert.equal(b.place,'Stade Maurice Préault 1');
 const veterans=calendar.find(x=>x.teamCode==='veterans'&&x.localDay==='2026-10-18');
 assert.equal(veterans.outcome,'V');assert.match(veterans.info,/12 – 1/);
 assert.ok(calendar.every(x=>!x.href));
});
test('reviewed historical administrative victory never becomes a 0–5 or a draw',()=>{
 const archive=publicExternalFixtures({season:'2025-2026',period:'all',includePast:true});
 assert.equal(archive.length,37);
 assert.ok(archive.every(x=>x.reviewed_at==='2026-10-23'));
 const match=archive.find(x=>x.team_code==='futsal'&&x.localDay==='2026-05-08');
 assert.equal(match.status,'administrative');
 assert.equal(match.home_score,undefined);assert.equal(match.away_score,undefined);
 assert.match(match.result,/Gain administratif.*match non joué/);
 assert.match(match.source,/districtvaldemarne\.fff\.fr/);
 assert.equal(clubOutcome({...match,match_status:match.status}),'V');
 const entry=mergeCalendarPublicEntries([],[match],[])[0];
 assert.equal(entry.outcome,'V');assert.doesNotMatch(entry.info,/0 – 5|0 – 0/);
 const form=knownClubSeasonForm('futsal',{season:'2025-2026'});
 assert.equal(form.wins,2);assert.equal(form.draws,2);
 assert.equal(form.points,8);
});
