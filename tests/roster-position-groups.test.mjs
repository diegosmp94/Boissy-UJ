import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PLAYER_POSITION_GROUPS,groupPublishedPlayers,positionFromPublicRole,
 validPrivatePosition,safeShirtNumber} from '../player-position-groups.mjs';
import {affiliatedPlayerDraft} from '../team-affiliated-roster.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const valid={person_kind:'player',published:true,consent_confirmed:true};

test('each public squad separates approved players into four expected position groups',()=>{
 assert.deepEqual(PLAYER_POSITION_GROUPS.map(g=>g.label),
  ['Gardiens','Défenseurs','Milieux','Attaquants']);
 const source=[
  {...valid,display_name:'Goalie',role_label:'Gardien'},
  {...valid,display_name:'Defender',role_label:'Défenseur central'},
  {...valid,display_name:'Midfielder',role_label:'Milieu défensif'},
  {...valid,display_name:'Forward',role_label:'Attaquant'},
  {...valid,display_name:'Unclassified',role_label:'Poste à préciser'},
  {...valid,display_name:'Invisible',role_label:'Gardien',consent_confirmed:false},
  {...valid,display_name:'Draft',role_label:'Attaquant',published:false},
  {...valid,display_name:'Coach',role_label:'Défenseur',person_kind:'coach'}
 ];
 const result=groupPublishedPlayers(source);
 assert.deepEqual(Object.fromEntries(Object.entries(result.groups).map(([k,v])=>
  [k,v.map(p=>p.display_name)])),{
   goalkeeper:['Goalie'],defender:['Defender'],midfielder:['Midfielder'],forward:['Forward']
  });
 assert.deepEqual(result.unclassified.map(p=>p.display_name),['Unclassified']);
 assert.equal(Object.values(result.groups).flat().length+result.unclassified.length,5);
});
test('legacy public role names are classified only when position is reliable',()=>{
 for(const [label,kind] of [['GARDIEN','goalkeeper'],['Gardien de but','goalkeeper'],
  ['Défenseur','defender'],['Défenseur latéral','defender'],
  ['Milieu offensif','midfielder'],['Ailier gauche','forward'],
  ['Attaquant de pointe','forward'],['Gardien/Entraîneur','goalkeeper']]){
  assert.equal(positionFromPublicRole(label),kind,label);
 }
 for(const role of ['Entraîneur','Staff','Joueur','Défense inconnue ?','']){
  assert.equal(positionFromPublicRole(role),null,role);
 }
});
test('private form uses strict team player IDs, four categories, unique range numbers',()=>{
 const row={player_user_id:'squad-uuid',updated_at:'2026-10-24T19:00:00Z'};
 assert.deepEqual(affiliatedPlayerDraft(row,'defender','23'),{
  p_player_user_id:'squad-uuid',p_position_group:'defender',p_shirt_number:23,
  p_expected_updated_at:'2026-10-24T19:00:00Z'
 });
 assert.deepEqual(affiliatedPlayerDraft({...row,updated_at:null},'forward',5),{
  p_player_user_id:'squad-uuid',p_position_group:'forward',p_shirt_number:5,
  p_expected_updated_at:null
 });
 for(const num of [0,100,-1,1.5,'0','0001','1e2','','5a',null])
  assert.equal(safeShirtNumber(num),null,String(num));
 for(const invalid of ['admin','centre','gardien',null,''])
  assert.equal(validPrivatePosition(invalid),false);
 assert.equal(affiliatedPlayerDraft(row,'admin',12),null);
 assert.equal(affiliatedPlayerDraft({display_name:'not affiliated'},'goalkeeper',1),null);
});
test('new SQL securely restricts to active affiliated approved players and active assigned coaches',()=>{
 const sql=read('supabase/migrations/202610240002_staff_team_player_positions.sql');
 for(const signature of [
  'create table if not exists app_private.team_player_positions(',
  'create unique index if not exists team_player_position_unique_number',
  'alter table app_private.team_player_positions enable row level security',
  'revoke all on app_private.team_player_positions from public,anon,authenticated',
  'create or replace function public.staff_list_affiliated_players(p_team_id uuid)',
  'create or replace function public.staff_set_affiliated_player_position(',
  "set search_path=''",
  'join public.user_roles r on r.user_id=m.player_user_id and r.role=\'player\'',
  'where m.team_id=p_team_id and m.active=true',
  "a.coach_user_id=v_actor and a.team_id=p_team_id and a.active=true",
  'coalesce((select app_private.is_admin()),false)',
  "raise exception 'Team scope denied'",
  "raise exception 'Player is not actively affiliated to this team'",
  'create table if not exists app_private.team_player_position_audit(',
  'p_expected_updated_at is distinct from v_old.updated_at',
  'revoke execute on function public.staff_list_affiliated_players(uuid) from public,anon,authenticated',
  'grant execute on function public.staff_list_affiliated_players(uuid) to authenticated'
 ]){
  assert.ok(sql.includes(signature),'Missing SQL security guard: '+signature);
 }
 assert.doesNotMatch(sql,/grant (select|insert|update|delete) on app_private\./i);
 assert.doesNotMatch(sql,/insert into public\.team_public_people|update public\.team_public_people/i);
});
test('position workflow mounts only on the player subpage and never publishes identities automatically',()=>{
 const app=read('app.js'),page=read('team-profile-data.mjs'),editor=read('team-affiliated-roster.mjs');
 assert.match(app,/activeSubpage\?\.section==='joueurs'\)mountTeamAffiliatedRoster\(activeTeam,getAuthClient\)/);
 assert.match(app,/else unmountTeamAffiliatedRoster\(\)/);
 assert.match(app,/id="team-affiliated-roster-root"/);
 assert.match(page,/groupedPlayers\(root,data.people.filter/);
 assert.match(page,/for\(const position of PLAYER_POSITION_GROUPS\)/);
 assert.match(page,/position.label/);
 assert.match(editor,/getAuthClient\(\)/);
 assert.match(editor,/api\.auth\.getUser\(\)/);
 assert.match(editor,/staff_list_affiliated_players/);
 assert.match(editor,/staff_set_affiliated_player_position/);
 assert.match(editor,/result\.error\?\.code==='23505'/);
 assert.doesNotMatch(editor,/innerHTML\s*=|service_role|sb_secret_|\.from\('profiles'\)/);
 assert.doesNotMatch(editor,/admin_save_team_public_person|\.from\('team_public_people'\)/);
});
