import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateTeamFormRows,getTeamSummary} from '../team-stats.mjs';
import {CALLUP_STATES,makeCallupPreview} from '../callups-preview.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const migration=read('supabase/migrations/202610210011_callups_team_stats.sql');
const stats=read('team-stats.mjs'),preview=read('callups-preview.mjs'),app=read('app.js'),cc=read('control-center.mjs');
const teams=[
 {team_id:'a',code:'a',name:'Seniors A',division:'D3',played:2,wins:1,draws:1,losses:0,goals_for:3,goals_against:2},
 {team_id:'b',code:'b',name:'Seniors B',division:'D4',played:0,wins:0,draws:0,losses:0,goals_for:0,goals_against:0},
 {team_id:'c',code:'c',name:'Seniors C',division:'Amicaux',played:0,wins:0,draws:0,losses:0,goals_for:0,goals_against:0},
 {team_id:'v',code:'veterans',name:'Vétérans',division:'D3',played:0,wins:0,draws:0,losses:0,goals_for:0,goals_against:0}
];

test('aggregate view applies invoker RLS and only counts published completed games',()=>{
 assert.match(migration,/create or replace view public\.team_form_summary\s+with \(security_invoker=true\)/);
 assert.match(migration,/m\.match_status='played' and m\.published=true/);
 assert.match(migration,/left join public\.matches m on m\.team_id=t\.id/);
 assert.match(migration,/grant select on public\.team_form_summary to anon,authenticated/);
 assert.doesNotMatch(migration,/insert into public\.matches/i);
});
test('wins and losses use home/away orientation',()=>{
 assert.match(migration,/m\.is_home and m\.home_score > m\.away_score/);
 assert.match(migration,/not m\.is_home and m\.away_score > m\.home_score/);
 assert.match(migration,/m\.home_score = m\.away_score/);
 assert.match(migration,/m\.is_home and m\.home_score < m\.away_score/);
});
test('statistic rows enforce integrity, no inferred numbers',()=>{
 assert.equal(validateTeamFormRows(teams).length,4);
 assert.throws(()=>validateTeamFormRows(teams.slice(0,3)),/Incomplete/);
 assert.throws(()=>validateTeamFormRows([{...teams[0],wins:3},...teams.slice(1)]),/Inconsistent/);
 assert.throws(()=>validateTeamFormRows([{...teams[0],goals_for:-1},...teams.slice(1)]),/Invalid/);
 assert.match(stats,/Aucun résultat terminé publié/);
 assert.match(stats,/Ne constitue pas un classement officiel FFF/);
});
test('team form REST retrieves only publicly aggregated values',async()=>{
 let request;
 const fake=async(url,opts)=>{request={url,opts};return {ok:true,json:async()=>teams}};
 const data=await getTeamSummary({fetcher:fake});
 assert.equal(data[0].wins,1);
 assert.match(request.url,/\/rest\/v1\/team_form_summary\?/);
 assert.equal(request.opts.method,'GET');
 assert.doesNotMatch(request.url,/player_user_id|callups|audit/);
});
test('invitation and membership tables remain private and contain no PII',()=>{
 for(const table of ['team_player_memberships','match_callups','callup_action_audit']){
   assert.ok(migration.includes('create table if not exists app_private.'+table));
   assert.ok(migration.includes('alter table app_private.'+table+' enable row level security'));
 }
 assert.match(migration,/revoke all on app_private\.team_player_memberships,[\s\S]*?from public,anon,authenticated/);
 assert.doesNotMatch(migration,/email|phone_number|birth_date|street_address/i);
 assert.match(migration,/player_user_id uuid references auth\.users\(id\) on delete set null/);
});
test('coach cannot invite arbitrary users or edit matches from another team',()=>{
 assert.match(migration,/v_actor uuid := \(select auth\.uid\(\)\)/);
 assert.match(migration,/v_admin := coalesce\(\(select app_private\.is_admin\(\)\),false\)/);
 assert.match(migration,/a\.team_id=v_team and a\.active=true/);
 assert.match(migration,/r\.role='coach'/);
 assert.match(migration,/tm\.active=true and r\.role='player'/);
 assert.match(migration,/if not \(v_admin or v_scope\)/);
 assert.match(migration,/insert into app_private\.callup_action_audit/);
});
test('players can respond only to their own invitation',()=>{
 assert.match(migration,/where c\.match_id=p_match_id and c\.player_user_id=v_actor/);
 assert.match(migration,/p_response not in \('confirmed','declined','unsure'\)/);
 assert.match(migration,/m\.match_status not in \('cancelled','played'\)/);
 assert.match(migration,/where c\.player_user_id=\(select auth\.uid\(\)\)/);
 assert.match(migration,/revoke all on function public\.player_my_callups\(\)/);
 assert.match(migration,/grant execute on function public\.player_my_callups\(\)\s+to authenticated/);
});
test('public control preview does not load private identities or persist results',()=>{
 assert.equal(CALLUP_STATES.length,4);
 assert.equal(makeCallupPreview({team:'a',response:'confirmed'}).response,'Présent');
 assert.equal(makeCallupPreview({team:'bad'}).valid,false);
 assert.match(preview,/Aucune convocation réelle n’est visible/);
 assert.match(preview,/Aucun joueur, prénom, téléphone ou statut réel n’est enregistré/);
 assert.doesNotMatch(preview,/fetch\(|\.rpc\(|\.from\(|localStorage|innerHTML\s*=/);
 assert.match(cc,/mountCallupsPreview\(root\)/);
 assert.match(app,/if\(path==='\/matchs'\) void mountTeamStats\(\); else unmountTeamStats\(\);/);
});

test('staff can only create callups before a match has finished or been cancelled',()=>{
 const guard=read('supabase/migrations/202610210012_callups_final_match_guard.sql');
 assert.match(guard,/m\.match_status not in \('played','cancelled'\)/);
 assert.match(guard,/where m\.id=p_match_id/);
 assert.match(guard,/app_private\.is_admin\(\)/);
 assert.match(guard,/r\.role='coach'/);
 assert.match(guard,/revoke all on function public\.staff_set_callup/);
});
