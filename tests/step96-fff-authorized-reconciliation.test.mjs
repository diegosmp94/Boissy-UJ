import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewAuthorizedFffImport,prepareFffManualDraft,
 FFF_REVIEW_LABELS} from '../fff-import-reconciliation.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const management=read('admin-management.mjs');
const fff=read('fff-provider.mjs');
const sample={schema_version:1,club_affiliation:'548423',
 matches:[{match_id:'sample-1',team_code:'a',opponent:'Club invité',
  start_at:'2026-11-01T15:00:00+01:00',
  venue:'Stade vérifié',is_home:true,status:'scheduled',
  source_url:'https://epreuves.fff.fr/competition/club/verify'}]};
const teams=[{id:'team-a',code:'a',name:'Seniors A'},
 {id:'team-f',code:'futsal',name:'Senior'}];
const recorded=(patch={})=>({id:'club-match-1',team_id:'team-a',
 opponent_name:'Club invité',scheduled_at:'2026-11-01T15:00:00+01:00',
 match_status:'scheduled',is_home:true,home_score:null,away_score:null,
 published:false,...patch});

test('step96: authorized sample creates review only, never calls FFF or writes Supabase',()=>{
 const result=reviewAuthorizedFffImport(sample,teams,[]);
 assert.equal(result.status,'access-not-granted');
 assert.equal(result.automatic_sync_enabled,false);
 assert.equal(result.club_publication_performed,false);
 assert.equal(result.source_permission_verified,false);
 assert.equal(result.records.length,1);
 assert.equal(result.records[0].review_status,'available');
 assert.equal(result.records[0].team_id,'team-a');
 assert.equal(result.records[0].club_confirmed,false);
 assert.equal(result.records[0].published,false);
 assert.equal(result.records[0].import_performed,false);
 assert.equal(result.counts.available,1);
 assert.equal(Object.isFrozen(result.records),true);
 assert.equal(Object.isFrozen(result.records[0]),true);
 assert.equal(Object.keys(FFF_REVIEW_LABELS).length,6);
 assert.doesNotMatch(fff,/fetch\(|XMLHttpRequest|api-dofa/);
});

test('step96: compares local Paris match day and same team/opponent with normalized diacritics',()=>{
 const same=reviewAuthorizedFffImport(sample,teams,[recorded()]);
 assert.equal(same.records[0].review_status,'already_recorded');
 assert.equal(same.counts.already_recorded,1);
 assert.throws(()=>prepareFffManualDraft(same.records[0]));
 const conflict=reviewAuthorizedFffImport(sample,teams,[recorded({is_home:false})]);
 assert.equal(conflict.records[0].review_status,'conflict');
 const late=reviewAuthorizedFffImport(sample,teams,[recorded({
  scheduled_at:'2026-11-01T16:30:00+01:00'})]);
 assert.equal(late.records[0].review_status,'conflict');
 const duplicate=reviewAuthorizedFffImport(sample,teams,[recorded(),recorded({id:'two'})]);
 assert.equal(duplicate.records[0].review_status,'ambiguous');
 const dbScore=reviewAuthorizedFffImport({...sample,matches:[{...sample.matches[0],
  status:'played',home_score:3,away_score:2}]},teams,[recorded({
  match_status:'played',home_score:3,away_score:1})]);
 assert.equal(dbScore.records[0].review_status,'conflict');
});
test('step96: provider duplicated fixture under different IDs is NOT autoprepared',()=>{
 const more={...sample,matches:[sample.matches[0],{
  ...sample.matches[0],match_id:'sample-2'}]};
 const report=reviewAuthorizedFffImport(more,teams,[]);
 assert.deepEqual(report.records.map(r=>r.review_status),['ambiguous','ambiguous']);
 assert.equal(report.counts.ambiguous,2);
 assert.throws(()=>prepareFffManualDraft(report.records[1]));
});
test('step96: only explicitly linked club team codes can be used, including the futsal Senior',()=>{
 const missing=reviewAuthorizedFffImport(sample,[teams[1]],[]);
 assert.equal(missing.records[0].review_status,'team_missing');
 assert.throws(()=>prepareFffManualDraft(missing.records[0]));
 const futsal=reviewAuthorizedFffImport({...sample,matches:[{
  ...sample.matches[0],team_code:'futsal'}]},teams,[]);
 assert.equal(futsal.records[0].team_id,'team-f');
 assert.equal(futsal.records[0].review_status,'available');
 assert.throws(()=>reviewAuthorizedFffImport(sample,[
  teams[0],{id:'duplicate',code:'a'}],[]));
 assert.throws(()=>reviewAuthorizedFffImport(sample,teams,new Array(250).fill(recorded())));
 assert.throws(()=>reviewAuthorizedFffImport(sample,teams,null));
});

test('step96: manual prefill never copies scores, publication, competition, official attribution',()=>{
 const report=reviewAuthorizedFffImport({...sample,matches:[{...sample.matches[0],
  status:'played',home_score:9,away_score:1}]},teams,[]);
 const draft=prepareFffManualDraft(report.records[0]);
 assert.equal(draft.team_id,'team-a');
 assert.equal(draft.opponent_name,'Club invité');
 assert.equal(draft.scheduled_local,'2026-11-01T15:00');
 assert.equal(draft.venue,'Stade vérifié');
 assert.equal(draft.match_status,'played');
 assert.equal(draft.home_score,'');
 assert.equal(draft.away_score,'');
 assert.equal(draft.competition_kind,'unspecified');
 assert.equal(draft.competition_label,'');
 assert.equal(draft.published,false);
 assert.equal(draft.source_kind,'manual');
 assert.equal(draft.source_reference,null);
 assert.equal(Object.isFrozen(draft),true);
});
test('step96: mismatches, malformed feed or wrong affiliation are refused with no partial rows',()=>{
 assert.throws(()=>reviewAuthorizedFffImport({...sample,club_affiliation:'565242'},teams,[]));
 assert.throws(()=>reviewAuthorizedFffImport({...sample,matches:[{
  ...sample.matches[0],team_code:'unknown'}]},teams,[]));
 assert.throws(()=>reviewAuthorizedFffImport({...sample,matches:[{
  ...sample.matches[0],source_url:'https://untrusted.example/foo'}]},teams,[]));
 assert.throws(()=>reviewAuthorizedFffImport({...sample,matches:[{
  ...sample.matches[0],home_score:4}]},teams,[]));
 assert.throws(()=>reviewAuthorizedFffImport(sample,null,[]));
 assert.throws(()=>reviewAuthorizedFffImport(sample,teams,[],NaN));
});
test('step96: admin must confirm authorized export and MFA before preview or draft',()=>{
 for(const marker of [
  'Je confirme avoir vérifié une autorisation FFF écrite',
  "JSON.parse(input.value)",
  "api.rpc('admin_list_management_matches')",
  "api.from('club_teams').select('id,code,name')",
  "reviewAuthorizedFffImport(parsed,teamsReply.data,matchesReply.data)",
  "if(!await guarded(api,userId))",
  "if(!authz.n.checked)",
  "if(input.value!==sourceVersion||!report)",
  "const latest=await api.rpc('admin_list_management_matches')",
  "if(!current||current.review_status!=='available'",
  "prepareFffManualDraft(record)",
  "fields.competitionKind.value='unspecified'",
  "fields.publish.n.checked=false",
  "fields.hScore.value='';fields.aScore.value=''",
  "dossier.value='new'",
  "rpcSave:'admin_save_classified_match'",
  "p_source_kind:'manual'",
  "mountFffPreview(root,api,userId,{"
 ])assert.ok(management.includes(marker),marker);
 assert.doesNotMatch(management,/rpcSave:'admin_import_fff'|p_source_kind:'fff',/);
 assert.doesNotMatch(fff,/api-dofa|Authorization:|\.fetch\(/);
});
