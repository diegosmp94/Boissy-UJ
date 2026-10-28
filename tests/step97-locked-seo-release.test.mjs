import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 BOISSY_PUBLIC_URL,PUBLIC_RELEASE_LOCKS,PUBLIC_RELEASE_MODE
} from '../public-release-locks.mjs';
import {LOCKED_ROBOTS_TEXT,verifyLockedPublicSeo}
 from '../scripts/seo-release-guard.mjs';
import {FFF_FEED_STATUS} from '../fff-provider.mjs';
import {FREE_TICKET_STAGING} from '../free-ticket-staging-config.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('index.html');
const robots=read('robots.txt');
const builder=read('scripts/build-preview.mjs');
const preview=read('scripts/audit-preview.mjs');
const publisher=read('scripts/write-public-release.mjs');

test('step97: public sharing metadata is precise but indexing remains OFF',()=>{
 assert.equal(PUBLIC_RELEASE_MODE,'technical-preview-noindex');
 assert.equal(BOISSY_PUBLIC_URL,'https://diegosmp94.github.io/Boissy-UJ/');
 assert.equal(robots,LOCKED_ROBOTS_TEXT);
 const actual=verifyLockedPublicSeo({html,robots});
 assert.deepEqual(actual,{
  status:'locked-preview',indexingAllowed:false,
  canonical:BOISSY_PUBLIC_URL,
  descriptionLength:html.match(/name="description" content="([^"]+)"/)[1].length,
  externalServicesChecked:false,paymentPermissionConfirmed:false,
  fffLicenseConfirmed:false,serverFeatureGatesVerified:false
 });
 for(const token of [
  'property="og:site_name" content="Boissy-UJ"',
  'property="og:locale" content="fr_FR"',
  'property="og:url" content="'+BOISSY_PUBLIC_URL+'"',
  'property="og:image" content="'+BOISSY_PUBLIC_URL+'assets/ecusson-boissy-uj.webp"',
  'name="twitter:card" content="summary"',
  'name="twitter:description"',
  'rel="canonical" href="'+BOISSY_PUBLIC_URL+'"',
  'name="robots" content="noindex, nofollow"',
  'name="referrer" content="no-referrer"',
  'http-equiv="Content-Security-Policy"'
 ])assert.ok(html.includes(token),token);
});
test('step97: all six client release modes remain disabled in public Pages',()=>{
 assert.deepEqual(PUBLIC_RELEASE_LOCKS,{
  indexing:false,livePayments:false,testPaymentsOnPublic:false,
  freeTicketingOnPublic:false,premiumVotingOnPublic:false,
  fffAutomaticSync:false
 });
 assert.equal(FFF_FEED_STATUS,'access-not-granted');
 assert.equal(FREE_TICKET_STAGING.enabled,false);
 assert.throws(()=>verifyLockedPublicSeo({
  html,robots,locks:{...PUBLIC_RELEASE_LOCKS,indexing:true}
 }),/Sensitive production/);
 for(const name of Object.keys(PUBLIC_RELEASE_LOCKS)){
  assert.throws(()=>verifyLockedPublicSeo({
   html,robots,locks:{...PUBLIC_RELEASE_LOCKS,[name]:true}
  }),/Sensitive production/,name);
 }
 for(const config of [{enabled:true,projectRef:'separateproject12345'},
  {enabled:1}])
 assert.throws(()=>verifyLockedPublicSeo({
  html,robots,ticketConfig:config
 }),/FFF or ticketing/);
 assert.throws(()=>verifyLockedPublicSeo({
  html,robots,feedStatus:'connected'
 }),/FFF or ticketing/);
});
test('step97: accidental indexing, unsafe robots or repeated canonical fail the build',()=>{
 const denied=[
  {html,robots:'User-agent: *\nAllow: /\n'},
  {html:html.replace('noindex, nofollow','index, follow'),robots},
  {html:html.replace('<link rel="canonical"', '<link rel="alternate"'),robots},
  {html:html.replace('property="og:locale"','property="og:country"'),robots},
  {html:html.replace('property="og:image"','property="og:photo"'),robots},
  {html:html.replace('property="og:url"','property="og:unsafe"'),robots},
  {html:html.replace('name="description"', 'name="other"'),robots},
  {html:html.replace('<title>Boissy-UJ — Club officiel</title>',
   '<title>X</title>'),robots},
  {html:html.replace('</head>',
   '<meta name="googlebot" content="index, follow" /></head>'),robots},
  {html:html.replace('</head>',
   '<script type="application/ld+json">{}</script></head>'),robots},
  {html:html.replace('</head>',
   '<link rel="alternate" href="https://irrelevant.example/" /></head>'),robots},
  {html:html.replace('</head>',
   '<link rel="canonical" href="'+BOISSY_PUBLIC_URL+'" /></head>'),robots}
 ];
 for(const candidate of denied)
  assert.throws(()=>verifyLockedPublicSeo(candidate),undefined,
   candidate.html===html?'robots change':'metadata modified');
});
test('step97: actual build, audit, and exact public release manifest all share the same gate',()=>{
 assert.match(builder,/verifyLockedPublicSeo\(/);
 assert.match(builder,/readFile\(join\(project,'robots\.txt'\),'utf8'\)/);
 assert.match(builder,/writeFile\(join\(dist,'robots\.txt'\),LOCKED_ROBOTS_TEXT\)/);
 assert.match(preview,/verifyLockedPublicSeo\(/);
 assert.match(preview,/SEO and sensitive public release locks failed/);
 assert.match(publisher,/verifyLockedPublicSeo\(\{html,robots\}\)/);
 assert.match(publisher,/publicReleaseRecord\(process\.env\.BOISSY_RELEASE_SHA\)/);
 assert.doesNotMatch(builder+publisher,/sk_live_|rk_live_|sb_secret_|SUPABASE_SERVICE_ROLE_KEY/);
});
test('step97: indexing remains a deliberate separately homologated switch',()=>{
 assert.match(read('scripts/production-readiness-report.mjs'),
  /fullProductCertified:false/);
 assert.match(read('free-ticket-staging-config.mjs'),/enabled:false/);
 assert.match(read('fff-provider.mjs'),/access-not-granted/);
 assert.match(read('docs/ETAPE_37_CALENDRIER_FFF.md'),/API FFF NON CONNECTÉE/);
 assert.doesNotMatch(read('public-release-locks.mjs'),
  /enabled:true|indexing:true|livePayments:true/);
});
