import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CLUB_TEAMS,checkArticle,checkMatchNote} from '../staff-workflows.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ui=read('staff-workflows.mjs');
const control=read('control-center.mjs');
const sql=read('supabase/migrations/202610210006_staff_content_workflows.sql');
const auth=read('auth-config.mjs');

test('four existing club categories are respected without inventing rosters',()=>{
  assert.deepEqual(CLUB_TEAMS.map(t=>t.code),['a','b','c','veterans']);
  assert.deepEqual(CLUB_TEAMS.map(t=>t.division),[
    'Départemental 3','Départemental 4','Matchs amicaux','Départemental 3'
  ]);
});
test('article draft validates title, body, team and excerpt',()=>{
  assert.deepEqual(checkArticle({
    team:'a',title:'Un match important',excerpt:'Résultats et programme',
    body:'Un texte saisi par le club.'
  }).errors,[]);
  assert.equal(checkArticle({team:'unknown',title:'abc',body:''}).valid,false);
  assert.equal(checkArticle({team:'b',title:'Titre correct',excerpt:'x'.repeat(401),body:'Texte'}).valid,false);
  assert.equal(checkArticle({team:'c',title:'Titre correct',body:'T'.repeat(20001)}).valid,false);
  assert.equal(checkArticle({team:'veterans',title:'   Titre   ',body:'   Texte  '}).title,'Titre');
});
test('match preparation validates an actual team, opponent and date',()=>{
  assert.equal(checkMatchNote({team:'c',opponent:'Equipe invitée',when:'2026-12-01T15:00'}).valid,true);
  assert.equal(checkMatchNote({team:'c',opponent:'',when:'2026-12-01T15:00'}).valid,false);
  assert.equal(checkMatchNote({team:'admin',opponent:'Rival',when:'2026-12-01T15:00'}).valid,false);
  assert.equal(checkMatchNote({team:'a',opponent:'Rival',when:'nonsense'}).valid,false);
});
test('Control Center integrates both local draft workspaces',()=>{
  assert.match(control,/import \{mountTeamWorkspace,mountMediaWorkspace\} from '\.\/staff-workflows\.mjs'/);
  assert.match(control,/if\(module\.id==='teams'\)\{mountTeamWorkspace\(root\);return\}/);
  assert.match(control,/if\(module\.id==='media'\)\{mountMediaWorkspace\(root\);return\}/);
  assert.match(ui,/Prévisualiser la fiche/);
  assert.match(ui,/Prévisualiser le brouillon/);
  assert.match(ui,/Aucun article enregistré ni publié/);
});
test('draft workspaces are ephemeral and cannot mutate the published site',()=>{
  assert.match(ui,/Simulation locale — aucune modification enregistrée/);
  assert.match(ui,/aucune modification enregistrée/);
  assert.match(ui,/node\.textContent\s*=\s*String\(value\)/);
  assert.doesNotMatch(ui,/fetch\(|localStorage|sessionStorage|\.rpc\(|\.from\(|\.insert\(|\.update\(|innerHTML\s*=/);
  assert.match(auth,/enabled:\s*false/);
});
test('assignments are team-scoped and not writable from public clients',()=>{
  assert.match(sql,/create table if not exists public\.staff_team_assignments/);
  assert.match(sql,/primary key \(coach_user_id,team_id\)/);
  assert.match(sql,/alter table public\.staff_team_assignments enable row level security/);
  assert.match(sql,/revoke all on public\.staff_team_assignments, public\.staff_news_audit from anon,authenticated/);
  assert.match(sql,/grant select on public\.staff_team_assignments to authenticated/);
  assert.doesNotMatch(sql,/for (insert|update|delete) to (anon|authenticated)/i);
});
test('article RPC requires authenticated coach with active team assignment or admin with MFA',()=>{
  assert.match(sql,/v_actor uuid := \(select auth\.uid\(\)\)/);
  assert.match(sql,/v_is_admin := \(select app_private\.is_admin\(\)\)/);
  assert.match(sql,/r\.user_id=v_actor and r\.role='coach'/);
  assert.match(sql,/a\.team_id=p_team_id and a\.active=true/);
  assert.match(sql,/if not \(v_is_admin or v_coach_this_team\)/);
  assert.match(sql,/v_old\.team_id is distinct from p_team_id/);
  assert.match(sql,/security definer set search_path = ''/);
});
test('publishing requires rights attestation and snapshots each change in an audit table',()=>{
  assert.match(sql,/p_publish and not p_rights_confirmed/);
  assert.match(sql,/create table if not exists public\.staff_news_audit/);
  assert.match(sql,/alter table public\.staff_news_audit enable row level security/);
  assert.match(sql,/insert into public\.staff_news_audit\(/);
  assert.match(sql,/previous_state,new_state/);
  assert.match(sql,/to_jsonb\(v_new\)/);
});
test('role attribution remains out of scope: no user or privilege bootstrap',()=>{
  assert.doesNotMatch(sql,/insert into public\.user_roles|insert into public\.staff_team_assignments\s*\(/i);
  assert.doesNotMatch(sql,/service_role|sb_secret_|sk_live_|pk_live_/);
  assert.match(sql,/revoke all on function public\.staff_save_news_article/);
  assert.match(sql,/grant execute on function public\.staff_save_news_article/);
});
