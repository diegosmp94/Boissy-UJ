import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CLUB_TEAMS} from '../club-teams.mjs';
import {loadTeamPublishedMatches} from '../team-pages.mjs';
import {boundedPublicRequest} from '../public-catalog-timeout.mjs';

const source=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('profile sports loader rejects a timed-out request while preserving navigation cancellation',async()=>{
 const ctrl=new AbortController();
 const deadline=boundedPublicRequest(ctrl.signal,25);
 const stalled=(_url,{signal})=>new Promise((_,reject)=>{
   if(signal.aborted)return reject(new Error('network timeout'));
   signal.addEventListener('abort',()=>reject(new Error('network timeout')),{once:true});
 });
 try{
   await assert.rejects(loadTeamPublishedMatches('a',{signal:deadline.signal,fetcher:stalled}),/network timeout/);
   assert.equal(deadline.signal.aborted,true);
   assert.equal(ctrl.signal.aborted,false);
 }finally{deadline.dispose();}
});

test('team profiles use a bounded request, preserve static archives on outage, and never suggest club validation',()=>{
 const js=source('team-pages.mjs');
 assert.match(js,/import \{boundedPublicRequest\} from '\.\/public-catalog-timeout\.mjs'/);
 assert.match(js,/const deadline=boundedPublicRequest\(controller\.signal\)/);
 assert.match(js,/loadTeamPublishedMatches\(code,\{signal:deadline\.signal\}\)/);
 assert.match(js,/remoteUnavailable=true/);
 assert.match(js,/result=\{configured:false,matches:\[\]\}/);
 assert.match(js,/Les archives ci-dessous restent consultables/);
 assert.match(js,/notice\.setAttribute\('role','status'\)/);
 assert.match(js,/\}finally\{deadline\.dispose\(\);\}/);
 assert.match(js,/const sourced=publicExternalFixtures\(\{team:code,includePast:true,period:'all'\}\)/);
 assert.match(js,/Les matchs présentés dans cette section sont à confirmer par le club/);
 assert.match(js,/!result\.configured\)\{/);
 assert.doesNotMatch(js,/L’équipe est en cours de configuration\. Aucun calendrier officiel disponible\.\'\)\);return;/);
 assert.doesNotMatch(js,/\.insert\(|\.upsert\(|\.update\(|\.delete\(|service_role/);
});

test('recruitment filter keeps every known team including futsal named Senior, with truthful fixture labels',()=>{
 const join=source('join-center.mjs');
 const futsal=CLUB_TEAMS.find(t=>t.code==='futsal');
 assert.equal(futsal?.name,'Senior');
 assert.equal(futsal?.discipline,'futsal');
 assert.match(join,/Object\.fromEntries\(CLUB_TEAMS\.map\(team=>\[team\.code,team\.name\]\)\)/);
 assert.match(join,/Senior \(D2\) dans la catégorie futsal/);
 assert.match(join,/calendriers sourcés non homologués/);
 assert.doesNotMatch(join,/Le Match Center présente uniquement les rencontres effectivement publiées/);
 assert.doesNotMatch(join,/'Seniors futsal'/);
});
