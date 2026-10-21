import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {splitMatches,scoreLabel,statusLabel} from '../sport-center.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const migration=read('supabase/migrations/202610210003_sport_public_v1.sql');
const loader=read('sport-center.mjs');
const app=read('app.js');

test('legacy football teams stay intact before adding D2 futsal',()=>{
 for (const text of ["'a','Seniors A','Départemental 3'","'b','Seniors B','Départemental 4'","'c','Seniors C','Matchs amicaux'","'veterans','Vétérans','Départemental 3'"]) assert.ok(migration.includes(text));
});
test('published scores must be complete, all others scoreless',()=>{
 assert.match(migration,/constraint played_scores_required/);
 assert.match(migration,/match_status = 'played' and home_score is not null and away_score is not null/);
 assert.match(migration,/constraint published_match_requires_date/);
 assert.match(migration,/published boolean not null default false/);
});
test('teams and matches are public-read-only with RLS enabled',()=>{
 assert.match(migration,/alter table public.club_teams enable row level security/);
 assert.match(migration,/alter table public.matches enable row level security/);
 assert.match(migration,/revoke all on public.club_teams, public.matches from anon, authenticated/);
 assert.match(migration,/grant select on public.club_teams, public.matches to anon, authenticated/);
 assert.match(migration,/using \(published = true\)/);
 assert.doesNotMatch(migration,/for (insert|update|delete) to (anon|authenticated)/i);
});
test('match lists separate upcoming and played results without guessing',()=>{
 const rows=[
  {match_status:'played',scheduled_at:'2026-10-01T15:00:00Z',home_score:3,away_score:2},
  {match_status:'scheduled',scheduled_at:'2026-10-31T15:00:00Z',home_score:null,away_score:null},
  {match_status:'played',scheduled_at:'2026-09-01T15:00:00Z',home_score:1,away_score:0},
  {match_status:'postponed',scheduled_at:'2026-11-02T15:00:00Z',home_score:null,away_score:null}
 ];
 const {upcoming,results}=splitMatches(rows);
 assert.deepEqual(upcoming.map(x=>x.match_status),['scheduled','postponed']);
 assert.deepEqual(results.map(x=>x.home_score),[3,1]);
 assert.equal(scoreLabel(rows[0]),'3 – 2');
 assert.equal(scoreLabel(rows[1]),'VS');
 assert.equal(statusLabel('cancelled'),'Annulé');
});
test('sports module is read-only and uses DOM textContent for remote data',()=>{
 assert.match(loader,/method:'GET'/);
 assert.match(loader,/published:'eq.true'/);
 assert.match(loader,/node.textContent = String\(text\)/);
 assert.match(loader,/AbortController\(\)/);
 assert.doesNotMatch(loader,/\.insert\(|\.update\(|\.delete\(|method:'POST'|innerHTML\s*=/);
});
test('Match Center route mounts and unmounts public sports loader',()=>{
 assert.match(app,/from '\.\/sport-center.mjs'/);
 assert.match(app,/id="match-center-live"/);
 assert.match(app,/if\(path==='\/matchs'\) void mountSport\(\); else unmountSport\(\)/);
});
test('previous conflicting unused SQL is explicitly archived',()=>{
 assert.match(read('supabase/migrations/20261020220000_core_v1.sql'),/ancienne proposition de migration NON appliquée/);
 assert.match(read('docs/ARCHIVE_CORE_V1.md'),/Ne pas l.exécuter/);
});

test('missing database retains five teams and clearly marked empty fixture lists',()=>{
 assert.match(loader,/const FALLBACK_TEAMS = Object\.freeze\(\[/);
 assert.match(loader,/id:'pending-a'/);
 assert.match(loader,/id:'pending-veterans'/);
 assert.match(loader,/id:'pending-futsal'/);
 assert.match(loader,/displayFixtures\(root,FALLBACK_TEAMS,\[\]\)/);
 assert.match(loader,/source du calendrier n’est pas encore disponible/);
 assert.match(loader,/notice\.setAttribute\('role','status'\)/);
 assert.match(read('styles.css'),/\.sport-notice\s*\{/);
});
