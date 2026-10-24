import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicExternalFixtures} from '../external-match-previews.mjs';
import {mergeNextMatchCalendar} from '../home-next-match.mjs';
import {sportSourceReview,sportReviewTeamCounts,SPORT_REVIEW_STATUSES} from '../sport-source-review.mjs';
import {readSportPublicationState} from '../admin-sport-source-review.mjs';
import {ADMIN_MODULES} from '../admin-center.mjs';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const now=Date.parse('2026-10-24T11:00:00Z');
const teams=[{id:'team-a',code:'a'},{id:'team-b',code:'b'}];
const make=(patch={})=>({
 team_code:'a',opponent:'Moldavie FC 1',localDay:'2026-10-04',
 date:'2026-10-04T15:00:00+02:00',
 time:Date.parse('2026-10-04T15:00:00+02:00'),
 status:'played',home_score:1,away_score:3,
 source_label:'SportCorico',competition:'Seniors D3 · Poule B',
 date_confirmed_by_club:true,validated_by_club:false,...patch
});
test('step62 external observations always remain unapproved even if old source flags said confirmed',()=>{
 const external=publicExternalFixtures({now:0,includePast:true,period:'all',season:'2026-2027'});
 assert.ok(external.length>=10);
 assert.ok(external.every(r=>r.validated_by_club===false));
 assert.ok(external.every(r=>r.date_confirmed_by_club===false));
 const merged=mergeNextMatchCalendar([],external,[]);
 assert.ok(merged.length>=5);
 assert.ok(merged.every(x=>x.clubConfirmed===false&&x.published===false));
 const ui=read('home-next-match.mjs');
 assert.match(ui,/Calendrier référencé · date et horaire à confirmer par le club/);
 assert.doesNotMatch(read('external-match-previews.mjs'),/date_confirmed_by_club:true/);
});
test('step62 review distinguishes sourced scores, outdated kickoff and upcoming fixtures',()=>{
 const all=[
  make(),
  make({status:'scheduled',localDay:'2026-10-01',date:'2026-10-01T15:00:00+02:00',
    time:Date.parse('2026-10-01T15:00:00+02:00'),opponent:'Match passé'}),
  make({status:'scheduled',localDay:'2026-11-01',date:'2026-11-01T15:00:00+01:00',
    time:Date.parse('2026-11-01T15:00:00+01:00'),opponent:'Nogent FC 3'})
 ];
 const review=sportSourceReview(all,[],teams,now);
 assert.deepEqual(review.records.map(x=>x.kind),['source_result','outdated','new']);
 assert.ok(review.records.every(x=>x.clubApproved===false));
 assert.equal(review.counts.source_result,1);
 assert.equal(review.counts.outdated,1);
 assert.equal(review.counts.new,1);
 assert.equal(review.needsReview,3);
 assert.equal(review.clubPublicationPerformed,false);
 assert.equal(review.sourceOwnershipConfirmed,false);
 assert.equal(Object.isFrozen(review.records),true);
 assert.equal(Object.isFrozen(review.records[0]),true);
 assert.match(SPORT_REVIEW_STATUSES.source_result,/tiers/);
});
test('step62 recorded club draft is not called approved, mismatched score/cancel is flagged',()=>{
 const src=[make()];
 const official=[{team_id:'team-a',scheduled_at:'2026-10-04T15:00:00+02:00',
  opponent_name:'Moldavie FC 1',match_status:'played',
  home_score:1,away_score:3,published:false}];
 const recorded=sportSourceReview(src,official,teams,now);
 assert.equal(recorded.records[0].kind,'recorded');
 assert.equal(recorded.records[0].clubApproved,false);
 assert.equal(recorded.records[0].recordExists,true);
 assert.equal(recorded.needsReview,0);
 const conflicting=sportSourceReview(src,[{...official[0],home_score:2}],teams,now);
 assert.equal(conflicting.records[0].kind,'conflict');
 const scheduled=make({status:'scheduled'});
 const cancelled=sportSourceReview([scheduled],[{...official[0],match_status:'cancelled'}],teams,now);
 assert.equal(cancelled.records[0].kind,'conflict');
});
test('step62 refuses duplicated, malformed and unknown-team external matches',()=>{
 const entries=[make(),make({...{},opponent:'Moldavie FC 1'}),
  make({team_code:'unknown',opponent:'Autre équipe'}),
  make({status:'played',localDay:'not-a-day'}),
  make({opponent:'X'}),
  make({date:'2026-10-04',time:NaN})
 ];
 const r=sportSourceReview(entries,[],teams,now);
 assert.equal(r.counts.conflict,2);
 assert.equal(r.counts.invalid,4);
 assert.equal(r.needsReview,r.total);
 assert.ok(sportReviewTeamCounts(r).some(x=>x.code==='a'&&x.pending>=2));
 assert.throws(()=>sportSourceReview(null,[],teams,now));
 assert.throws(()=>sportSourceReview([],[],teams,NaN));
});
test('step62 protected publication review counts only consented, published and dated content',async()=>{
 const calls=[];
 const api={
  from(name){
   calls.push('from:'+name);
   assert.equal(name,'club_teams');
   return {select:async column=>{
    assert.equal(column,'id,code,name');
    return {data:teams,error:null};
   }};
  },
  async rpc(name){
   calls.push('rpc:'+name);
   if(name==='admin_list_management_matches')return {data:[{
    team_id:'team-a',opponent_name:'Nogent FC',published:true,
    scheduled_at:'2026-11-01T15:00:00+01:00',match_status:'scheduled'
   }],error:null};
   if(name==='admin_list_management_news')return {data:[
    {status:'published',visibility:'public',consent_reviewed:true,
     published_at:'2026-10-23T15:00:00Z'},
    {status:'published',visibility:'public',consent_reviewed:false,
     published_at:'2026-10-23T15:00:00Z'},
    {status:'draft',visibility:'public',consent_reviewed:true,
     published_at:null}
   ],error:null};
   throw Error('unexpected RPC');
  }
 };
 const report=await readSportPublicationState(api,{now});
 assert.equal(report.publishedMatches,1);
 assert.equal(report.publicNews,1);
 assert.equal(report.matchesAvailable,true);
 assert.equal(report.newsAvailable,true);
 assert.equal(report.clubPublicationPerformed,false);
 assert.ok(report.report.records.every(x=>!x.clubApproved));
 assert.deepEqual(calls.sort(),[
  'from:club_teams','rpc:admin_list_management_matches','rpc:admin_list_management_news'
 ]);
});
test('step62 reports unknown counts rather than fictional zero when management RPC fails',async()=>{
 const unavailable=await readSportPublicationState({
  from:()=>({select:async()=>({error:{code:'42501'},data:null})}),
  rpc:async()=>({error:{code:'42501'},data:null})
 },{now});
 assert.equal(unavailable.publishedMatches,null);
 assert.equal(unavailable.publicNews,null);
 assert.equal(unavailable.matchesAvailable,false);
 assert.equal(unavailable.teamsAvailable,false);
 assert.equal(unavailable.newsAvailable,false);
 assert.equal(unavailable.clubPublicationPerformed,false);
});
test('step62 source review is MFA gated, read-only and reachable within existing administration',()=>{
 const center=read('admin-center.mjs'),panel=read('admin-sport-source-review.mjs');
 assert.equal(ADMIN_MODULES.some(x=>x.id==='sport-review'),true);
 assert.match(center,/case 'sport-review':void mountAdminSportReview\(view,api,verified\.userId/);
 assert.match(center,/const check=await adminSessionStatus\(api,verified\.userId\)/);
 assert.match(panel,/adminSessionStatus\(api,userId\)/);
 assert.match(panel,/if\(checked\?\.status!=='admin'\)/);
 assert.match(panel,/if\(verification.status!=='admin'\)/);
 assert.doesNotMatch(panel,/\bservice_role\b|auth\.admin|\.insert\(|\.update\(|\.delete\(|admin_save_|method:'POST'/);
 assert.doesNotMatch(panel,/window\.open|https:\/\/www\.sportcorico\.com|href\s*=/);
 assert.match(panel,/Ne pas confondre Boissy UJ et Boissy FC/);
});
