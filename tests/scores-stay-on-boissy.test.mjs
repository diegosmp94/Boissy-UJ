import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {combinePublishedAgenda} from '../agenda.mjs';
import {mergeCalendarPublicEntries} from '../calendar-month.mjs';
import {publicExternalFixtures} from '../external-match-previews.mjs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('every public sports result page renders data without clickable outbound source links',()=>{
 for(const path of ['team-pages.mjs','sport-center.mjs','agenda.mjs',
   'calendar-view.mjs','calendar-month.mjs','sourced-standings.mjs']){
  const s=source(path);
  assert.doesNotMatch(s,/\.href\s*=\s*(?:m\.source|match\.source|archive\.source|source)\s*;/);
  assert.doesNotMatch(s,/Vérifier sur .*↗|Vérifier la source ↗|Voir le classement archivé ↗|Consulter le résultat source ↗/);
  assert.doesNotMatch(s,/https:\/\/epreuves\.fff\.fr/);
  assert.doesNotMatch(s,/SportCorico|TheFootData|Source du relevé|Sources des résultats|Source du classement historique/);
 }
 assert.match(source('team-pages.mjs'),/À confirmer par le club/);
 assert.match(source('sport-center.mjs'),/Score :/);
 assert.match(source('agenda.mjs'),/Score :/);
 assert.match(source('sourced-standings.mjs'),/Classement historique à confirmer par le club/);
 assert.match(source('calendar-view.mjs'),/!item\.external&&typeof item\.href==='string'&&item\.href\.startsWith\('#\/'\)/);
});
test('historical scored source matches are fully readable locally with no offsite navigation URL',()=>{
 const items=publicExternalFixtures({team:'a',includePast:true,period:'all'});
 const calendar=mergeCalendarPublicEntries([],items,[]);
 const result=calendar.find(x=>x.title.includes("Bann'zanmi"));
 assert.ok(result);
 assert.equal(result.outcome,'V');
 assert.match(result.info,/6 – 1/);
 assert.equal(result.external,true);
 assert.equal(result.sourceLabel,'SportCorico'); // provenance preserved in internal data
 assert.equal(result.subtitle,'Résultat à confirmer par le club');
 assert.doesNotMatch(result.subtitle,/SportCorico|TheFootData/);
 assert.equal(result.href,undefined);
 assert.equal(calendar.some(x=>typeof x.href==='string'&&x.href.startsWith('http')),false);
});
test('internal club event and match routing remains available on the website',()=>{
 const now=Date.parse('2026-10-02T00:00:00Z');
 const records=combinePublishedAgenda([{
  id:'match-1',team_id:'team-a',scheduled_at:'2026-11-08T14:00:00Z',
  opponent_name:'Club visiteur',match_status:'scheduled',is_home:true,published:true
 }],[{
  id:'event-1',starts_at:'2026-11-10T18:00:00Z',access_kind:'public',
  published:true,title:'Événement du club'
 }],[{id:'team-a',code:'a',name:'Seniors A',discipline:'football'}],{period:'all',now});
 assert.deepEqual(records.map(x=>x.href),['#/matchs','#/evenements']);
 assert.equal(records.every(x=>x.href.startsWith('#/')),true);
 assert.match(source('sport-center.mjs'),/page\.href=teamRoute\(teamProfile\)/);
});
test('agenda sourced matches are no longer globally suppressed when one team publishes a fixture',()=>{
 const s=source('agenda.mjs');
 assert.match(s,/const publishedKeys=new Set/);
 assert.match(s,/const suggestions=type\.value==='event'\?\[\]:publicExternalFixtures/);
 assert.doesNotMatch(s,/rows\.matches\.some\(m=>m\.published===true\)\|\|type\.value==='event'/);
 assert.match(s,/publishedKeys\.has\(m\.team_code/);
});
