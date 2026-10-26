import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SEASON_STATE_LABELS,seasonTransitionAllowed,nextSeasonPlan} from '../season-lifecycle-rules.mjs';
import {validateSeasonDraft} from '../admin-editor-rules.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610260009_season_archive_reconduct.sql');
const admin=read('admin-management.mjs');
const rollover=read('admin-season-rollover.mjs');
const publicView=read('season-workspace.mjs');
const year={id:'season-1',label:'2026/2027',state:'completed',starts_on:'2026-08-01',ends_on:'2027-06-30'};

test('season states only advance and archive is terminal',()=>{
 assert.deepEqual(Object.keys(SEASON_STATE_LABELS),['planned','active','completed','archived']);
 for(const [a,b] of [[null,'planned'],['planned','active'],['active','completed'],['completed','archived'],['archived','archived']])
  assert.equal(seasonTransitionAllowed(a,b),true,String(a)+' -> '+b);
 for(const [a,b] of [[null,'active'],[null,'archived'],['planned','completed'],['active','archived'],['completed','active'],['archived','active'],['completed','planned']])
  assert.equal(seasonTransitionAllowed(a,b),false,String(a)+' -> '+b);
 assert.equal(seasonTransitionAllowed('rogue','planned'),false);
});

test('rollover produces one planned year with no sporting artifacts',()=>{
 assert.deepEqual(nextSeasonPlan(year),{
  sourceId:'season-1',label:'2027/2028',start:'2027-08-01',end:'2028-06-30',state:'planned'
 });
 assert.deepEqual(nextSeasonPlan({...year,state:'archived'}),nextSeasonPlan(year));
 assert.equal(nextSeasonPlan({...year,state:'active'}),null);
 assert.equal(nextSeasonPlan({...year,label:'2100/2101'}),null);
 assert.equal(nextSeasonPlan({...year,starts_on:'invalid'}),null);
 assert.equal(nextSeasonPlan({...year,ends_on:'2027-02-31'}),null);
 assert.equal(nextSeasonPlan({...year,starts_on:'2025-08-01'}),null);
 assert.deepEqual(nextSeasonPlan({...year,label:'2023/2024',starts_on:'2023-02-28',ends_on:'2024-02-29'}),{
  sourceId:'season-1',label:'2024/2025',start:'2024-02-28',end:'2025-02-28',state:'planned'
 });
});

test('admin form rejects invalid status transitions and immutable dates',()=>{
 const planned={label:'2026/2027',state:'planned',start:'2026-08-01',end:'2027-06-30'};
 assert.equal(validateSeasonDraft(planned),null);
 assert.match(validateSeasonDraft({...planned,state:'active'}),/Transition/);
 const existing={label:planned.label,state:'active',starts_on:planned.start,ends_on:planned.end};
 assert.equal(validateSeasonDraft({...planned,state:'completed'},existing),null);
 assert.match(validateSeasonDraft({...planned,state:'archived'},existing),/Transition/);
 const closed={...existing,state:'completed'};
 assert.equal(validateSeasonDraft({...planned,state:'archived'},closed),null);
 assert.match(validateSeasonDraft({...planned,state:'archived',end:'2027-07-01'},closed),/dates/);
 assert.equal(validateSeasonDraft({...planned,state:'archived'}, {...closed,state:'archived'}),null);
});

test('DB supports terminal archived status, audited transition and no unfinished matches',()=>{
 assert.match(sql,/constraint club_seasons_state_check/);
 assert.match(sql,/planned','active','completed','archived'/);
 assert.match(sql,/season_change_log_action_check/);
 assert.match(sql,/complete','archive','reconduct'/);
 assert.match(sql,/p_state not in \('planned','active','completed','archived'\)/);
 assert.match(sql,/A new season must start as planned/);
 assert.match(sql,/Invalid season lifecycle transition/);
 assert.match(sql,/Completed season identity and dates are immutable/);
 assert.match(sql,/match_status in \('scheduled','postponed'\)/);
 assert.match(sql,/Resolve remaining fixtures before closing the season/);
 assert.match(sql,/v_action:=case/);
 assert.match(sql,/insert into app_private\.season_change_log/);
 assert.match(sql,/to_jsonb\(v_existing\)/);
 assert.match(sql,/to_jsonb\(v_record\)/);
});

test('archived match and standings cannot be overwritten or moved to new season',()=>{
 assert.match(sql,/create or replace function app_private\.reject_archived_season_write\(\)/);
 assert.match(sql,/from public\.club_seasons s where s\.id=v_old_id for share of s/);
 assert.match(sql,/from public\.club_seasons s where s\.id=v_new_id for share of s/);
 assert.match(sql,/Archived season content is immutable/);
 assert.match(sql,/Archived season does not accept content/);
 assert.match(sql,/before insert or update or delete on public\.matches/);
 assert.match(sql,/before insert or update or delete on public\.team_league_standings/);
 assert.match(sql,/revoke all on function app_private\.reject_archived_season_write\(\)/);
});

test('reconduct requires AAL2 and never copies fixtures, rosters, standings or users',()=>{
 const body=sql.split('create or replace function public.admin_reconduct_season(')[1].split('$fn$;')[0];
 assert.match(body,/v_actor uuid := \(select auth\.uid\(\)\)/);
 assert.match(body,/app_private\.is_admin\(\)/);
 assert.match(body,/for update/);
 assert.match(body,/v_source\.state not in \('completed','archived'\)/);
 assert.match(body,/Next season already exists/);
 assert.match(body,/v_source\.starts_on\+interval '1 year'/);
 assert.match(body,/values\(v_new_label,'planned',v_start,v_end\)/);
 assert.match(body,/season_id,actor_user_id,action,before_snapshot,after_snapshot/);
 assert.match(body,/'reconduct'/);
 assert.doesNotMatch(body,/\b(?:insert into public\.matches|insert into public\.team_league_standings|insert into public\.user_roles|insert into public\.staff_team_assignments|insert into app_private\.team_player_memberships)\b/i);
 assert.match(sql,/revoke all on function public\.admin_reconduct_season\(uuid\)[\s\S]+?grant execute on function public\.admin_reconduct_season\(uuid\)\s+to authenticated/);
 assert.doesNotMatch(sql,/grant execute.*to (?:anon|public)/i);
});

test('real admin UI displays archive and requires explicit double confirmation',()=>{
 assert.match(admin,/select\(Object\.entries\(SEASON_STATE_LABELS\)\)/);
 assert.match(admin,/mountAdminSeasonRollover\(root,api,userId\)/);
 assert.match(admin,/includes\(row\?\.state\)/);
 assert.match(rollover,/adminSessionStatus\(api,userId\)/);
 assert.match(rollover,/s\.status==='admin'&&s\.level==='aal2'/);
 assert.match(rollover,/api\.rpc\('admin_reconduct_season',\{p_source_season_id:plan\.sourceId\}\)/);
 assert.match(rollover,/if\(confirmed!==key\)/);
 assert.match(rollover,/Confirmer la reconduction de /);
 assert.match(rollover,/withAuthDeadline\(api\.rpc\('admin_reconduct_season'/);
 assert.match(rollover,/Aucun match, score, classement, joueur ni rôle n’est repris/);
 assert.match(publicView,/SEASON_STATE_LABELS\[row\.state\]/);
 assert.doesNotMatch(rollover,/\.insert\(|\.update\(|\.delete\(|localStorage|service_role|sk_live_/);
});
