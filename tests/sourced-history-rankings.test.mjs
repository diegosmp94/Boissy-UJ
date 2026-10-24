import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicExternalFixtures} from '../external-match-previews.mjs';
import {HISTORICAL_SOURCE_RESULTS} from '../historical-source-results.mjs';
import {ARCHIVED_LEAGUE_POSITIONS,knownClubSeasonForm} from '../sourced-standings.mjs';
import {mergeCalendarPublicEntries,monthGrid} from '../calendar-month.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('historic score archive is attributed, distinct by club, year and competition',()=>{
 assert.equal(HISTORICAL_SOURCE_RESULTS.length,37);
 assert.equal(HISTORICAL_SOURCE_RESULTS.filter(x=>x.team_code==='a').length,3);
 assert.equal(HISTORICAL_SOURCE_RESULTS.filter(x=>x.team_code==='b').length,15);
 assert.equal(HISTORICAL_SOURCE_RESULTS.filter(x=>x.team_code==='futsal').length,19);
 assert.ok(HISTORICAL_SOURCE_RESULTS.every(x=>x.season==='2025-2026'&&x.source.startsWith('https://')));
 const b=publicExternalFixtures({season:'2025-2026',team:'b',includePast:true,period:'all'});
 assert.equal(b.length,15);
 assert.equal(b.find(x=>x.opponent==='Bry FC').competition,'Coupe Seniors Amitié');
 assert.equal(b.find(x=>x.opponent==='FC Hoverla'&&x.is_home===false).result,'8 – 2');
 assert.ok(b.every(x=>x.source_label==='TheFootData'&&x.validated_by_club===false&&x.dateOnly));
});
test('2026–27 current form includes league games ONLY, no cup result or imaginary ranking',()=>{
 const form=knownClubSeasonForm('a');
 assert.deepEqual([form.played,form.wins,form.draws,form.losses,form.points,form.goals_for,form.goals_against],
  [3,2,0,1,6,9,3]);
 assert.equal(form.competition,'Seniors D3 · Poule B');
 assert.equal(knownClubSeasonForm('c'),null);
 for(const [team,expected] of [['b',[2,0,1,1,1,2,11]],['veterans',[2,1,0,1,3,14,11]],['futsal',[1,0,0,1,0,3,11]]]){
  const f=knownClubSeasonForm(team);
  assert.deepEqual([f.played,f.wins,f.draws,f.losses,f.points,f.goals_for,f.goals_against],expected);
 }
 assert.equal(Object.hasOwn(ARCHIVED_LEAGUE_POSITIONS,'futsal'),false);
 assert.equal(Object.hasOwn(ARCHIVED_LEAGUE_POSITIONS,'veterans'),false);
});
test('historic league positions are labeled previous season only',()=>{
 const a=ARCHIVED_LEAGUE_POSITIONS.a,b=ARCHIVED_LEAGUE_POSITIONS.b;
 assert.deepEqual([a.season,a.position,a.points,a.played],['2025-2026',2,43,18]);
 assert.deepEqual([b.season,b.position,b.points,b.played],['2025-2026',5,12,14]);
 assert.equal(b.wins*3+b.draws,b.points);
 const previousB=knownClubSeasonForm('b',{season:'2025-2026'});
 assert.deepEqual([previousB.played,previousB.wins,previousB.draws,previousB.losses,previousB.points],[14,3,3,8,12]);
});
test('agenda month grid and team cards can surface archived results without treating them as club confirmed',()=>{
 const sourced=publicExternalFixtures({season:'2025-2026',team:'b',includePast:true,period:'all'});
 const merged=mergeCalendarPublicEntries([],sourced,[]);
 assert.ok(merged.every(x=>x.external===true&&x.subtitle.includes('à confirmer par le club')&&x.info.includes('2025-2026')&&x.sourceLabel==='TheFootData'));
 const month=monthGrid(2026,0,merged);
 assert.ok(month.find(d=>d.key==='2026-01-11').entries.some(x=>x.outcome==='V'));
 const matchCenter=read('sport-center.mjs'),teamPages=read('team-pages.mjs'),rankings=read('league-standings.mjs');
 assert.match(matchCenter,/Archives des matchs et résultats/);
 assert.match(matchCenter,/match\.season/);
 assert.match(teamPages,/m\.season/);
 assert.match(rankings,/appendSourcedSportContext\(section,team\.code\)/);
 assert.doesNotMatch(read('historical-source-results.mjs')+read('sourced-standings.mjs'),
  /method:'POST'|\.insert\(|\.rpc\(|service_role/);
});

test('private and public data separation is enforced for 42 archived scores',()=>{
 const migration=read('supabase/migrations/202610220011_external_match_archive_readonly.sql');
 const found=migration.match(/\$archive_json\$(\[[\s\S]*?\])\$archive_json\$/);
 assert.ok(found,'SQL must contain a traceable source snapshot');
 const entries=JSON.parse(found[1]);
 assert.equal(entries.length,42);
 assert.deepEqual([...new Set(entries.map(x=>x.season))].sort(),['2025-2026','2026-2027']);
 assert.ok(entries.every(x=>x.source_url.startsWith('https://')&&x.home_score>=0&&x.away_score>=0));
 assert.match(migration,/enable row level security/);
 assert.match(migration,/grant select on public\.external_sourced_match_archive to anon,authenticated/);
 assert.match(migration,/club_validated boolean not null default false check \(club_validated=false\)/);
 assert.doesNotMatch(migration,/insert into public\.matches/);
});
test('past rankings stay visible even after a verified current league table is published',()=>{
 const rank=read('league-standings.mjs'),sourced=read('sourced-standings.mjs');
 assert.match(rank,/appendSourcedSportContext\(section,team\.code,\{includeCurrent:false\}\)/);
 assert.match(sourced,/if\(current&&includeCurrent\)/);
 assert.match(sourced,/if\(archive\)/);
 assert.match(read('team-pages.mjs'),/Saison des rencontres archivées de cette équipe/);
 assert.match(read('sport-center.mjs'),/Filtrer les archives des matchs par saison/);
 assert.match(read('league-standings.css'),/\.team-profile-match\[hidden\]\{display:none!important\}/);
});
