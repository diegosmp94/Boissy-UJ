import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {coachAssignmentAction,searchApprovedCoaches,coachAssignmentPayload} from '../admin-coach-teams.mjs';
import {ADMIN_MODULES} from '../admin-center.mjs';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610220003_admin_coach_team_assignments.sql');
const ui=read('admin-coach-teams.mjs');
const hub=read('admin-center.mjs');
const admin='11111111-1111-4111-8111-111111111111';
const coach='22222222-2222-4222-8222-222222222222';
const team='33333333-3333-4333-8333-333333333333';

test('P1 only offers activation for already approved coaches and deactivation for active ones',()=>{
 assert.equal(coachAssignmentAction({coach_user_id:coach,active:false},admin),'activate');
 assert.equal(coachAssignmentAction({coach_user_id:coach,active:true},admin),'deactivate');
 assert.equal(coachAssignmentAction({coach_user_id:coach,active:null},admin),'activate');
 assert.equal(coachAssignmentAction({coach_user_id:admin,active:false},admin),null);
 assert.equal(coachAssignmentAction({coach_user_id:coach,active:false},null),null);
 assert.equal(coachAssignmentAction(null,admin),null);
});

test('P1 coach team payload is constrained to team, coach and an explicit boolean',()=>{
 assert.deepEqual(coachAssignmentPayload(team,{coach_user_id:coach,active:false},admin),
 {p_team_id:team,p_coach_user_id:coach,p_active:true});
 assert.deepEqual(coachAssignmentPayload(team,{coach_user_id:coach,active:true},admin),
 {p_team_id:team,p_coach_user_id:coach,p_active:false});
 assert.throws(()=>coachAssignmentPayload('',{coach_user_id:coach,active:false},admin));
 assert.throws(()=>coachAssignmentPayload(team,{coach_user_id:admin,active:false},admin));
});

test('P1 search supports accent-insensitive names without exposing contacts',()=>{
 const rows=[{coach_user_id:coach,display_name:'Éducateur Émile',active:true},
 {coach_user_id:admin,display_name:'Clara',active:false}];
 assert.deepEqual(searchApprovedCoaches(rows,'EMILE').map(x=>x.display_name),['Éducateur Émile']);
 assert.equal(searchApprovedCoaches(rows,'').length,2);
 assert.deepEqual(searchApprovedCoaches(rows,'unknown'),[]);
});

test('P1 team coach listing is restricted to admin with MFA AAL2 and minimal profile data',()=>{
 assert.match(sql,/public\.admin_list_team_coaches\(p_team_id uuid\)/);
 assert.match(sql,/app_private\.is_admin\(\)/);
 assert.match(sql,/select auth\.uid\(\)/);
 assert.match(sql,/where r\.role='coach'/);
 assert.match(sql,/join public\.profiles p on p\.id=r\.user_id/);
 assert.match(sql,/left join public\.staff_team_assignments a/);
 assert.match(sql,/limit 250/);
 assert.match(sql,/revoke all on function public\.admin_list_team_coaches\(uuid\) from public,anon/);
 assert.doesNotMatch(sql,/raw_user_meta_data|select\s+u\.email|select\s+p\.phone/i);
});

test('P1 writing a coach affiliation never grants a coach role or permits self approval',()=>{
 assert.match(sql,/public\.admin_set_coach_team_assignment\(/);
 assert.match(sql,/p_coach_user_id=v_actor/);
 assert.match(sql,/r?ole='coach'/);
 assert.match(sql,/pg_catalog\.pg_advisory_xact_lock/);
 assert.match(sql,/if v_found and v_old_active=p_active/);
 assert.match(sql,/if not v_found and not p_active/);
 assert.match(sql,/on conflict \(coach_user_id,team_id\) do update/);
 assert.match(sql,/insert into app_private\.coach_team_assignment_audit/);
 assert.doesNotMatch(sql,/insert into public\.user_roles|delete from public\.user_roles/);
});

test('P1 coach affiliations are audited and never directly exposed to anonymous or signed in browsers',()=>{
 assert.match(sql,/alter table app_private\.coach_team_assignment_audit enable row level security/);
 assert.match(sql,/revoke all on app_private\.coach_team_assignment_audit from public, anon, authenticated/);
 assert.match(sql,/constraint coach_assignment_no_self check/);
 assert.match(sql,/revoke all on function public\.admin_set_coach_team_assignment\(uuid,uuid,boolean\) from public,anon/);
 assert.match(sql,/grant execute on function public\.admin_set_coach_team_assignment\(uuid,uuid,boolean\) to authenticated/);
 assert.doesNotMatch(sql,/grant\s+(insert|update|delete)\s+on\s+public\.staff_team_assignments\s+to\s+authenticated/i);
});

test('P1 admin editor re-verifies MFA before any read or write and requires double confirmation',()=>{
 assert.match(ui,/adminSessionStatus\(api,userId\)/);
 assert.match(ui,/gate\.status==='admin'&&gate\.level==='aal2'/);
 assert.match(ui,/api\.rpc\('admin_list_team_coaches',\{p_team_id:id\}\)/);
 assert.match(ui,/api\.rpc\('admin_set_coach_team_assignment',args\)/);
 assert.match(ui,/coachAssignmentPayload\(expectedTeam,coach,userId\)/);
 assert.match(ui,/intentKey=key;button\.textContent='Confirmer : '/);
 assert.match(ui,/if\(!root\.isConnected\|\|select\.value!==expectedTeam\)return/);
 assert.match(ui,/select\.disabled=true;refresh\.disabled=true/);
 assert.doesNotMatch(ui,/\.insert\(|\.update\(|\.delete\(|service_role|sb_secret_|innerHTML\s*=/);
});

test('P1 coach team UI is reachable only inside existing admin MFA-gated module transitions',()=>{
 assert.equal(ADMIN_MODULES.some(x=>x.id==='coach-teams'),true);
 assert.match(hub,/case 'coach-teams':void mountAdminCoachTeams\(view,api,verified\.userId\)\.catch\(\(\)=>showModuleRetry\(view,id\)\);break/);
 assert.match(hub,/const check=await adminSessionStatus\(api,verified\.userId\)/);
 assert.match(hub,/if\(!canOpenAdmin\(check,supabaseConfig\.adminEnabled\)\)/);
 assert.match(hub,/pane\.replaceChildren\(view\)/);
});

test('P1 existing member coach request is approved by a different admin, never by coach himself',()=>{
 const requests=read('role-workflow.mjs');
 const moderator=read('admin-role-moderation.mjs');
 assert.match(requests,/if\(role==='coach'&&!teamId\)/);
 assert.match(moderator,/request\.user_id!==adminId/);
 assert.match(moderator,/api\.rpc\('admin_decide_role_request',\{/);
 assert.match(read('member-sports.mjs'),/mountCoachCallups\(callupArea,api,userId,teams\)/);
 assert.match(read('coach-callups.mjs'),/staff_set_callup/);
 assert.match(read('member-sports.mjs'),/player_respond_callup/);
});

test('P1 P1 multi-role tabs stay independent from team grants',()=>{
 const member=read('member-sports.mjs');
 assert.match(member,/const contexts=\['player','coach','admin'\]\.filter\(role=>roles\.includes\(role\)\)/);
 assert.match(member,/const content=el\('div','member-sports-view'\)/);
 assert.match(member,/view\.replaceChildren\(content\)/);
 assert.match(member,/await verifyRole\(api,userId,'coach'\)/);
 assert.match(member,/await verifyRole\(api,userId,'player'\)/);
});
