import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CLUB_TEAMS,resolveTeamRoute,teamRoute,teamsByDiscipline} from '../club-teams.mjs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('Seniors Futsal name is consistent with the football Seniors teams',()=>{
 assert.deepEqual(CLUB_TEAMS.filter(t=>t.discipline==='football').slice(0,3).map(t=>t.name),['Seniors A','Seniors B','Seniors C']);
 const [futsal]=teamsByDiscipline('futsal');
 assert.equal(futsal.name,'Seniors Futsal');
 assert.equal(futsal.discipline,'futsal');
 assert.equal(futsal.code,'futsal');
 assert.equal(futsal.division,'Départemental 2');
 assert.equal(futsal.tag,'D2');
});
test('historic futsal URLs and identifiers remain stable after the rename',()=>{
 const futsal=CLUB_TEAMS.find(t=>t.code==='futsal');
 assert.equal(futsal.slug,'boissy-uj-futsal');
 assert.equal(teamRoute(futsal),'#/equipes/futsal/boissy-uj-futsal');
 assert.equal(resolveTeamRoute('/equipes/futsal/boissy-uj-futsal').team?.name,'Seniors Futsal');
 assert.equal(CLUB_TEAMS.length,5);
 assert.equal(new Set(CLUB_TEAMS.map(t=>t.code)).size,5);
});
test('homepage, sections and public specifications show the new display name',()=>{
 const app=read('app.js');
 assert.match(app,/<strong>SENIORS FUTSAL<\/strong>/);
 assert.match(app,/Seniors Futsal · Départemental 2/);
 assert.match(app,/Seniors Futsal joue en Départemental 2/);
 assert.doesNotMatch(app,/BOISSY-UJ FUTSAL|Boissy-UJ Futsal/);
 assert.match(read('docs/CAHIER_DES_CHARGES.md'),/avec Seniors Futsal \(Départemental 2/);
});
test('Supabase migration only updates the single futsal display name, with a safety guard',()=>{
 const sql=read('supabase/migrations/202610220004_seniors_futsal_name.sql');
 assert.match(sql,/update public\.club_teams\s+set name='Seniors Futsal'/);
 assert.match(sql,/where code='futsal' and discipline='futsal' and name='Boissy-UJ Futsal'/);
 assert.match(sql,/Expected futsal team not found/);
 assert.match(sql,/Unexpected existing futsal team name/);
 assert.doesNotMatch(sql,/update public\.(matches|staff_team_assignments|user_roles)|delete\s+from|drop\s+table|truncate/i);
});
