import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeMatchSheet,sheetResponseCounts,MATCH_SHEET_STATES} from '../private-match-sheet-rules.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610260013_private_match_sheets.sql');
const ui=read('coach-callups.mjs'),player=read('member-sports.mjs'),css=read('private-match-sheet.css');
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';

test('normalizeMatchSheet retains only real invited players and no duplicated identities',()=>{
 const result=normalizeMatchSheet([
  {player_user_id:a,display_name:'A',position_group:'defender',shirt_number:4,callup_response:'confirmed'},
  {player_user_id:a,display_name:'A',position_group:'defender',shirt_number:4,callup_response:'confirmed'},
  {player_user_id:b,display_name:'B',position_group:null,shirt_number:null,callup_response:'invited'},
  {player_user_id:'fake',display_name:'X',position_group:null,shirt_number:2,callup_response:'declined'},
  {player_user_id:'33333333-3333-4333-8333-333333333333',display_name:'C',position_group:'forward',shirt_number:5,callup_response:'cancelled'},
 ]);
 assert.equal(result.length,2);
 assert.deepEqual(result.map(x=>x.shirt),[4,null]);
 assert.deepEqual(result.map(x=>x.position),['Défenseur','Poste non attribué']);
 assert.deepEqual(result.map(x=>x.responseLabel),['Présent','En attente']);
 assert.deepEqual(sheetResponseCounts(result),{invited:1,confirmed:1,declined:0,unsure:0});
 assert.throws(()=>normalizeMatchSheet(null),/Invalid/);
 assert.deepEqual(sheetResponseCounts([]),{invited:0,confirmed:0,declined:0,unsure:0});
 assert.equal(Object.hasOwn(MATCH_SHEET_STATES,'cancelled'),false);
});

test('private sheet is a definer RPC restricted to active team staff or AAL2 admin',()=>{
 const start=sql.indexOf('create or replace function public.staff_list_match_sheet(');
 const end=sql.indexOf('\n-- Player list',start);
 assert.ok(start>=0&&end>start);
 const s=sql.slice(start,end);
 assert.match(s,/security definer set search_path=''/);
 assert.match(s,/v_actor uuid := \(select auth\.uid\(\)\)/);
 assert.match(s,/app_private\.is_admin\(\)/);
 assert.match(s,/a\.team_id=v_team and a\.active=true/);
 assert.match(s,/r\.role='coach'/);
 assert.match(s,/p_match_id uuid/);
 assert.match(s,/m\.match_status in \('scheduled','postponed'\)/);
 assert.match(s,/c\.response in \('invited','confirmed','declined','unsure'\)/);
 assert.match(s,/tm\.active=true/);
 assert.match(s,/r\.role='player'/);
 assert.match(s,/join public\.profiles p on p\.id=c\.player_user_id/);
 assert.match(s,/left join app_private\.team_player_positions s/);
 assert.match(s,/limit 150/);
 assert.doesNotMatch(s,/email|phone|birth|password|raw_user_meta_data/);
});

test('old finalized and cancelled fixtures are excluded from private player callup list',()=>{
 const start=sql.indexOf('CREATE OR REPLACE FUNCTION public.player_my_callups()');
 const end=sql.indexOf('\n-- Do not accept a reply',start);
 assert.ok(start>=0&&end>start);
 const s=sql.slice(start,end);
 assert.match(s,/c\.player_user_id=\(select auth\.uid\(\)\)/);
 assert.match(s,/c\.response<>'cancelled'/);
 assert.match(s,/m\.match_status in \('scheduled','postponed'\)/);
 assert.match(s,/tm\.player_user_id=c\.player_user_id and tm\.active=true/);
 assert.match(s,/r\.role='player'/);
});

test('concurrent match completion is blocked until player response commits',()=>{
 const start=sql.indexOf('CREATE OR REPLACE FUNCTION public.player_respond_callup(');
 const end=sql.indexOf('\nrevoke all on function public.staff_list_match_sheet',start);
 assert.ok(start>=0&&end>start);
 const s=sql.slice(start,end);
 const role=s.toLowerCase().indexOf('for share of r');
 const team=s.toLowerCase().indexOf('for share of tm');
 const fixture=s.toLowerCase().indexOf('for share of m');
 const invitation=s.toLowerCase().indexOf('for update of c');
 assert.ok(role>=0&&role<team&&team<fixture&&fixture<invitation);
 assert.match(s,/m\.id=p_match_id and m\.team_id=v_team/);
 assert.match(s,/m\.match_status in \('scheduled','postponed'\)/);
 assert.match(s,/No active invitation/);
 assert.match(s,/insert into app_private\.callup_action_audit/);
});

test('permissions remain limited to signed-in accounts with internal server authorization',()=>{
 for(const [name,signature] of [
  ['staff_list_match_sheet','uuid'],['player_my_callups',''],['player_respond_callup','uuid,text']
 ]){
  assert.ok(sql.includes('revoke all on function public.'+name+'('+signature+') from public,anon,authenticated;'));
  assert.ok(sql.includes('grant execute on function public.'+name+'('+signature+') to authenticated;'));
 }
 assert.doesNotMatch(sql,/\b(?:create table|alter table|insert into public\.matches|insert into public\.profiles|grant select on app_private)\b/i);
});

test('coach fixture sheet refresh stays private and rejects outdated team/fixture data',()=>{
 assert.match(ui,/Afficher la feuille de match privée/);
 assert.match(ui,/sheetView\.hidden=true/);
 assert.match(ui,/staff_list_match_sheet/);
 assert.match(ui,/api\.rpc\('staff_list_match_sheet',\{p_match_id:selectedMatch\}\)/);
 assert.match(ui,/if\(!await valid\(selectedTeam\)\)/);
 assert.match(ui,/team\.select\.value!==selectedTeam/);
 assert.match(ui,/match\.select\.value!==selectedMatch/);
 assert.match(ui,/ticket!==sheetId/);
 assert.match(ui,/clearSheet\(\);members\.replaceChildren\(\)/);
 assert.match(ui,/normalizeMatchSheet\(result\.data\)/);
 assert.match(ui,/sheetResponseCounts\(records\)/);
 assert.match(ui,/Présent|présent\(s\)/);
 assert.doesNotMatch(ui,/\b(?:localStorage|sessionStorage|innerHTML|service_role|anonPlayerList)\b/);
 assert.match(css,/\.coach-callups-sheet\[hidden\]\{display:none\}/);
 assert.match(css,/@media\(max-width:600px\)/);
});

test('player response UI prevents double submission and restores buttons via status value',()=>{
 assert.match(player,/let loading=false,responseSaving=false/);
 assert.match(player,/if\(responseSaving\|\|!canRespondToCallup/);
 assert.match(player,/b\.dataset\.response=choice\.value/);
 assert.match(player,/responseSaving=false/);
 assert.match(player,/buttons\.forEach\(x=>x\.disabled=x\.dataset\.response===callup\.response\)/);
 assert.match(player,/api\.rpc\('player_respond_callup'/);
});
