import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 BOISSY_QR_LENGTH,prepareFreeTicketCode,createServerOnlyFreeTicketCode,
 parseFreeTicketCode,digestFreeTicketSecret,equalsRecordedTicketDigest,
 freeEventTicketEligibility,freeTicketScanLabel
} from '../supabase/functions/_shared/free-ticket-qr-protocol.mjs';
import {
 freeTicketReadiness,readFreeTicketingReadiness
} from '../admin-ticketing-readiness.mjs';
import {ADMIN_MODULES} from '../admin-center.mjs';
import {availableAdminModules} from '../admin-navigation.mjs';
import {fetchPublishedAwards} from '../awards-center.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const eventId='11111111-1111-4111-8111-111111111111',secret='a'.repeat(64);
const now=Date.parse('2026-10-24T12:00:00Z');
const event={
 id:eventId,title:'Fête du club',
 booking_kind:'free',access_kind:'public',published:true,
 booking_status:'open',capacity:35,
 starts_at:'2026-11-20T10:00:00Z',ends_at:'2026-11-20T13:00:00Z'
};

test('step61: opaque QR code is 256-bit, non-personal and unambiguously framed',()=>{
 const encoded=prepareFreeTicketCode(eventId,secret);
 assert.equal(encoded,'BUJ1:'+eventId+':'+secret);
 assert.equal(encoded.length,BOISSY_QR_LENGTH);
 assert.deepEqual(parseFreeTicketCode(encoded),{eventId,secret});
 assert.equal(Object.isFrozen(parseFreeTicketCode(encoded)),true);
 const a=createServerOnlyFreeTicketCode(eventId);
 const b=createServerOnlyFreeTicketCode(eventId);
 assert.equal(a.length,BOISSY_QR_LENGTH);
 assert.equal(parseFreeTicketCode(a).eventId,eventId);
 assert.notEqual(a,b);
 assert.doesNotMatch(a,/email|@|https|name|profil/i);
});
test('step61: invalid, altered and foreign QR payloads fail closed',()=>{
 for(const raw of [
  null,undefined,{},'',secret,'BUJ1:'+eventId+':'+secret.slice(1),
  'BUJ1:'+eventId+':'+secret+'x',
  'BUJ1:'+eventId+':'+secret.toUpperCase(),
  'BUJ1:'+eventId+':'+secret+'\n',
  'BUJ2:'+eventId+':'+secret,
  'BUJ1:../../etc/passwd:'+secret,
  'BUJ1:'+eventId+':'+secret+':extra',
  'https://attacker.example/?secret='+secret
 ])assert.equal(parseFreeTicketCode(raw),null,String(raw));
 assert.throws(()=>prepareFreeTicketCode('invalid',secret));
 assert.throws(()=>prepareFreeTicketCode(eventId,'b'.repeat(63)));
 assert.throws(()=>createServerOnlyFreeTicketCode('invalid'));
});
test('step61: digest stored server side matches exactly, tampering is rejected',()=>{
 const digest=digestFreeTicketSecret(secret);
 assert.match(digest,/^[a-f0-9]{64}$/);
 assert.notEqual(digest,secret);
 assert.equal(equalsRecordedTicketDigest(digest,digest),true);
 assert.equal(equalsRecordedTicketDigest(digest,digestFreeTicketSecret('b'.repeat(64))),false);
 assert.equal(equalsRecordedTicketDigest(digest,'unknown'),false);
 assert.throws(()=>digestFreeTicketSecret(secret+'0'));
 for(const status of ['checked_in','cancelled','expired','not_found'])
  assert.match(freeTicketScanLabel(status),/refusé/);
 assert.match(freeTicketScanLabel('issued'),/Contrôle serveur obligatoire/);
});
test('step61: QR parser cannot create entries or replace atomic server-side check-in',()=>{
 const code=read('supabase/functions/_shared/free-ticket-qr-protocol.mjs');
 assert.match(code,/randomBytes\(32\)/);
 assert.match(code,/timingSafeEqual/);
 assert.doesNotMatch(code,/service_role|apikey|fetch\(|execute_sql|api\.from\(|supabase\.from\(|\.insert\(|\.delete\(|\.rpc\(/);
 assert.match(code,/createHash\('sha256'\)\.update\(Buffer\.from\(secret,'hex'\)\)/);
 assert.doesNotMatch(read('events-center.mjs'),/createServerOnlyFreeTicketCode|prepareFreeTicketCode/);
 const eligible=freeEventTicketEligibility(event,now);
 assert.deepEqual(eligible,{eligible:true,reason:'server_authorization_still_required'});
 for(const changed of [
  {...event,capacity:null},
  {...event,published:false},
  {...event,booking_kind:'paid'},
  {...event,access_kind:'premium'},
  {...event,booking_status:'closed'},
  {...event,starts_at:'2026-10-20T10:00:00Z'}
 ])assert.equal(freeEventTicketEligibility(changed,now).eligible,false);
});
test('step61: protected admin ticketing readiness computes real metadata, never creates a booking',async()=>{
 const get=async()=>({data:[event,{...event,id:'bbbb',title:'Non publié',published:false},
  {...event,id:'cccc',title:'Sans jauge',capacity:null},
  {...event,id:'dddd',title:'Complet',booking_status:'full'}],error:null});
 const api={rpc:async name=>{
  assert.equal(name,'admin_list_free_events');return get();
 }};
 const report=await readFreeTicketingReadiness(api,now);
 assert.equal(report.available,true);
 assert.equal(report.total,4);
 assert.equal(report.metadataReady,1);
 assert.equal(report.liveIssuance,false);
 assert.equal(report.liveQrScanning,false);
 assert.match(report.events[2].label,/Jauge/);
 assert.equal(freeTicketReadiness(event,now).ready,true);
 assert.equal(freeTicketReadiness({...event,booking_status:'closed'},now).ready,false);
 assert.equal((await readFreeTicketingReadiness({rpc:async()=>({error:{code:'42501'}})})).available,false);
 assert.equal((await readFreeTicketingReadiness({rpc:async()=>{throw Error('offline');}})).available,false);
});
test('step61: ticketing module is hidden when protected events RPC does not respond',()=>{
 assert.ok(ADMIN_MODULES.some(x=>x.id==='ticketing'));
 assert.equal(availableAdminModules(ADMIN_MODULES).some(x=>x.id==='ticketing'),false);
 assert.equal(availableAdminModules(ADMIN_MODULES,{eventsReady:true}).some(x=>x.id==='ticketing'),true);
 const code=read('admin-center.mjs'),ui=read('admin-ticketing-readiness.mjs');
 assert.match(code,/case 'ticketing':void mountAdminTicketingReadiness\(view,api,verified\.userId/);
 assert.match(code,/const check=await adminSessionStatus\(api,verified\.userId\)/);
 assert.match(ui,/adminSessionStatus\(api,userId\)/);
 assert.match(ui,/if\(verified\.status!=='admin'\)/);
 assert.doesNotMatch(ui,/admin_save|\.insert\(|\.update\(|\.delete\(|invoice|stripe|checkout/i);
});
test('step61: published Awards remain when optional nominations or results API fails',async()=>{
 const award={id:eventId,title:'Prix collectif',team_code:'a',published:true,
  voting_status:'finished',results_published:true};
 const successful=async url=>{
  if(url.includes('club_awards?'))return {ok:true,json:async()=>[award]};
  if(url.includes('club_award_nominees?'))return {ok:true,json:async()=>[]};
  if(url.includes('club_award_results?'))return {ok:true,json:async()=>[]};
  throw Error('Bad endpoint');
 };
 const all=await fetchPublishedAwards(undefined,successful);
 assert.deepEqual(all.awards,[award]);
 assert.equal(all.nomineesAvailable,true);
 assert.equal(all.resultsAvailable,true);
 const broken=async url=>{
  if(url.includes('club_awards?'))return {ok:true,json:async()=>[award]};
  if(url.includes('club_award_nominees?'))throw Error('No nominees');
  if(url.includes('club_award_results?'))return {ok:false,status:503};
  throw Error('Unexpected endpoint');
 };
 const partial=await fetchPublishedAwards(undefined,broken);
 assert.deepEqual(partial.awards,[award]);
 assert.deepEqual(partial.nominees,[]);
 assert.deepEqual(partial.results,[]);
 assert.equal(partial.nomineesAvailable,false);
 assert.equal(partial.resultsAvailable,false);
 await assert.rejects(()=>fetchPublishedAwards(undefined,async()=>({ok:false,status:401})),
  /Catalogue Awards indisponible/);
});
test('step61: no unpublished winner is manufactured by a failed Awards backend',()=>{
 const ui=read('awards-center.mjs');
 assert.match(ui,/Promise\.allSettled\(/);
 assert.match(ui,/Les résultats publiés ne peuvent pas être vérifiés/);
 assert.match(ui,/Les nominations ne peuvent pas être chargées/);
 assert.match(ui,/data\.nomineesAvailable===false\|\|data\.resultsAvailable===false/);
 assert.doesNotMatch(ui,/insert\(|\.rpc\(|checkout|stripe/i);
});
