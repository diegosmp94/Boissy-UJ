import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildPublicCalendar,escapeCalendarText,foldCalendarLine} from '../calendar-export.mjs';
import {combinePublishedAgenda} from '../agenda.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const now=Date.parse('2026-10-22T16:00:00+02:00');
const start=Date.parse('2026-10-25T15:00:00+02:00');
const teams=[{id:'team-a',name:'Seniors A',discipline:'football'}];
const matches=[
 {id:'11111111-1111-4111-8111-111111111111',team_id:'team-a',scheduled_at:new Date(start).toISOString(),match_status:'scheduled',published:true,opponent_name:'Club invité',is_home:true},
 {id:'22222222-2222-4222-8222-222222222222',team_id:'team-a',scheduled_at:new Date(start).toISOString(),match_status:'scheduled',published:false,opponent_name:'Brouillon'},
 {id:'33333333-3333-4333-8333-333333333333',team_id:'team-a',scheduled_at:new Date(start).toISOString(),match_status:'cancelled',published:true,opponent_name:'Annulé'}
];
const events=[
 {id:'44444444-4444-4444-8444-444444444444',starts_at:new Date(start+86400000).toISOString(),ends_at:new Date(start+86400000+7200000).toISOString(),title:'Assemblée publique',published:true,access_kind:'public',location_label:'Gymnase'},
 {id:'55555555-5555-4555-8555-555555555555',starts_at:new Date(start).toISOString(),title:'Événement réservé',published:true,access_kind:'premium'}
];
test('calendar exports only published future public dates',()=>{
 const rows=combinePublishedAgenda(matches,events,teams,{now,period:'future'});
 const calendar=buildPublicCalendar(rows,{now});
 assert.equal(rows.length,2);
 assert.equal((calendar.match(/BEGIN:VEVENT/g)||[]).length,2);
 assert.match(calendar,/BEGIN:VCALENDAR\r\nVERSION:2\.0/);
 assert.match(calendar,/DTSTART:20261025T130000Z/);
 assert.match(calendar,/DTEND:20261026T150000Z/);
 for(const secret of ['Brouillon','Annulé','Événement réservé','auth.users','token'])assert.equal(calendar.includes(secret),false);
 assert.ok(calendar.endsWith('END:VCALENDAR\r\n'));
});
test('calendar respects visible filters and rejects empty exports',()=>{
 const items=combinePublishedAgenda(matches,events,teams,{now,kind:'event'});
 const calendar=buildPublicCalendar(items,{now});
 assert.equal((calendar.match(/BEGIN:VEVENT/g)||[]).length,1);
 assert.doesNotMatch(calendar,/UID:match-/);
 assert.throws(()=>buildPublicCalendar([]),/Aucun rendez-vous/);
 assert.throws(()=>buildPublicCalendar(null),TypeError);
});
test('calendar safely escapes text and folds UTF-8 lines to 75 octets',()=>{
 assert.equal(escapeCalendarText('A,B;C\nE'),'A\\,B\\;C\\nE');
 const folded=foldCalendarLine('SUMMARY:'+'É'.repeat(70));
 assert.ok(folded.includes('\r\n '));
 for(const part of folded.split('\r\n'))assert.ok(Buffer.byteLength(part,'utf8')<=75);
 assert.equal(folded.replace(/\r\n /g,''),'SUMMARY:'+'É'.repeat(70));
 const calendar=buildPublicCalendar([{kind:'event',id:'event-1',time:start,title:'Réunion; revue, du club\nSuite',place:'Salle A'}],{now});
 assert.match(calendar,/SUMMARY:Réunion\\; revue\\, du club\\nSuite/);
});
test('public agenda integrates accessible download without private writes',()=>{
 const js=read('agenda.mjs'),css=read('agenda.css');
 assert.match(js,/import \{buildPublicCalendar\} from '\.\/calendar-export\.mjs'/);
 assert.match(js,/Exporter les dates sélectionnées \(\.ics\)/);
 assert.match(js,/exportBtn\.disabled=true/);
 assert.match(js,/exportBtn\.disabled=exportedEntries\.length===0/);
 assert.match(js,/URL\.createObjectURL\(blob\)/);
 assert.match(js,/URL\.revokeObjectURL\(url\)/);
 assert.match(css,/\.agenda-export:focus-visible/);
 assert.match(css,/prefers-reduced-motion/);
 assert.doesNotMatch(js,/(?:method:'POST'|\.rpc\(|localStorage\.setItem)/);
});
