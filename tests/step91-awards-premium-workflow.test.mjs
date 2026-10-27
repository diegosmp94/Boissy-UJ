import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {awardsDraftError,awardSaveArgs,nomineeDraftError,AWARDS_STATUS_LABELS}
 from '../admin-awards.mjs';
import {validAwardsVotingCapability,eligibleAwardForVoting,
 eligibleAwardsNominees} from '../member-awards-voting.mjs';
import {ADMIN_MODULES} from '../admin-center.mjs';
import {availableAdminModules} from '../admin-navigation.mjs';

const get=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=get('supabase/migrations/202610270010_step91_awards_verified_voting.sql');
const admin=get('admin-awards.mjs'),member=get('member-awards-voting.mjs');
const hub=get('admin-center.mjs'),probe=get('admin-control-reliability.mjs');
const auth=get('auth.mjs'),catalog=get('awards-center.mjs');
const id='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const draft={slug:'joueur-de-la-saison',title:'Joueur de la saison',
 description:'Votes officiels',team_code:'a',season_label:'2026/2027',
 opens_at:'2026-11-10T10:00',closes_at:'2026-11-16T20:00',published:false};
const award={id,published:true,voting_status:'open',results_published:false,
 opens_at:'2026-11-10T10:00:00Z',closes_at:'2026-11-16T20:00:00Z'};
const nominee={id,award_id:other,display_label:'Candidat validé',
 published:true,consent_reviewed:true,sort_order:2};

test('step91: Awards draft validates exact category, slug, dates and consent',()=>{
 assert.equal(awardsDraftError(draft),null);
 assert.equal(awardSaveArgs(draft).p_id,null);
 for(const patch of [{slug:'spaces slug'},{slug:'UPPER'}, {team_code:'futsal'},
  {title:'ab'}, {description:'x'.repeat(1601)},{season_label:'26/27'},
  {opens_at:null}, {closes_at:'2026-11-09T00:00'},
  {closes_at:'unparseable'}]){
  assert.ok(awardsDraftError({...draft,...patch}),JSON.stringify(patch));
 }
 const a=awardSaveArgs({...draft,published:true},{
  id,updated_at:'2026-10-27T12:00:00Z'});
 assert.equal(a.p_id,id);assert.equal(a.p_expected_updated_at,'2026-10-27T12:00:00Z');
 assert.equal(a.p_published,true);assert.ok(a.p_opens_at.endsWith('Z'));
 assert.equal(nomineeDraftError({label:'Candidate',consent:true,
  published:true,order:1}),null);
 assert.ok(nomineeDraftError({label:'Candidate',consent:false,
  published:true,order:1}));
 assert.ok(nomineeDraftError({label:'x',consent:true,
  published:false,order:1}));
 assert.ok(nomineeDraftError({label:'Valid',consent:true,
  published:false,order:10001}));
 assert.equal(Object.keys(AWARDS_STATUS_LABELS).length,4);
});

test('step91: own vote UI validates server capability and time, no fake votes or tally',()=>{
 assert.deepEqual(validAwardsVotingCapability({enabled:false,premium_active:true}),
  {enabled:false,premiumActive:true});
 assert.deepEqual(validAwardsVotingCapability({enabled:true,premium_active:true}),
  {enabled:true,premiumActive:true});
 assert.equal(validAwardsVotingCapability({enabled:1,premium_active:true}),null);
 const now=Date.parse('2026-11-12T12:00:00Z');
 assert.equal(eligibleAwardForVoting(award,now),true);
 for(const patch of [{voting_status:'closed'},{voting_status:'coming'},
  {results_published:true},{published:false},
  {closes_at:'2026-11-12T11:00:00Z'},
  {opens_at:'2026-11-13T11:00:00Z'}])
  assert.equal(eligibleAwardForVoting({...award,...patch},now),false);
 assert.equal(eligibleAwardsNominees([nominee],other).length,1);
 assert.equal(eligibleAwardsNominees([nominee],id).length,0);
 assert.equal(eligibleAwardsNominees([{...nominee,consent_reviewed:false}],other).length,0);
 assert.equal(eligibleAwardsNominees([{...nominee,published:false}],other).length,0);
 assert.doesNotMatch(member,/\.insert\(|\.delete\(|\.update\(|innerHTML|localStorage|service_role|stripe/i);
});

test('step91: database voting gate is OFF in production, no assignments or fixtures',()=>{
 for(const marker of [
  'create table if not exists app_private.awards_voting_gate',
  'enabled boolean not null default false',
  'values(1,false)',
  'do update set enabled=false',
  'alter table app_private.awards_voting_gate enable row level security',
  'revoke all on app_private.awards_voting_gate from public,anon,authenticated',
  'create table if not exists app_private.award_ballots',
  'primary key(award_id,user_id)',
  'award_ballot_valid_nominee',
  'alter table app_private.award_ballots enable row level security',
  'revoke all on app_private.award_ballots from public,anon,authenticated',
  'create table if not exists app_private.admin_awards_audit',
  'alter table app_private.admin_awards_audit enable row level security'
 ])assert.ok(sql.includes(marker),marker);
 assert.doesNotMatch(sql,/insert into (public\.club_awards|public\.club_award_nominees|public\.club_award_results|app_private\.award_ballots)/i);
 assert.doesNotMatch(sql,/update app_private\.awards_voting_gate set enabled=true/i);
 assert.doesNotMatch(sql,/grant (?:select|insert|delete|update) on app_private\./i);
});
test('step91: admin read/write only after role and AAL2 server checks, never ordinary table writes',()=>{
 for(const n of ['admin_list_awards()',
  'admin_list_award_nominees(uuid)',
  'admin_save_award(','admin_save_award_nominee(',
  'admin_transition_award(']){
  assert.ok(sql.includes('create or replace function public.'+n),n);
  assert.ok(sql.includes('grant execute on function public.'+n),n);
  assert.ok(sql.includes('revoke all on function public.'+n),n);
 }
 const parts=sql.split(/create or replace function public\.admin_/).slice(1);
 assert.equal(parts.length,5);
 for(const f of parts){
  const start=f.indexOf('as $fn$'),end=f.indexOf('$fn$;',start);
  const body=f.slice(start,end);
  assert.ok(body.includes('app_private.is_admin()'),f.slice(0,55));
  assert.ok(body.includes('auth.uid()'),f.slice(0,55));
 }
 assert.match(sql,/p_expected_updated_at/);
 assert.match(sql,/updated_at=p_expected_updated_at returning \* into item/);
 assert.match(sql,/previous\.voting_status<>'coming'/);
 assert.match(sql,/edition\.voting_status<>'coming'/);
 assert.match(sql,/p_published and not p_consent_reviewed/);
 assert.match(sql,/nominees frozen after vote opening/i);
 assert.doesNotMatch(admin,/\.insert\(|\.update\(|\.delete\(|innerHTML|document\.write/);
});

test('step91: votes are unique, private, can change during window, require confirmed Premium',()=>{
 const cast=sql.split('create or replace function public.member_cast_award_vote(')[1]
  .split('create or replace function public.member_my_award_vote(')[0];
 for(const marker of [
  "auth.jwt()->>'is_anonymous'",
  'email_confirmed_at is not null',
  'app_private.awards_voting_gate where id=1',
  'app_private.member_has_active_premium()',
  'where id=p_award_id for update',
  "edition.voting_status<>'open'",
  'edition.opens_at<=v_time and v_time<edition.closes_at',
  'n.published and n.consent_reviewed',
  'insert into app_private.award_ballots(award_id,user_id,nominee_id)',
  'on conflict(award_id,user_id) do update',
  'set nominee_id=excluded.nominee_id'
 ])assert.ok(cast.includes(marker),marker);
 assert.doesNotMatch(cast,/p_user_id|user_metadata|p_premium|p_role/);
 const own=sql.split('create or replace function public.member_my_award_vote(')[1]
  .split('create or replace function public.member_withdraw_award_vote(')[0];
 assert.match(own,/b\.user_id=actor/);
 assert.doesNotMatch(own,/count\(|email|other_user/);
 const withdraw=sql.split('create or replace function public.member_withdraw_award_vote(')[1]
  .split('create or replace function public.member_awards_voting_capability(')[0];
 assert.match(withdraw,/where id=p_award_id for update/);
 assert.match(withdraw,/edition\.voting_status<>'open'/);
 assert.match(withdraw,/b\.user_id=actor/);
 assert.match(withdraw,/return found/);
});
test('step91: winner is computed only from actual ballots, never before close or with tie',()=>{
 const t=sql.split('create or replace function public.admin_transition_award(')[1]
  .split('create or replace function public.member_cast_award_vote(')[0];
 for(const marker of [
  "p_action='open'", "p_action='close'","p_action='publish_results'",
  'app_private.awards_voting_gate',
  'count_nominees<2',
  'edition.voting_status',
  'edition.closes_at>now_utc',
  'app_private.award_ballots',
  'max_votes is null or max_votes<1',
  'ties<>1 or lead_nominee is null',
  'n.published and n.consent_reviewed',
  'insert into public.club_award_results(award_id,nominee_id)',
  "results_published=true",
  'where id=p_award_id for update'
 ])assert.ok(t.includes(marker),marker);
 assert.match(t,/Equal first place: manual rules required/);
 assert.match(t,/No cast ballots: do not invent winner/);
 assert.doesNotMatch(t,/order by random\(\)|default_winner|nominee_id=gen_random_uuid/);
 assert.match(sql,/award_result_nominee_same_award|insert into public\.club_award_results/);
});

test('step91: own member panel never votes when OFF or not active Premium, keeps results public',()=>{
 for(const marker of [
  "api.rpc('member_awards_voting_capability')",
  'if(!cap||!cap.enabled)',
  'if(!cap.premiumActive)',
  "api.rpc('member_my_award_vote'",
  "api.rpc('member_cast_award_vote'",
  "api.rpc('member_withdraw_award_vote'",
  'api.auth.getUser()',
  'u.data?.user?.id===userId',
  'Vous pouvez le modifier ou le retirer avant la clôture'
 ])assert.ok(member.includes(marker),marker);
 assert.match(auth,/mountMemberAwardsVoting\(account,api,user.id/);
 assert.match(catalog,/results_published&&award\.voting_status/);
 assert.doesNotMatch(catalog,/\.rpc\(|method:'POST'|stripe/i);
});
test('step91: Awards admin navigation probes its own read capability and routes real editor',()=>{
 assert.ok(ADMIN_MODULES.some(x=>x.id==='awards'));
 assert.equal(new Set(ADMIN_MODULES.map(x=>x.id)).size,ADMIN_MODULES.length);
 assert.equal(availableAdminModules(ADMIN_MODULES).some(x=>x.id==='awards'),false);
 assert.equal(availableAdminModules(ADMIN_MODULES,{awardsReady:true})
  .some(x=>x.id==='awards'),true);
 assert.match(probe,/api\.rpc\('admin_list_awards'\)/);
 assert.match(hub,/case 'awards':void mountAdminAwards\(view,api,verified.userId\)/);
 assert.match(hub,/availableAdminModules\(ADMIN_MODULES,\{eventsReady,eventRulesReady,scannerReady,awardsReady,/);
 assert.match(admin,/adminSessionStatus\(api,userId\)/);
 assert.match(admin,/v.level==='aal2'/);
 assert.match(admin,/admin_save_award_nominee/);
 assert.match(admin,/admin_transition_award/);
});
