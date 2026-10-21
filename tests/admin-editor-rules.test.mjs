import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 validateSeasonDraft,validateMatchDraft,validateNewsDraft,adminSaveErrorMessage
} from '../admin-editor-rules.mjs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const source=read('admin-management.mjs');
const teams=[{id:'team-a',code:'a'},{id:'team-f',code:'futsal'}];
const seasons=[{id:'season-1'}];
const match={team:'team-f',season:'season-1',opponent:'Équipe adverse',date:'2026-10-23T20:00',
 venue:'Gymnase du club',state:'scheduled',hScore:'',aScore:'',publish:false};
const article={team:'',title:'Actualités générales du club',excerpt:'Annonce',body:'Texte original.',
 rights:true,publish:true};

test('season dates and naming follow the database year contract',()=>{
 assert.equal(validateSeasonDraft({label:'2026/2027',start:'2026-08-01',end:'2027-07-31'}),null);
 assert.match(validateSeasonDraft({label:'2017/2018',start:'2017-08-01',end:'2018-06-30'}),/saison/);
 assert.match(validateSeasonDraft({label:'2026/2028',start:'2026-08-01',end:'2028-07-31'}),/saison/);
 assert.match(validateSeasonDraft({label:'2026/2027',start:'2027-08-01',end:'2027-07-31'}),/période/);
 assert.match(validateSeasonDraft({label:'2026/2027',start:'2027-01-01',end:'2027-07-31'}),/années/);
});
test('match validation rejects unknown teams, seasons and malformed scores',()=>{
 assert.equal(validateMatchDraft(match,teams,seasons),null);
 assert.match(validateMatchDraft({...match,team:'rogue'},teams,seasons),/équipe/);
 assert.match(validateMatchDraft({...match,season:'rogue'},teams,seasons),/saison/);
 assert.match(validateMatchDraft({...match,opponent:'A'},teams,seasons),/adversaire/);
 assert.match(validateMatchDraft({...match,date:'bad'},teams,seasons),/date/);
 assert.match(validateMatchDraft({...match,venue:'Z'.repeat(161)},teams,seasons),/lieu/);
 assert.match(validateMatchDraft({...match,hScore:'2'},teams,seasons),/scores/);
 assert.equal(validateMatchDraft({...match,state:'played',hScore:'2',aScore:'0'},teams,seasons),null);
 for(const [hScore,aScore] of [['-1','2'],['2.5','0'],['100','0'],['2','']]){
  assert.match(validateMatchDraft({...match,state:'played',hScore,aScore},teams,seasons),/scores/);
 }
});
test('public club-wide articles use null team but still require rights verification',()=>{
 assert.equal(validateNewsDraft(article,teams),null);
 assert.equal(validateNewsDraft({...article,team:'team-f'},teams),null);
 assert.match(validateNewsDraft({...article,team:'unknown'},teams),/équipe/);
 assert.match(validateNewsDraft({...article,publish:true,rights:false},teams),/droits/);
 assert.equal(validateNewsDraft({...article,publish:false,rights:false},teams),null);
 assert.match(validateNewsDraft({...article,title:'X'},teams),/titre/);
 assert.match(validateNewsDraft({...article,body:''},teams),/résumé/);
 assert.match(source,/option\('','Actualité générale du club'\)/);
 assert.match(source,/p_team_id:d.team\|\|null/);
 assert.match(source,/field\('Équipe ou club entier',team\)/);
});
test('admin match creation still requires a real team UUID',()=>{
 assert.match(source,/p_team_id:d.team,p_season_id:d.season\|\|null/);
 assert.match(source,/validate:d=>validateMatchDraft\(d,teams,seasons\)/);
 assert.match(source,/field\('Équipe',team\)/);
});
test('refresh supports existing record selection without bypassing admin MFA',()=>{
 assert.match(source,/Actualiser les dossiers/);
 assert.match(source,/UI.refresh.addEventListener\('click'/);
 assert.match(source,/await reload\(keep\)/);
 assert.match(source,/async function reload\(focus=null\)\{/);
 assert.match(source,/if\(!await guarded\(api,userId\)\)/);
 assert.match(source,/if\(requiresConfirmation&&key!==confirmKey\)/);
 assert.match(source,/adminSaveErrorMessage\(result.error\)/);
 assert.doesNotMatch(source,/\.insert\(|\.update\(|\.delete\(|service_role|sk_live_|innerHTML\s*=/);
});
test('user-friendly SQL error mapping does not leak database internals',()=>{
 for(const code of ['42501','23505','40001','22023','23514','other']){
  const result=adminSaveErrorMessage({code,details:'secret@example.net'});
  assert.ok(result.length>10);
  assert.equal(result.includes('secret@example.net'),false);
 }
 assert.match(adminSaveErrorMessage({code:'42501'}),/MFA/);
 assert.match(adminSaveErrorMessage({code:'23505'}),/existe déjà/);
 assert.match(adminSaveErrorMessage({code:'40001'}),/modifié/);
});
