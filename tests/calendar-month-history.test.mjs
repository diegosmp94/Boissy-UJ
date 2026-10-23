import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parisDateKey,shiftCalendarMonth,monthGrid,calendarMonthTitle,mergeCalendarPublicEntries} from '../calendar-month.mjs';
import {publicExternalFixtures} from '../external-match-previews.mjs';
import {combinePublishedAgenda} from '../agenda.mjs';

const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const now=Date.parse('2026-10-22T17:00:00+02:00');
test('calendar displays source-attributed real past scored games and upcoming fixtures, not just future',()=>{
 const matches=publicExternalFixtures({now,period:'all',includePast:true});
 const history=matches.filter(x=>x.status==='played'&&x.season==='2026-2027');
 assert.equal(history.filter(x=>x.team_code==='a').length,4);
 assert.equal(history.find(x=>x.opponent==="Bann'zanmi 2").result,'6 – 1');
 assert.equal(history.find(x=>x.opponent==='Moldavie FC 1').result,'1 – 3');
 assert.equal(history.find(x=>x.opponent==='Villejuif US 1').result,'6 – 0');
 assert.equal(history.find(x=>x.opponent==='Villiers-sur-Marne ES 2').result,'1 – 0');
 assert.equal(history.find(x=>x.opponent==='Petits Anges ES 1').result,'3 – 7');
 assert.ok(matches.some(x=>x.status==='scheduled'&&x.team_code==='futsal'));
 assert.ok(matches.every(x=>x.validated_by_club===false));
 assert.ok(matches.every(x=>x.source.startsWith('https://www.sportcorico.com/')||x.source.startsWith('https://thefootdata.com/')));
});
test('incorrect other-club fixtures are removed, Seniors B is sourced to its actual opponent',()=>{
 const matches=publicExternalFixtures({now,period:'all',includePast:true});
 assert.ok(!matches.some(x=>x.opponent==='SFC Canavérois 1'&&x.team_code==='b'&&x.localDay==='2026-11-01'));
 assert.ok(matches.some(x=>x.opponent==='SFC Canavérois 1'&&x.team_code==='b'&&x.localDay==='2026-11-15'));
 const b=matches.find(x=>x.team_code==='b'&&x.season==='2026-2027');
 assert.equal(b.opponent,'Val de Fontenay AS 2');
 assert.match(b.source,/val-de-fontenay-as/);
 assert.ok(matches.some(x=>x.team_code==='futsal'&&x.team_name==='Senior · Futsal'));
});
test('month grid shows September historical results and handles Monday-start offsets',()=>{
 const matches=publicExternalFixtures({now,period:'all',includePast:true});
 const all=mergeCalendarPublicEntries([],matches,[]);
 const september=monthGrid(2026,8,all);
 assert.equal(september.length%7,0);
 assert.ok(september.find(x=>x.key==='2026-09-20').entries.some(x=>x.title.includes("Bann'zanmi")));
 const october=monthGrid(2026,9,all);
 assert.ok(october.find(x=>x.key==='2026-10-04').entries.some(x=>x.info.startsWith('1 – 3')));
 assert.equal(shiftCalendarMonth(2026,0,-1).year,2025);
 assert.deepEqual(shiftCalendarMonth(2026,11,1),{year:2027,month:0});
 assert.match(calendarMonthTitle(2026,9),/octobre 2026/i);
 assert.equal(parisDateKey('2026-10-25T23:30:00Z'),'2026-10-26');
});
test('published club matches override the same team, date and opponent from external source',()=>{
 const external=publicExternalFixtures({now,period:'all',includePast:true});
 const reference=external.find(x=>x.team_code==='a'&&x.opponent==='Nogent-sur-Marne FC 3');
 const confirmed=[{kind:'match',id:'club-match-1',teamId:'uuid-a',time:reference.time,
  localDay:reference.localDay,opponent:'Nogent-sur-Marne FC 3',title:'Match confirmé',status:'scheduled'}];
 const data=mergeCalendarPublicEntries(confirmed,external,[{id:'uuid-a',code:'a'}]);
 assert.equal(data.filter(x=>x.kind==='match'&&x.opponent==='Nogent-sur-Marne FC 3'&&x.localDay===reference.localDay).length,1);
 assert.equal(data.filter(x=>x.id==='club-match-1').length,1);
});
test('club-published past results appear in agenda with score and proper status, draft excluded',()=>{
 const teams=[{id:'a',code:'a',name:'Seniors A',discipline:'football'}];
 const matches=[
  {id:'played',team_id:'a',opponent_name:'Moldavie FC 1',scheduled_at:'2026-10-04T15:00:00+02:00',
   match_status:'played',home_score:1,away_score:3,is_home:false,published:true},
  {id:'unpublished',team_id:'a',opponent_name:'Secret',scheduled_at:'2026-10-04T15:00:00+02:00',match_status:'played',published:false}
 ];
 const merged=combinePublishedAgenda(matches,[],teams,{period:'all',now});
 assert.equal(merged.length,1);
 assert.equal(merged[0].status,'played');
 assert.match(merged[0].info,/1 – 3/);
 assert.equal(combinePublishedAgenda(matches,[],teams,{period:'future',now}).length,0);
});
test('month view is real DOM interactive, accessible, and does not mutate backend',()=>{
 const view=read('calendar-view.mjs'),agenda=read('agenda.mjs'),css=read('agenda.css');
 assert.match(view,/aria-pressed/);
 assert.match(view,/month-calendar-nav/);
 assert.match(view,/shiftCalendarMonth/);
 assert.match(view,/month-calendar-event/);
 assert.match(agenda,/mountMonthCalendar/);
 assert.match(agenda,/includePast:true,period:'all'/);
 assert.match(agenda,/select:'id,team_id,opponent_name,scheduled_at,venue,is_home,match_status,published,home_score,away_score'/);
 assert.match(css,/month-calendar-board/);
 assert.match(css,/max-width:600px/);
 for(const src of [view,read('calendar-month.mjs')]){
  assert.doesNotMatch(src,/(?:\.rpc\(|method:'POST'|\.insert\(|\.update\(|localStorage)/);
 }
});
