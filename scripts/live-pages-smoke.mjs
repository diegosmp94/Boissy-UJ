import {checkPublicSiteBase,inspectPublicAsset} from './public-live-validator.mjs';
import {summarizePublicSecurityHeaders} from './public-security-headers.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {SITE_MAINTENANCE} from '../site-maintenance-config.mjs';
import {resolve,join} from 'node:path';
/** Read-only smoke of the actually published GitHub Pages site.
 * Explicit/manual run only: publication may lag main and can be unreachable.
 * No authentication, private data, tracking code, external packages or writes.
 */
const base=new URL(process.env.BOISSY_PUBLIC_URL||'https://diegosmp94.github.io/Boissy-UJ/');
if(base.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(base.hostname))
 throw new Error('Public site smoke requires HTTPS (or local test server)');
if(base.username||base.password||base.hash||base.search)
 throw new Error('Public site URL must not contain credentials, query parameters or hashes');
if(!base.pathname.endsWith('/'))base.pathname+='/';
// Reject alternative remote hosts and unintended project paths, even on HTTPS.
checkPublicSiteBase(base);
const timeout=Number(process.env.BOISSY_SMOKE_TIMEOUT_MS||12000);
if(!Number.isFinite(timeout)||timeout<2000||timeout>30000)
 throw new Error('Invalid timeout');
const assets=[
 {name:'Accueil',file:'',type:'html',expected:['id="main"','href="#/confidentialite"','name="robots" content="noindex, nofollow"']},
 {name:'Application',file:'app.js',type:'script',expected:["'/confidentialite':privacy","'/mentions-legales':legal"]},
 {name:'Feuille de style',file:'styles.css',type:'css',expected:['.topbar','.bottom-nav']},
 {name:'Référentiel des équipes',file:'club-teams.mjs',type:'script',expected:["name:'Senior'","discipline:'futsal'"]},
 {name:'Authentification',file:'auth.mjs',type:'script',expected:['signInWithPassword','signUp']},
 {name:'Calendrier et résultats',file:'sport-center.mjs',type:'script',expected:['publicExternalFixtures','club_teams']},
 {name:'Actualités',file:'media-center.mjs',type:'script',expected:['news_posts','mountNews']},
 {name:'Prochain match',file:'home-next-match.mjs',type:'script',expected:['nextUpcomingMatch','mountHomeNextMatch']},
 {name:'Style Premium',file:'premium-front.css',type:'css',expected:['premium-comparison']}
];
assets.push(
 {name:'Mode maintenance publié',file:'site-maintenance-config.mjs',type:'script',expected:['enabled:'+SITE_MAINTENANCE.enabled]},
 {name:'Portail de maintenance',file:'site-entry.mjs',type:'script',expected:['./maintenance.html','./app.js']},
 {name:'Page de maintenance',file:'maintenance.html',type:'html',expected:['Site en maintenance','name="robots" content="noindex, nofollow"']}
);
const expectedCommit=String(process.env.BOISSY_EXPECTED_COMMIT||'');
if(expectedCommit&&!/^[0-9a-f]{40}$/.test(expectedCommit))
 throw new Error('Expected deployed commit must be a complete Git SHA.');
// Presence of a valid release marker is required even for a manual check.
assets.push({
 name:'Version de publication',file:'release.json',type:'json',
 expected:['"source":"main"']
});
assets.push({
 name:'Directives robots',file:'robots.txt',type:'txt',
 expected:['User-agent: *','Disallow: /']
});
let failed=0;
const results=[];
let publicHeaderAudit=null;
for(const asset of assets){
 const url=new URL(asset.file,base);
 try{
  const response=await fetch(url,{method:'GET',redirect:'follow',signal:AbortSignal.timeout(timeout),headers:{'Accept':'text/html,text/javascript,text/css,*/*'}});
  if(!response.ok)throw new Error('HTTP '+response.status);
  if(new URL(response.url).origin!==base.origin)throw new Error('Unexpected cross-site redirect');
  const data=await response.text();
  const inspected=inspectPublicAsset({
   base,file:asset.file,type:asset.type,expected:asset.expected,
   responseUrl:response.url,mime:response.headers.get('content-type'),
   body:data,expectedCommit
  });
  // Only booleans are retained: never collect Set-Cookie or other header values.
  if(asset.file==='')publicHeaderAudit=summarizePublicSecurityHeaders(response.headers);
  // A manual read without BOISSY_EXPECTED_COMMIT proves only a published
  // main-shaped manifest, not equality with the latest main branch.
  if(asset.file==='release.json'&&!inspected.mainMatched)
   console.log('WARN published main-shaped release; exact latest-main equality not checked');
  results.push({check:asset.file||'index.html',passed:true});
  console.log('PASS '+asset.name+' ('+response.status+', '+data.length+' chars)');
 }catch(error){
  failed++;
  results.push({check:asset.file||'index.html',passed:false});
  console.error('FAIL '+asset.name+': '+String(error?.message||error));
 }
}
// Missing headers must be visible in CI logs without failing an otherwise
// healthy GitHub Pages publication or claiming an HTTP header can be set here.
if(publicHeaderAudit?.checked&&!publicHeaderAudit.allFiveHeadersPresent)
 console.warn('WARN public HTTP header hardening incomplete; review sanitized header presence flags in the publication artifact');
// CI evidence contains only public asset names, a Git SHA and pass/fail; it
// never records HTTP response contents, URLs, auth headers or user accounts.
const artifactDir=resolve(process.cwd(),'smoke-artifacts');
await mkdir(artifactDir,{recursive:true});
await writeFile(join(artifactDir,'live-public-report.json'),JSON.stringify({
 scope:'anonymous public HTTP only',
 commitExpected:expectedCommit||null,
 mainRevisionVerified:failed===0&&Boolean(expectedCommit),
 httpSecurityHeaders:publicHeaderAudit,
 publicAssetsPassed:results.filter(item=>item.passed).length,
 publicAssetsChecked:results.length,
 passed:failed===0,
 checks:results,
 personalDataCollected:false,
 accountFlowsCertified:false,
 mobileDevicesCertified:false
},null,2)+'\n');
if(failed){
 console.error(failed+' public checks failed; check Pages publishing status and current deployment.');
 process.exitCode=1;
}else console.log('Public GitHub Pages HTTP smoke passed. This does not certify Safari, RGPD or backend user flows.');
