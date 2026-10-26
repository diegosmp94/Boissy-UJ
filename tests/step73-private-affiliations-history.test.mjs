import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {playerTeamScopeRows,playerHistoryRows} from '../admin-player-teams.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const migration=read('supabase/migrations/202610260012_player_team_affiliations_history.sql');
const ui=read('admin-player-teams.mjs');
const roster=read('team-affiliated-roster.mjs');

test('one player may have different shirts and positions in multiple teams',()=>{
 const rows=playerTeamScopeRows([
  {team_id:'a',team_name:'Seniors A',active:true,position_group:'midfielder',shirt_number:8},
  {team_id:'b',team_name:'Seniors B',active:true,position_group:'forward',shirt_number:17},
  {team_id:'f',team_name:'Senior',active:false,position_group:null,shirt_number:null}
 ]);
 assert.equal(rows.length,3);
 assert.deepEqual(rows.slice(0,2).map(x=>x.shirt_number),[8,17]);
 assert.equal(rows[2].shirt_number,null);
 assert.equal(playerTeamScopeRows([{team_id:'x',team_name:'bad',active:true,shirt_number:101}]).length,0);
 assert.deepEqual(playerTeamScopeRows(null),[]);
});

test('private history only accepts time-stamped server rows, limited to 50',()=>{
 const x={changed_at:'2026-10-26T11:00:00Z',team_name:'Seniors A',event_kind:'poste',
  detail:'N° 8 → 9'};
 assert.deepEqual(playerHistoryRows([x,{...x,changed_at:'not-date'}]),[x]);
 assert.equal(playerHistoryRows(Array(60).fill(x)).length,50);
 assert.deepEqual(playerHistoryRows(null),[]);
});

test('private AAL2 overview includes active and inactive affiliations with scoped shirt metadata',()=>{
 assert.match(migration,/create or replace function public\.admin_player_team_overview\(p_player_user_id uuid\)/i);
 assert.match(migration,/app_private\.is_admin\(\)/);
 assert.match(migration,/return query select m\.team_id,t\.name,m\.active/);
 assert.match(migration,/case when m\.active then s\.position_group else null end/);
 assert.match(migration,/case when m\.active then s\.shirt_number else null end/);
 assert.match(migration,/where m\.player_user_id=p_player_user_id/);
 assert.match(migration,/left join app_private\.team_player_positions s/);
 assert.match(migration,/limit 50;/);
});

test('private history is the union of grants, edits and releases for one player only',()=>{
 assert.match(migration,/create or replace function public\.admin_player_assignment_history\(p_player_user_id uuid\)/i);
 assert.match(migration,/from app_private\.team_membership_admin_audit a where a\.player_user_id=p_player_user_id/);
 assert.match(migration,/from app_private\.team_player_position_audit a where a\.player_user_id=p_player_user_id/);
 assert.match(migration,/from app_private\.team_player_position_release_audit a where a\.player_user_id=p_player_user_id/);
 assert.match(migration,/order by h\.changed_at desc,h\.event_kind limit 50/);
 assert.match(migration,/app_private\.is_admin\(\)/);
 assert.doesNotMatch(migration,/actor_user_id.*return query/);
});

test('new definer RPCs have only authenticated EXECUTE, no direct private table grants',()=>{
 for(const name of ['admin_player_team_overview','admin_player_assignment_history']){
  assert.match(migration,new RegExp('revoke all on function public\\.'+name+'\\(uuid\\) from public,anon,authenticated;'));
  assert.match(migration,new RegExp('grant execute on function public\\.'+name+'\\(uuid\\) to authenticated;'));
 }
 assert.match(migration,/security definer set search_path=''/g);
 assert.doesNotMatch(migration,/\b(?:grant select on app_private|insert into public\.profiles|create policy|alter table)\b/i);
});

test('admin roster shows lazy private scopes and events but does not publish them',()=>{
 assert.match(ui,/Équipes et historique/);
 assert.match(ui,/if\(!await verified\(\)\)/);
 assert.match(ui,/api\.rpc\('admin_player_team_overview',\{p_player_user_id:p\.player_user_id\}\)/);
 assert.match(ui,/api\.rpc\('admin_player_assignment_history',\{p_player_user_id:p\.player_user_id\}\)/);
 assert.match(ui,/generation!==listGeneration/);
 assert.match(ui,/team\.value!==teamAtClick/);
 assert.match(ui,/detailBox\.replaceChildren\(\)/);
 assert.match(ui,/playerTeamScopeRows\(scope\.data\)/);
 assert.match(ui,/playerHistoryRows\(events\.data\)/);
 assert.doesNotMatch(ui,/\b(?:localStorage|sessionStorage|innerHTML|service_role)\b/);
});

test('existing jersey safety is unique per team, with optimistic locking and exit release',()=>{
 const sql=read('supabase/migrations/202610240002_staff_team_player_positions.sql');
 const release=read('supabase/migrations/202610260001_release_inactive_team_jersey.sql');
 const locks=read('supabase/migrations/202610260003_team_jersey_membership_lock_order.sql');
 assert.match(sql,/unique.*shirt_number|unique.*team_id.*shirt_number|team_player_position_unique_number/is);
 assert.match(locks,/pg_advisory_xact_lock/);
 assert.match(locks,/p_expected_updated_at is distinct from v_old\.updated_at/);
 assert.match(release,/release_position_on_membership_exit/);
 assert.match(roster,/rows\.some\(r=>r\.player_user_id!==chosen\.player_user_id&&r\.shirt_number===draft\.p_shirt_number\)/);
 assert.match(roster,/result\.error\?\.code==='23505'/);
});
