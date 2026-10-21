import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dateStatus,filterEvents,normalizeEventSearch,publicPrice,premiumPrice} from '../events-center.mjs';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const schema=read('supabase/migrations/202610210005_events_catalog_v1.sql');
const eventsModule=read('events-center.mjs');
const app=read('app.js');
const styles=read('styles.css');

const rows=[
 {title:'Entraînement des jeunes',description:'Vie associative',location_label:'Boissy',category:'club',starts_at:'2026-11-10T16:00:00Z',ends_at:'2026-11-10T18:00:00Z',booking_kind:'free',price_cents:0,premium_price_cents:null},
 {title:'Rencontre Amicale',description:'Seniors C',location_label:'Terrain',category:'sport',starts_at:'2026-10-01T10:00:00Z',ends_at:'2026-10-01T12:00:00Z',booking_kind:'paid',price_cents:1000,premium_price_cents:500},
 {title:'Fête du club',description:'Supporters',location_label:'Salle associative',category:'community',starts_at:'2026-12-20T10:00:00Z',ends_at:'2026-12-20T14:00:00Z',booking_kind:'paid',price_cents:1200,premium_price_cents:0}
];

test('events data model is public-read-only under RLS',()=>{
 assert.match(schema,/alter table public.club_events enable row level security/);
 assert.match(schema,/revoke all on public.club_events from anon, authenticated/);
 assert.match(schema,/grant select on public.club_events to anon, authenticated/);
 assert.match(schema,/published = true and access_kind = 'public'/);
 assert.doesNotMatch(schema,/for (insert|update|delete) to (anon|authenticated)/i);
});
test('database prevents invalid prices and publishes only dated events',()=>{
 for(const phrase of [
   "price_cents between 0 and 1000000",
   "premium_price_cents <= price_cents",
   "not published or (starts_at is not null and ends_at is not null)",
   "booking_kind <> 'paid' or price_cents > 0",
   "booking_kind <> 'free' or (price_cents = 0",
   "priority_starts_at < priority_ends_at"
 ]) assert.ok(schema.includes(phrase),phrase);
});
test('filters events by category, period and accent-neutral search',()=>{
 const now=Date.parse('2026-10-21T08:00:00Z');
 assert.deepEqual(filterEvents(rows,{now,period:'upcoming'}).map(x=>x.title),['Entraînement des jeunes','Fête du club']);
 assert.deepEqual(filterEvents(rows,{now,period:'past'}).map(x=>x.title),['Rencontre Amicale']);
 assert.deepEqual(filterEvents(rows,{now,kind:'sport',period:'all'}).map(x=>x.title),['Rencontre Amicale']);
 assert.deepEqual(filterEvents(rows,{now,query:'entraînement'}).map(x=>x.title),['Entraînement des jeunes']);
 assert.equal(normalizeEventSearch('ÉVÉNEMENTS'),'evenements');
});
test('prices distinguish standard, discounted and free premiums',()=>{
 assert.equal(publicPrice(rows[0]),'Gratuit');
 assert.match(publicPrice(rows[1]),/10,00/);
 assert.match(premiumPrice(rows[1]),/5,00/);
 assert.equal(premiumPrice(rows[2]),'Gratuit pour Premium');
 assert.equal(premiumPrice(rows[0]),null);
 assert.equal(dateStatus(rows[0],Date.parse('2026-11-10T17:00:00Z')),'upcoming');
 assert.equal(dateStatus(rows[0],Date.parse('2026-11-10T20:00:00Z')),'past');
});
test('client reads only public published event records; never processes payments',()=>{
 for(const fragment of ["published:'eq.true'","access_kind:'eq.public'","method:'GET'","node.textContent = String(text)","Réservation en ligne indisponible"]){
   assert.ok(eventsModule.includes(fragment),fragment);
 }
 assert.doesNotMatch(eventsModule,/innerHTML\s*=|\.insert\(|\.update\(|\.upsert\(|method:\s*'POST'|stripe|checkout/i);
});
test('SPA attaches and detaches the event catalogue safely',()=>{
 assert.match(app,/import \{mountEvents,unmountEvents\} from '\.\/events-center\.mjs'/);
 assert.match(app,/id="events-public-catalog"/);
 assert.match(app,/if\(path==='\/evenements'\) void mountEvents\(\); else unmountEvents\(\);/);
 assert.match(eventsModule,/abortRequest\?\.abort\(\)/);
 assert.match(eventsModule,/populate\(root,\[\],false\)/);
 assert.match(styles, /@media \(max-width: 700px\)\s*\{\s*\.event-controls/);
});
