import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {membershipAction,filterEligiblePlayers} from '../admin-player-teams.mjs';
import {ADMIN_MODULES} from '../admin-center.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ui=read('admin-player-teams.mjs'),sql=read('supabase/migrations/202610220002_admin_player_team_memberships.sql');
const user='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';

test('membership button never allows admin to affiliate itself',()=>{
 assert.equal(membershipAction({player_user_id:other,active:false},user),'add');
 assert.equal(membershipAction({player_user_id:other,active:true},user),'remove');
 assert.equal(membershipAction({player_user_id:user,active:false},user),null);
 assert.equal(membershipAction(null,user),null);
});
test('name search works with accents and no account details',()=>{
 const rows=[{display_name:'Élodie',player_user_id:other,active:false},
 {display_name:'Hugo',player_user_id:user,active:true}];
 assert.deepEqual(filterEligiblePlayers(rows,'elodie').map(p=>p.display_name),['Élodie']);
 assert.equal(filterEligiblePlayers(rows,'').length,2);
 assert.equal(filterEligiblePlayers(rows,'x').length,0);
});
test('administration uses AAL2 and only two server RPCs, never direct writes',()=>{
 assert.match(ui,/adminSessionStatus\(api,userId\)/);
 assert.match(ui,/result\.status==='admin'&&result\.level==='aal2'/);
 assert.match(ui,/api\.rpc\('admin_list_team_players',\{p_team_id:id\}\)/);
 assert.match(ui,/api\.rpc\('admin_set_player_team_membership',\{/);
 assert.match(ui,/p_team_id:expectedTeam,p_player_user_id:p\.player_user_id,p_active:desired/);
 assert.match(ui,/Clique une seconde fois|Confirmer :/);
 assert.doesNotMatch(ui,/\.insert\(|\.delete\(|\.update\(|\.from\('team_player_memberships'\)/);
});
test('SQL read validates team and admin MFA before listing minimal player records',()=>{
 assert.match(sql,/public\.admin_list_team_players\(p_team_id uuid\)/);
 assert.match(sql,/app_private\.is_admin\(\)/);
 assert.match(sql,/select auth\.uid\(\)/);
 assert.match(sql,/r\.role='player'/);
 assert.match(sql,/join public\.profiles p on p\.id=r\.user_id/);
 assert.match(sql,/left join app_private\.team_player_memberships tm/);
 assert.match(sql,/limit 250/);
 assert.match(sql,/revoke all on function public\.admin_list_team_players\(uuid\) from public,anon/);
});
test('SQL mutation cannot grant a role and requires MFA, approved player and audit',()=>{
 assert.match(sql,/public\.admin_set_player_team_membership\(/);
 assert.match(sql,/v_actor=p_player_user_id/);
 assert.match(sql,/r\.role='player'/);
 assert.match(sql,/on conflict\(team_id,player_user_id\) do update set active=excluded\.active/);
 assert.match(sql,/insert into app_private\.team_membership_admin_audit/);
 assert.match(sql,/alter table app_private\.team_membership_admin_audit enable row level security/);
 assert.match(sql,/revoke all on app_private\.team_membership_admin_audit from public, anon, authenticated/);
 assert.match(sql,/revoke all on function public\.admin_set_player_team_membership\(uuid,uuid,boolean\) from public,anon/);
 assert.doesNotMatch(sql,/insert into public\.user_roles|grant.*(insert|update|delete).*to anon/i);
});
test('real module is mounted in admin-only console without public role editing',()=>{
 const center=read('admin-center.mjs');
 assert.equal(ADMIN_MODULES.some(x=>x.id==='player-teams'),true);
 assert.match(center,/case 'player-teams':void mountAdminPlayerTeams\(view,api,verified\.userId\)\.catch\(\(\)=>showModuleRetry\(view,id\)\);break/);
 assert.match(center,/const check=await adminSessionStatus\(api,verified\.userId\)/);
 assert.match(center,/if\(!canOpenAdmin\(check,supabaseConfig\.adminEnabled\)\)/);
 assert.doesNotMatch(ui,/innerHTML\s*=|localStorage|sb_secret_|service_role/);
});
