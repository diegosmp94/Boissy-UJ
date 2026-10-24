import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {boundedPublicRequest} from '../public-catalog-timeout.mjs';
import {loadPublishedUpcoming} from '../home-next-match.mjs';
import {loadHomeVictory} from '../victory-home.mjs';
import {loadPublicAgenda} from '../agenda.mjs';
import {loadTeamPublicExtras} from '../team-profile-data.mjs';
import {loadPublishedIdentity} from '../club-identity.mjs';
import {loadPublicClubInfo} from '../join-center.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const neverRespondingFetch=(_url,{signal}={})=>new Promise((_,reject)=>{
 if(signal?.aborted)return reject(new Error('timeout'));
 signal?.addEventListener('abort',()=>reject(new Error('timeout')),{once:true});
});
const cases=[
 ['home-next-match.mjs',loadPublishedUpcoming,signal=>
   loadPublishedUpcoming({signal,fetcher:neverRespondingFetch})],
 ['victory-home.mjs',loadHomeVictory,signal=>
   loadHomeVictory({signal,fetcher:neverRespondingFetch})],
 ['agenda.mjs',loadPublicAgenda,signal=>
   loadPublicAgenda(signal,neverRespondingFetch)],
 ['team-profile-data.mjs',loadTeamPublicExtras,signal=>
   loadTeamPublicExtras('a',{signal,fetcher:neverRespondingFetch})],
 ['club-identity.mjs',loadPublishedIdentity,signal=>
   loadPublishedIdentity(signal,neverRespondingFetch)],
 ['join-center.mjs',loadPublicClubInfo,signal=>
   loadPublicClubInfo(signal,neverRespondingFetch)]
];
for(const [file,_load,run] of cases){
 test('public catalogue '+file+' aborts blocked network requests instead of hanging',async()=>{
  const route=new AbortController();
  const deadline=boundedPublicRequest(route.signal,25);
  await assert.rejects(run(deadline.signal),/timeout|annulée/);
  assert.equal(deadline.signal.aborted,true);
  deadline.dispose();
 });
}
test('all remaining public catalogue mounts enforce finite timeout with original route cancellation',()=>{
 const expected=[
  ['home-next-match.mjs','loadPublishedUpcoming({signal:deadline.signal})'],
  ['victory-home.mjs','loadHomeVictory({signal:deadline.signal})'],
  ['agenda.mjs','loadPublicAgenda(deadline.signal)'],
  ['team-profile-data.mjs',"loadTeamPublicExtras(code,{signal:deadline.signal,onlyPeople:view==='players'})"],
  ['club-identity.mjs','loadPublishedIdentity(deadline.signal)'],
  ['join-center.mjs','loadPublicClubInfo(deadline.signal)']
 ];
 for(const [file,call] of expected){
  const code=read(file);
  assert.ok(code.includes("import {boundedPublicRequest} from './public-catalog-timeout.mjs';"),file);
  assert.ok(code.includes(call),'bounded signal passed to '+file);
  assert.match(code,/const deadline=boundedPublicRequest\((?:controller|ctrl|abort)\.signal\)/);
  assert.match(code,/finally\s*\{deadline\.dispose\(\);\}|finally\s*\{\s*deadline\.dispose\(\);/);
  assert.doesNotMatch(code,/service_role|sk_live_|sb_secret_/);
 }
});
test('timeout does not cancel a different route nor misreport a published match as a club validation',()=>{
 const next=read('home-next-match.mjs');
 const profile=read('team-profile-data.mjs');
 assert.match(next,/clubConfirmed:false, \/\/ external listings are not club authorizations/);
 assert.match(next,/if\(!active\(\)\|\|abort\.signal\.aborted\)return/);
 assert.match(next,/Continue to display the sourced season calendar/);
 assert.match(profile,/if\(controller\.signal\.aborted\|\|generation!==id\|\|!root\.isConnected\)return/);
 assert.match(profile,/Aucun membre non validé ne sera affiché/);
 const agenda=read('agenda.mjs');
 assert.match(agenda,/exportBtn\.disabled=true/);
 assert.match(agenda,/Agenda temporairement indisponible/);
 const join=read('join-center.mjs');
 assert.match(join,/Aucun contact, horaire ou recrutement non vérifié ne sera affiché/);
});
