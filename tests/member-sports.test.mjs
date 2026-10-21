import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 PLAYER_RESPONSES,hasSportsRole,canRespondToCallup,normalizeCallupRows,
 scopedCoachTeams,validateCoachMatchDraft,coachDraftRpcArgs,sportsSafeError
} from '../member-sports-rules.mjs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const source=read('member-sports.mjs'),auth=read('auth.mjs'),app=read('app.js');
const teamA={id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',name:'Seniors A'};
const teamB={id:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',name:'Futsal'};
const userA='11111111-1111-4111-8111-111111111111';
const userB='22222222-2222-4222-8222-222222222222';
const matchId='33333333-3333-4333-8333-333333333333';
const draft={team:teamA.id,opponent:'Équipe adverse',date:'2026-11-10T18:30',venue:'Terrain du club',home:true};

test('only granted player/coach roles create their sports context',()=>{
 assert.equal(hasSportsRole(['supporter','player'],'player'),true);
 assert.equal(hasSportsRole(['supporter','coach'],'coach'),true);
 assert.equal(hasSportsRole(['player','coach','admin'],'player'),true);
 assert.equal(hasSportsRole(['player','coach','admin'],'coach'),true);
 for(const roles of [[],['supporter'],['admin']]){
  assert.equal(hasSportsRole(roles,'player'),false);
  assert.equal(hasSportsRole(roles,'coach'),false);
 }
 assert.equal(hasSportsRole(['supporter'],'admin'),false);
 assert.equal(hasSportsRole(null,'player'),false);
});
test('a player may answer only their own eligible callup and valid action',()=>{
 assert.deepEqual(PLAYER_RESPONSES.map(x=>x.value),['confirmed','declined','unsure']);
 const c={match_id:matchId,response:'invited'};
 for(const value of ['confirmed','declined','unsure']){
  assert.equal(canRespondToCallup(c,['player'],value),true);
 }
 assert.equal(canRespondToCallup(c,['supporter'],'confirmed'),false);
 assert.equal(canRespondToCallup({...c,match_id:'fake'},['player'],'confirmed'),false);
 assert.equal(canRespondToCallup({...c,response:'cancelled'},['player'],'confirmed'),false);
 assert.equal(canRespondToCallup(c,['player'],'admin'),false);
});
test('player callup list rejects malformed and cancelled rows',()=>{
 const out=normalizeCallupRows([
  {match_id:matchId,opponent_name:'A',scheduled_at:'2026-11-01',response:'invited'},
  {match_id:'z',opponent_name:'B',scheduled_at:'2026-10-01',response:'confirmed'},
  {match_id:'p',opponent_name:'C',response:'cancelled'},
  null,{match_id:'x',response:'invited'}
 ]);
 assert.deepEqual(out.map(x=>x.opponent_name),['B','A']);
 assert.throws(()=>normalizeCallupRows(null));
});
test('coaches can only see teams belonging to their exact active assignment',()=>{
 const rows=[
  {coach_user_id:userA,team_id:teamA.id,active:true},
  {coach_user_id:userA,team_id:teamB.id,active:false},
  {coach_user_id:userB,team_id:teamB.id,active:true}
 ];
 assert.deepEqual(scopedCoachTeams(rows,[teamA,teamB],userA).map(x=>x.name),['Seniors A']);
 assert.deepEqual(scopedCoachTeams(rows,[teamA,teamB],userB).map(x=>x.name),['Futsal']);
 assert.deepEqual(scopedCoachTeams(rows,[teamA,teamB],'other'),[]);
 assert.deepEqual(scopedCoachTeams([],[],userA),[]);
});
test('coach match creation validates scoped team, opponent, datetime and venue',()=>{
 assert.equal(validateCoachMatchDraft(draft,[teamA]),null);
 assert.match(validateCoachMatchDraft({...draft,team:teamB.id},[teamA]),/attribuée/);
 assert.match(validateCoachMatchDraft({...draft,opponent:'x'},[teamA]),/Adversaire/);
 assert.match(validateCoachMatchDraft({...draft,date:'bad'},[teamA]),/date/);
 assert.match(validateCoachMatchDraft({...draft,venue:'x'.repeat(161)},[teamA]),/lieu/);
 assert.equal(validateCoachMatchDraft({...draft,venue:''},[teamA]),null);
});
test('coach RPC payload can only save a manually sourced unpublished fixture draft',()=>{
 const data=coachDraftRpcArgs(draft,[teamA]);
 assert.equal(data.p_match_id,null);
 assert.equal(data.p_team_id,teamA.id);
 assert.equal(data.p_publish,false);
 assert.equal(data.p_source_kind,'manual');
 assert.equal(data.p_source_reference,null);
 assert.equal(data.p_match_status,'scheduled');
 assert.equal(data.p_home_score,null);
 assert.equal(data.p_away_score,null);
 assert.equal(data.p_season_id,null);
 assert.match(data.p_scheduled_at,/^2026-11-10T/);
 assert.throws(()=>coachDraftRpcArgs({...draft,team:teamB.id},[teamA]));
});
test('safe errors never reveal SQL details or player identities',()=>{
 for(const code of ['42501','28000','22023','unknown']){
  const result=sportsSafeError({code,details:'private@club.test',message:'SQL internal'});
  assert.ok(result.length>15);
  assert.equal(result.includes('private@club.test'),false);
  assert.equal(result.includes('SQL internal'),false);
 }
});
test('member sports contexts only mount after verified user_roles are loaded',()=>{
 assert.match(auth,/import \{mountMemberSports\} from '\.\/member-sports\.mjs'/);
 assert.match(auth,/if\(!rolesResult\.error\)mountMemberSports\(account,api,user\.id,roles\)/);
 assert.match(source,/const contexts=\['player','coach','admin'\]\.filter\(role=>roles\.includes\(role\)\)/);
 assert.match(source,/await api\.auth\.getUser\(\)/);
 assert.match(source,/api\.from\('user_roles'\)\.select\('role'\)\.eq\('user_id',userId\)/);
});
test('private player callups use only self-scoped existing RPCs',()=>{
 assert.match(source,/api\.rpc\('player_my_callups'\)/);
 assert.match(source,/api\.rpc\('player_respond_callup',\{/);
 assert.match(source,/p_match_id:callup\.match_id,p_response:choice\.value/);
 assert.match(source,/await verifyRole\(api,userId,'player'\)/);
 assert.doesNotMatch(source,/from\('match_callups'\)|from\('team_player_memberships'\)|service_role|sb_secret_/);
});
test('coach queries stay under his active assignments and public matches',()=>{
 assert.match(source,/from\('staff_team_assignments'\)/);
 assert.match(source,/eq\('coach_user_id',userId\)/);
 assert.match(source,/eq\('active',true\)/);
 assert.match(source,/scopedCoachTeams\(assignmentResult\.data\|\|\[\],teamResult\.data\|\|\[\],userId\)/);
 assert.match(source,/eq\('published',true\)/);
 assert.match(source,/api\.rpc\('staff_save_match',coachDraftRpcArgs\(values,teams\)\)/);
 assert.match(source,/Affectation de cette équipe non confirmée/);
 assert.doesNotMatch(source,/\.insert\(|\.update\(|\.delete\(|innerHTML\s*=/);
});
test('the public preview label on Mon espace is replaced with a true MFA warning',()=>{
 assert.match(app,/ADMINISTRATION PROTÉGÉE/);
 assert.match(app,/Ouvrir le Centre de gestion/);
 assert.doesNotMatch(app,/Voir l’aperçu du Control Center/);
 assert.match(read('index.html'),/member-sports\.css/);
 assert.match(read('member-sports.css'),/@media\(max-width:620px\)/);
});
