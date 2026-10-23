import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateVotingTestTarget,voteIsDenied,runVotingRecipe} from '../scripts/real-awards-voting-smoke.mjs';

const sql=readFileSync(new URL('../supabase/migrations/202610230003_premium_awards_ballots.sql',import.meta.url),'utf8');
const script=readFileSync(new URL('../scripts/real-awards-voting-smoke.mjs',import.meta.url),'utf8');
const fixtures={awardId:'11111111-1111-4111-8111-111111111111',
 nomineeId:'22222222-2222-4222-8222-222222222222',
 foreignNomineeId:'33333333-3333-4333-8333-333333333333'};
const env={
 BOISSY_AWARD_TEST_ACK:'YES_WRITE_AWARD_TEST_BALLOTS_ON_ISOLATED_STAGING',
 BOISSY_AWARD_TEST_PROJECT_REF:'abcde12345abcde12345',
 BOISSY_AWARD_TEST_URL:'https://abcde12345abcde12345.supabase.co/',
 BOISSY_AWARD_TEST_KEY:'sb_publishable_test_fixture',
 BOISSY_AWARD_TEST_PERSONAS_JSON:JSON.stringify({
  premium:{email:'premium@example.invalid',password:'not-a-real-credential'},
  supporter:{email:'supporter@example.invalid',password:'not-a-real-credential'}
 }),
 BOISSY_AWARD_TEST_FIXTURES_JSON:JSON.stringify(fixtures)
};
const config=(overrides={})=>validateVotingTestTarget({...env,...overrides});
test('stage-only runner refuses production, wrong origin, missing ack and service key',()=>{
 assert.equal(config().url,'https://abcde12345abcde12345.supabase.co');
 for(const [k,v] of [
  ['BOISSY_AWARD_TEST_ACK',''],
  ['BOISSY_AWARD_TEST_PROJECT_REF','dahzewvbybujqhogumte'],
  ['BOISSY_AWARD_TEST_URL','https://dahzewvbybujqhogumte.supabase.co/'],
  ['BOISSY_AWARD_TEST_URL','http://abcde12345abcde12345.supabase.co/'],
  ['BOISSY_AWARD_TEST_KEY','sb_secret_abc'],
  ['BOISSY_AWARD_TEST_KEY','testkey']
 ])assert.throws(()=>config({[k]:v}),undefined,k);
 const bad=JSON.parse(env.BOISSY_AWARD_TEST_PERSONAS_JSON);
 bad.supporter.email=bad.premium.email.toUpperCase();
 assert.throws(()=>config({BOISSY_AWARD_TEST_PERSONAS_JSON:JSON.stringify(bad)}),/different people/);
 assert.throws(()=>config({BOISSY_AWARD_TEST_FIXTURES_JSON:JSON.stringify({...fixtures,nomineeId:'bad'})}),/real UUIDs/);
});
test('migration has private entitlements, ballots and no direct grants',()=>{
 for(const table of ['award_vote_entitlements','award_ballots']){
  assert.ok(sql.includes('create table if not exists app_private.'+table));
  assert.ok(sql.includes('alter table app_private.'+table+' enable row level security'));
  assert.ok(sql.includes('revoke all on app_private.'+table+' from public,anon,authenticated'));
  assert.ok(!sql.includes('grant select on app_private.'+table));
  assert.ok(!sql.includes('grant insert on app_private.'+table));
 }
 assert.match(sql,/primary key \(award_id,user_id\)/);
 assert.match(sql,/foreign key \(award_id,nominee_id\)/);
 assert.match(sql,/references auth\.users\(id\) on delete cascade/);
 assert.doesNotMatch(sql,/insert into app_private\.award_vote_entitlements[\s\S]*?values\s*\(/i);
});
test('server gates email, premium, consent, published category, open time and duplicates',()=>{
 for(const phrase of [
  'language plpgsql security definer set search_path',
  'select auth.uid()',
  'u.email_confirmed_at is not null',
  "e.source_kind='verified_billing_webhook'",
  'e.revoked_at is null',
  'e.valid_from<=v_now and v_now<e.valid_until',
  "a.voting_status='open'",
  'a.results_published=false',
  'a.opens_at<=v_now and v_now<a.closes_at',
  'n.award_id=p_award_id',
  'n.published=true and n.consent_reviewed=true',
  'for share',
  'on conflict (award_id,user_id) do nothing',
  "errcode='23505'"
 ])assert.ok(sql.includes(phrase),phrase);
 assert.match(sql,/select b\.nominee_id[\s\S]*?b\.user_id=v_user/);
 assert.match(sql,/delete from app_private\.award_ballots[\s\S]*?user_id=v_user/);
 assert.doesNotMatch(sql,/grant execute on function .* to anon/);
 for(const [fn,sig] of [
  ['member_cast_award_vote','uuid,uuid'],
  ['member_my_award_vote','uuid'],['member_withdraw_award_vote','uuid']
 ]){
  assert.ok(sql.includes('revoke all on function public.'+fn+'('+sig+')'));
  assert.ok(sql.includes('grant execute on function public.'+fn+'('+sig+')'));
 }
});
test('denial recognition is strict and never treats success as refusal',()=>{
 assert.equal(voteIsDenied({ok:false,status:403,payload:{code:'42501'}},'42501'),true);
 assert.equal(voteIsDenied({ok:false,status:409,payload:{code:'23505'}},'23505'),true);
 assert.equal(voteIsDenied({ok:true,status:200,payload:null},'42501'),false);
 assert.equal(voteIsDenied({ok:false,status:400,payload:{code:'23503'}},'42501'),false);
 assert.match(script,/fixturesVerified/);
 assert.doesNotMatch(script,/sk_live_|pk_live_/i);
});
const token=sub=>'header.'+Buffer.from(JSON.stringify({sub,aal:'aal1'})).toString('base64url')+'.sig';
function fakeApi({allowSupporter=false,allowDuplicate=false}={}){
 const users={premium:'premium-account',supporter:'supporter-account'};
 const identity=Object.fromEntries(Object.entries(users).map(([name,id])=>[token(id),id]));
 let vote=null;
 const calls=[];
 return {calls,request:async(path,{method='GET',token:jwt,body={}}={})=>{
  const who=identity[jwt];
  calls.push({path,method,who});
  const yes=payload=>({ok:true,status:200,payload});
  const no=(code,status=403)=>({ok:false,status,payload:{code}});
  if(path.startsWith('auth/v1/token')){
   const id=body.email.startsWith('premium@')?users.premium:users.supporter;
   return yes({access_token:token(id),user:{id}});
  }
  if(path==='auth/v1/user')return yes({id:who,email_confirmed_at:'2026-01-01'});
  if(path==='auth/v1/logout')return yes(null);
  if(path.endsWith('/member_my_award_vote'))return yes(who===users.premium?vote:null);
  if(path.endsWith('/member_withdraw_award_vote')){
   const removed=who===users.premium&&vote!==null;
   if(removed)vote=null;
   return yes(removed);
  }
  if(path.endsWith('/member_cast_award_vote')){
   if(!who)return no('42501');
   if(who===users.supporter&&!allowSupporter)return no('42501');
   if(body.p_nominee_id!==fixtures.nomineeId)return no('42501');
   if(vote!==null&&!allowDuplicate)return no('23505',409);
   vote=body.p_nominee_id;
   return yes(true);
  }
  throw new Error('Unexpected call');
 }};
}
test('offline simulated API exercises all staging voting and withdrawal cases',async()=>{
 const api=fakeApi(),labels=[];
 await runVotingRecipe(api,config(),label=>labels.push(label));
 assert.equal(labels.length,9);
 assert.ok(labels.some(x=>x.includes('duplicate ballot rejected')));
 assert.ok(labels.some(x=>x.includes('withdrawn')));
 assert.equal(api.calls.filter(x=>x.path.endsWith('member_cast_award_vote')).length,4);
 assert.ok(api.calls.some(x=>x.path==='auth/v1/logout'));
});
test('unsafe server granting a free vote is detected and staged ballots are cleaned',async()=>{
 const api=fakeApi({allowSupporter:true});
 await assert.rejects(()=>runVotingRecipe(api,config()),/did not refuse/);
 assert.ok(api.calls.filter(x=>x.path.endsWith('member_withdraw_award_vote')).length>=2);
});
test('unsafe server allowing duplicate Premium ballot is detected',async()=>{
 const api=fakeApi({allowDuplicate:true});
 await assert.rejects(()=>runVotingRecipe(api,config()),/did not refuse/);
 assert.ok(api.calls.some(x=>x.path.endsWith('member_withdraw_award_vote')));
});
