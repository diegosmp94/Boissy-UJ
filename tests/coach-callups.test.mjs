import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 INVITATION_LABELS,normalizeCoachFixtures,normalizeCoachRoster,
 canChangeInvitation,invitationArgs
} from '../coach-callups-rules.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610220001_coach_private_callups.sql');
const ui=read('coach-callups.mjs'),member=read('member-sports.mjs');
const m='11111111-1111-4111-8111-111111111111';
const p='22222222-2222-4222-8222-222222222222';

test('roster excludes malformed or undisclosed records, keeps supported statuses',()=>{
 const result=normalizeCoachRoster([
  {player_user_id:p,display_name:'Joueur A',callup_response:null},
  {player_user_id:p,display_name:'Joueur A',callup_response:'confirmed'},
  {player_user_id:p,display_name:'Joueur A',callup_response:'cancelled'},
  {player_user_id:p,display_name:'Joueur A',callup_response:'not-allowed'},
  {player_user_id:'not-a-uuid',display_name:'Joueur X',callup_response:null},
  {player_user_id:p,display_name:'',callup_response:null}
 ]);
 assert.equal(result.length,3);
 assert.throws(()=>normalizeCoachRoster(null));
 assert.equal(INVITATION_LABELS.confirmed,'Présent');
});
test('fixtures only accept matching non-final matches and bounded lists',()=>{
 const result=normalizeCoachFixtures([
  {match_id:m,opponent_name:'Adversaire',match_status:'scheduled'},
  {match_id:m,opponent_name:'Adversaire 2',match_status:'postponed'},
  {match_id:m,opponent_name:'Partie terminée',match_status:'played'},
  {match_id:'invalid',opponent_name:'Faux',match_status:'scheduled'}
 ]);
 assert.deepEqual(result.map(x=>x.opponent_name),['Adversaire','Adversaire 2']);
 assert.throws(()=>normalizeCoachFixtures(undefined));
});
test('invitation and cancellation require current status and player identifier',()=>{
 const eligible={player_user_id:p,callup_response:null};
 assert.equal(canChangeInvitation(eligible,true),true);
 assert.equal(canChangeInvitation(eligible,false),false);
 assert.equal(canChangeInvitation({...eligible,callup_response:'cancelled'},true),true);
 assert.equal(canChangeInvitation({...eligible,callup_response:'invited'},false),true);
 for(const state of ['confirmed','declined','unsure']){
  assert.equal(canChangeInvitation({...eligible,callup_response:state},false),true);
  assert.equal(canChangeInvitation({...eligible,callup_response:state},true),false);
 }
 assert.equal(canChangeInvitation({...eligible,player_user_id:'hack'},true),false);
 assert.equal(canChangeInvitation(eligible,'true'),false);
});
test('invitation RPC arguments are exact, no team switch or client-controlled scope',()=>{
 assert.deepEqual(invitationArgs(m,{player_user_id:p,callup_response:null},true),{
  p_match_id:m,p_player_user_id:p,p_invite:true
 });
 assert.throws(()=>invitationArgs('other',{player_user_id:p,callup_response:null},true));
 assert.throws(()=>invitationArgs(m,{player_user_id:p,callup_response:null},false));
});
test('database RPCs require auth, active coach assignment with role, or admin MFA',()=>{
 for(const name of ['staff_list_squad_fixtures','staff_list_match_roster'])
  assert.match(sql,new RegExp('function public\\.'+name+'\\('));
 assert.match(sql,/v_actor uuid := \(select auth\.uid\(\)\)/);
 assert.match(sql,/app_private\.is_admin\(\)/);
 assert.match(sql,/r\.role='coach'/);
 assert.match(sql,/a\.coach_user_id=v_actor and a\.team_id=/);
 assert.match(sql,/a\.active=true/);
 assert.match(sql,/raise exception 'Team scope denied' using errcode='42501'/);
 assert.match(sql,/revoke all on function public\.staff_list_match_roster\(uuid\) from public,anon/);
 assert.match(sql,/grant execute on function public\.staff_list_match_roster\(uuid\) to authenticated/);
});
test('private roster only returns minimal membership + callup state, with no contact info',()=>{
 assert.match(sql,/join public\.user_roles r on r\.user_id=tm\.player_user_id and r\.role='player'/);
 assert.match(sql,/where tm\.team_id=v_team_id and tm\.active=true/);
 assert.match(sql,/join public\.profiles p on p\.id=tm\.player_user_id/);
 assert.match(sql,/left join app_private\.match_callups c/);
 assert.match(sql,/m\.match_status in \('scheduled','postponed'\)/);
 assert.doesNotMatch(sql,/select\s+\*/i);
 assert.doesNotMatch(sql,/raw_user_meta_data|email\s*,|phone\s*,|date_of_birth|licence_number|grant (select|insert|update|delete) on app_private/i);
});
test('coach component gates UI on protected RPC success, never directly touches private tables',()=>{
 assert.match(member,/void mountCoachCallups\(callupArea,api,userId,teams\)/);
 assert.match(ui,/api\.rpc\('staff_list_squad_fixtures',\{p_team_id:selectedTeam\}\)/);
 assert.match(ui,/api\.rpc\('staff_list_match_roster',\{p_match_id:selected\}\)/);
 assert.match(ui,/api\.rpc\('staff_set_callup',payload\)/);
 assert.match(ui,/api\.auth\.getUser\(\)/);
 assert.match(ui,/api\.from\('user_roles'\)\.select\('role'\)/);
 assert.match(ui,/api\.from\('staff_team_assignments'\)/);
 assert.match(ui,/Liste privée indisponible\. Les convocations sont verrouillées/);
 assert.match(ui,/Clique une seconde fois pour confirmer/);
 assert.doesNotMatch(ui,/\.from\('team_player_memberships'\)|\.from\('match_callups'\)|innerHTML\s*=|service_role|sb_secret_/);
});
test('mobile UI contains rosters with keyboard focus and no public changes',()=>{
 const css=read('member-sports.css');
 assert.match(css,/\.coach-callup-player/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/\.member-sports-secondary:focus-visible/);
 assert.doesNotMatch(ui,/location\.hash|window\.location|localStorage|sessionStorage/);
});
