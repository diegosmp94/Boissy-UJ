import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateMatchDraft} from '../match-workspace.mjs';
import {filterPublishedFixtures,scoreLabel} from '../sport-center.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schema=read('supabase/migrations/202610210009_sport_seasons_match_manager.sql');
const matches=read('match-workspace.mjs');
const sports=read('sport-center.mjs');
const control=read('control-center.mjs');
const css=read('styles.css');
const base={
  team:'a',opponent:'Club adverse',when:'2026-11-05T15:00',
  venue:'Stade municipal',season:'2026/2027',status:'scheduled',
  source:'manual',reference:'',homeScore:'',awayScore:''
};

test('database creates seasons without inventing season data',()=>{
 assert.match(schema,/create table if not exists public\.club_seasons/);
 assert.match(schema,/alter table public\.club_seasons enable row level security/);
 assert.match(schema,/create policy club_seasons_public_read/);
 assert.doesNotMatch(schema,/insert into public\.club_seasons/i);
 assert.match(schema,/add column if not exists season_id uuid references public\.club_seasons/);
});
test('server match RPC authenticates, checks coach team scope or admin MFA',()=>{
 assert.match(schema,/v_actor uuid := \(select auth\.uid\(\)\)/);
 assert.match(schema,/v_admin := \(select app_private\.is_admin\(\)\)/);
 assert.match(schema,/r\.user_id = v_actor/);
 assert.match(schema,/r\.role = 'coach'/);
 assert.match(schema,/a\.team_id = p_team_id/);
 assert.match(schema,/a\.active = true/);
 assert.match(schema,/if not \(v_admin or v_can_edit\)/);
 assert.match(schema,/v_before\.team_id is distinct from p_team_id/);
 assert.match(schema,/revoke all on function public\.staff_save_match/);
 assert.match(schema,/grant execute on function public\.staff_save_match/);
 assert.match(schema,/security definer set search_path = ''/);
});
test('score, FFF and result constraints are validated before writing',()=>{
 assert.match(schema,/p_match_status = 'played'/);
 assert.match(schema,/p_home_score is null or p_away_score is null/);
 assert.match(schema,/p_match_status <> 'played'/);
 assert.match(schema,/v_team_code = 'c'/);
 assert.match(schema,/p_source_reference is null/);
 assert.match(schema,/p_source_kind not in \('manual','fff'\)/);
});
test('match audit is private, immutable for browser roles and stores snapshots',()=>{
 assert.match(schema,/create table if not exists app_private\.match_change_log/);
 assert.match(schema,/alter table app_private\.match_change_log enable row level security/);
 assert.match(schema,/revoke all on app_private\.match_change_log from public, anon, authenticated/);
 assert.match(schema,/insert into app_private\.match_change_log/);
 assert.match(schema,/before_snapshot,after_snapshot/);
 assert.match(schema,/to_jsonb\(v_before\)/);
 assert.match(schema,/to_jsonb\(v_after\)/);
 assert.doesNotMatch(schema,/insert into public\.matches[^;]+\('Seniors|insert into app_private\.match_change_log values/i);
});
test('draft match form validates statuses, score range and source',()=>{
 assert.equal(validateMatchDraft(base).valid,true);
 assert.equal(validateMatchDraft({...base,status:'played',homeScore:'2',awayScore:'0'}).valid,true);
 assert.equal(validateMatchDraft({...base,status:'played',homeScore:'2'}).valid,false);
 assert.equal(validateMatchDraft({...base,status:'scheduled',homeScore:'3'}).valid,false);
 assert.equal(validateMatchDraft({...base,status:'played',homeScore:'100',awayScore:'0'}).valid,false);
 assert.equal(validateMatchDraft({...base,team:'c',source:'fff',reference:'FFF-123'}).valid,false);
 assert.equal(validateMatchDraft({...base,team:'a',source:'fff',reference:''}).valid,false);
 assert.equal(validateMatchDraft({...base,team:'a',source:'fff',reference:'FFF-123'}).valid,true);
 assert.equal(validateMatchDraft({...base,season:'2026'}).valid,false);
});
test('season filter only returns actual matching fixtures',()=>{
 const rows=[
  {team_id:'a',season_id:'2026',match_status:'played',home_score:2,away_score:1},
  {team_id:'b',season_id:'2026',match_status:'scheduled'},
  {team_id:'a',season_id:'2027',match_status:'scheduled'}
 ];
 assert.equal(filterPublishedFixtures(rows).length,3);
 assert.equal(filterPublishedFixtures(rows,{teamId:'a'}).length,2);
 assert.equal(filterPublishedFixtures(rows,{teamId:'a',seasonId:'2026'}).length,1);
 assert.equal(filterPublishedFixtures(rows,{seasonId:'not-found'}).length,0);
 assert.equal(scoreLabel(rows[0]),'2 – 1');
});
test('Control Center stays in local preview while showing Sports Manager forms',()=>{
 assert.match(control,/mountMatchWorkspace\(root\)/);
 assert.match(matches,/Prévisualisation locale — aucune modification publiée/);
 assert.match(matches,/Prévisualiser la rencontre/);
 assert.match(matches,/Aucun changement enregistré dans Supabase/);
 assert.match(matches,/textContent=String\(value\)/);
 assert.doesNotMatch(matches,/\.rpc\(|fetch\(|innerHTML\s*=|service_role|sb_secret_/);
 assert.match(css,/\.staff-goals\[hidden\], \.staff-label\[hidden\] \{ display:none!important; \}/);
});
test('Match Center only lists verified seasons actually stored in Supabase',()=>{
 assert.match(sports,/getRows\('club_seasons'/);
 assert.match(sports,/select:'id,team_id,season_id,opponent_name/);
 assert.match(sports,/if\(seasons\.length\)/);
 assert.match(sports,/Filtrer les rencontres par saison/);
 assert.match(sports,/filterPublishedFixtures\(matches,/);
});

test('the public application never exposes match write operations before sign-in',()=>{
 const authConfig=read('auth-config.mjs');
 assert.match(authConfig,/adminEnabled:\s*false/);
 assert.doesNotMatch(matches,/\b(?:fetch|localStorage|sessionStorage)\s*\(/);
 assert.match(schema,/revoke all on function public\.staff_save_match/);
});
