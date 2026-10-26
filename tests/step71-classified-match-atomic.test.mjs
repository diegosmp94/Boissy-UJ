import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateMatchDraft} from '../admin-editor-rules.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610260010_atomic_classified_matches.sql');
const admin=read('admin-management.mjs');
const matches=[{id:'team-a',code:'a'}],seasons=[{id:'season-1',state:'active'}];
const original={team:'team-a',season:'season-1',opponent:'Club adverse',date:'2026-11-08T15:00',
 venue:'Stade municipal',state:'scheduled',hScore:'',aScore:'',publish:false,
 competitionKind:'unspecified',competitionLabel:''};

test('drafts may remain unclassified; published matches must be classified explicitly',()=>{
 assert.equal(validateMatchDraft(original,matches,seasons),null);
 assert.match(validateMatchDraft({...original,publish:true},matches,seasons),/Classe la rencontre/);
 for(const competitionKind of ['league','cup']){
  assert.match(validateMatchDraft({...original,publish:true,competitionKind},matches,seasons),/nom du championnat ou de la coupe/);
  assert.equal(validateMatchDraft({...original,publish:true,competitionKind,competitionLabel:'Coupe du Val-de-Marne'},matches,seasons),null);
 }
 assert.equal(validateMatchDraft({...original,publish:true,competitionKind:'friendly'},matches,seasons),null);
 assert.match(validateMatchDraft({...original,competitionKind:'rogue'},matches,seasons),/compétition valide/);
 assert.match(validateMatchDraft({...original,competitionKind:'unspecified',competitionLabel:'Coupe'},matches,seasons),/non classée/);
 assert.match(validateMatchDraft({...original,competitionKind:'cup',competitionLabel:'ZZ'},matches,seasons),/3 à 100/);
 assert.match(validateMatchDraft({...original,competitionKind:'league',competitionLabel:'Coupe\ninvalide'},matches,seasons),/caractères de contrôle/);
});
test('played has two valid scores, postponed/cancelled/scheduled have no scores',()=>{
 for(const state of ['scheduled','postponed','cancelled']){
  assert.equal(validateMatchDraft({...original,state,competitionKind:'league',competitionLabel:'Seniors D3'},matches,seasons),null);
  assert.match(validateMatchDraft({...original,state,hScore:'1'},matches,seasons),/scores/);
 }
 assert.equal(validateMatchDraft({...original,state:'played',hScore:'2',aScore:'0'},matches,seasons),null);
 assert.match(validateMatchDraft({...original,state:'played',hScore:'2'},matches,seasons),/deux scores/);
});
test('database refuses all published unclassified fixtures at commit, even via legacy RPC',()=>{
 assert.match(sql,/create constraint trigger published_match_competition_guard/);
 assert.match(sql,/deferrable initially deferred/);
 assert.match(sql,/select \* into v_match from public\.matches where id=new\.id/);
 assert.match(sql,/v_match\.published/);
 assert.match(sql,/v_match\.competition_kind not in \('league','cup','friendly'\)/);
 assert.match(sql,/Published match requires an approved competition/);
 assert.match(sql,/after insert or update on public\.matches/);
 assert.match(sql,/app_private\.require_published_match_competition/);
});
test('classified save is one transaction with MFA, existing role/score/season guard and two private audit trails',()=>{
 const body=sql.split('create or replace function public.admin_save_classified_match(')[1].split('$fn$;')[0];
 assert.match(sql,/^begin;/m);assert.match(sql,/^commit;/m);
 assert.match(body,/v_actor uuid := \(select auth\.uid\(\)\)/);
 assert.match(body,/app_private\.is_admin\(\)/);
 assert.match(body,/public\.staff_save_match\(/);
 assert.match(body,/p_match_id,p_team_id,p_season_id,p_opponent_name,p_scheduled_at/);
 assert.match(body,/p_home_score,p_away_score/);
 assert.match(body,/p_competition_kind in \('league','cup'\)/);
 assert.match(body,/p_publish and p_competition_kind='unspecified'/);
 assert.match(body,/for update/);
 assert.match(body,/update public\.matches\s+set competition_kind=p_competition_kind/);
 assert.match(body,/insert into app_private\.match_competition_audit/);
 assert.doesNotMatch(body,/update public\.external_sourced_match_archive|insert into public\.matches/);
 assert.match(sql,/grant execute on function public\.admin_save_classified_match\([\s\S]+?\)\s+to authenticated/);
 assert.match(sql,/revoke all on function public\.admin_save_classified_match/);
 assert.doesNotMatch(sql,/grant execute on function .* to (?:anon|public)/i);
});
test('admin form writes score, status, season and competition together under AAL2',()=>{
 assert.match(admin,/rpcList:'admin_list_management_matches',rpcSave:'admin_save_classified_match'/);
 assert.match(admin,/p_competition_kind:d\.competitionKind/);
 assert.match(admin,/p_competition_label:d\.competitionLabel\|\|null/);
 assert.match(admin,/competitionKind:competitionKind\.value/);
 assert.match(admin,/competitionLabel:competitionLabel\.value\.trim\(\)/);
 assert.match(admin,/field\('Compétition : championnat, coupe ou amical',competitionKind\)/);
 assert.match(admin,/field\('Nom exact de la compétition',competitionLabel\)/);
 assert.match(admin,/validate:d=>validateMatchDraft\(d,teams,seasons\)/);
 assert.match(admin,/api\.rpc\(rpcSave,payload\)/);
 assert.match(admin,/if\(!await guarded\(api,userId\)\)/);
 assert.match(admin,/if\(requiresConfirmation&&key!==confirmKey\)/);
 assert.match(admin,/mountAdminMatchCompetition\(competitionPanel,api,userId\)/);
});
