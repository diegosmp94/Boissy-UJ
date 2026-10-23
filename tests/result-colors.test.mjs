import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clubOutcome} from '../league-standings.mjs';
import {combinePublishedAgenda} from '../agenda.mjs';
import {mergeCalendarPublicEntries} from '../calendar-month.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const team={id:'uuid-a',code:'a',name:'Seniors A',discipline:'football'};
const sample=(id,homeScore,awayScore,isHome=true)=>({
  id,team_id:'uuid-a',opponent_name:'Club adverse',scheduled_at:'2026-10-18T15:00:00+02:00',
  published:true,match_status:'played',home_score:homeScore,away_score:awayScore,is_home:isHome
});
test('a published fixture has an outcome from Boissy UJ perspective, both home and away',()=>{
 const matches=[sample('green',2,0),sample('amber',1,1),sample('red',0,2),
  sample('away-green',0,2,false),sample('away-red',3,0,false)];
 const data=combinePublishedAgenda(matches,[],[team],{period:'all'});
 assert.deepEqual(Object.fromEntries(data.map(x=>[x.id,x.outcome])),{green:'V',amber:'N',red:'D','away-green':'V','away-red':'D'});
 assert.deepEqual(data.map(x=>x.status),Array(5).fill('played'));
 assert.equal(clubOutcome({...sample('draft',2,1),match_status:'scheduled'}),null);
 assert.equal(combinePublishedAgenda([sample('private',3,0)],[],[team],{
   period:'all'
 }).length,1);
 assert.equal(combinePublishedAgenda([{...sample('private',3,0),published:false}],[],[team],{
   period:'all'
 }).length,0);
});
test('a third-party result is coded but never marked as club confirmed',()=>{
 const sourced=[
  {team_code:'a',team_name:'Seniors A',dateOnly:true,localDay:'2026-09-20',
   time:Date.parse('2026-09-20T12:00:00Z'),opponent:'Club 1',
   source:'https://www.sportcorico.com/clubs/boissy-uj/boissy-uj',
   status:'played',result:'2 – 0',is_home:true,home_score:2,away_score:0},
  {team_code:'b',team_name:'Seniors B',dateOnly:true,localDay:'2026-09-20',
   time:Date.parse('2026-09-20T12:00:00Z'),opponent:'Club 2',
   source:'https://www.sportcorico.com/clubs/boissy-uj/boissy-uj',
   status:'played',result:'1 – 1',is_home:true,home_score:1,away_score:1},
  {team_code:'futsal',team_name:'Senior · Futsal',dateOnly:false,localDay:'2026-09-20',
   time:Date.parse('2026-09-20T12:00:00Z'),opponent:'Club 3',
   source:'https://www.sportcorico.com/clubs/boissy-uj/boissy-uj',
   status:'played',result:'0 – 1',is_home:true,home_score:0,away_score:1},
  {team_code:'a',team_name:'Seniors A',dateOnly:false,localDay:'2026-09-21',
   time:Date.parse('2026-09-21T12:00:00Z'),opponent:'Club 4',
   source:'https://www.sportcorico.com/clubs/boissy-uj/boissy-uj',
   status:'scheduled',is_home:true}
 ];
 const data=mergeCalendarPublicEntries([],sourced,[]);
 assert.deepEqual(data.map(x=>x.outcome),['V','N','D',null]);
 assert.ok(data.every(x=>x.external===true&&!x.href));
});
test('all three accessible color tokens are integrated into match center, team profiles, agenda and month view',()=>{
 const css=read('league-standings.css'),match=read('sport-center.mjs'),
  teamPage=read('team-pages.mjs'),agenda=read('agenda.mjs'),month=read('calendar-view.mjs');
 for(const [code,color] of [['V','#69dbaa'],['N','#ffcb70'],['D','#ffa4ad']]){
  assert.match(css,new RegExp('sport-outcome-'+code+'\\{[^}]*'+color,'i'));
  assert.match(css,new RegExp('sport-result-'+code,'i'));
  assert.match(css,new RegExp('month-calendar-event\\.is-result-'+code,'i'));
 }
 assert.match(css,/\.sport-outcome-N\{background:#69400e/);
 assert.match(match,/card\.classList\.add\('sport-result-'\+outcome\)/);
 assert.match(match,/card\.classList\.add\('sport-result-'\+win\)/);
 assert.match(teamPage,/card\.classList\.add\('sport-result-'\+outcome\)/);
 assert.match(teamPage,/item\.classList\.add\('sport-result-'\+outcome\)/);
 assert.match(agenda,/article\.classList\.add\('sport-result-'\+item\.outcome\)/);
 assert.match(month,/item\.outcome\?' is-result-'\+item\.outcome/);
 for(const className of ['is-win','is-draw','is-loss'])assert.ok(month.includes(className));
 assert.match(month,/Vert = victoire · jaune\/orange = nul · rouge = défaite/);
 assert.match(month,/mark\.setAttribute\('aria-label',label/);
 assert.match(match,/Légende des résultats des rencontres/);
 assert.match(teamPage,/Légende des résultats/);
});
