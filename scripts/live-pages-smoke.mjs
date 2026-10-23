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
const timeout=Number(process.env.BOISSY_SMOKE_TIMEOUT_MS||12000);
if(!Number.isFinite(timeout)||timeout<2000||timeout>30000)
 throw new Error('Invalid timeout');
const assets=[
 {name:'Accueil',file:'',expected:['id="main"','href="#/confidentialite"','name="robots" content="noindex, nofollow"']},
 {name:'Application',file:'app.js',expected:["'/confidentialite':privacy","'/mentions-legales':legal"]},
 {name:'Feuille de style',file:'styles.css',expected:['.topbar','.bottom-nav']},
 {name:'Référentiel des équipes',file:'club-teams.mjs',expected:["name:'Senior'","discipline:'futsal'"]},
 {name:'Authentification',file:'auth.mjs',expected:['signInWithPassword','signUp']},
 {name:'Calendrier et résultats',file:'sport-center.mjs',expected:['publicExternalFixtures','club_teams']},
 {name:'Actualités',file:'media-center.mjs',expected:['news_posts','mountNews']},
 {name:'Prochain match',file:'home-next-match.mjs',expected:['nextUpcomingMatch','mountHomeNextMatch']},
 {name:'Style Premium',file:'premium-front.css',expected:['premium-comparison']}
];
const expectedCommit=String(process.env.BOISSY_EXPECTED_COMMIT||'');
if(expectedCommit&&!/^[0-9a-f]{40}$/.test(expectedCommit))
 throw new Error('Expected deployed commit must be a complete Git SHA.');
if(expectedCommit)assets.push({
 name:'Version de publication',file:'release.json',expected:['"source":"main"','"commit":"'+expectedCommit+'"']
});
let failed=0;
for(const asset of assets){
 const url=new URL(asset.file,base);
 try{
  const response=await fetch(url,{method:'GET',redirect:'follow',signal:AbortSignal.timeout(timeout),headers:{'Accept':'text/html,text/javascript,text/css,*/*'}});
  if(!response.ok)throw new Error('HTTP '+response.status);
  if(new URL(response.url).origin!==base.origin)throw new Error('Unexpected cross-site redirect');
  const data=await response.text();
  const missing=asset.expected.filter(x=>!data.includes(x));
  if(missing.length)throw new Error('Missing expected markers: '+missing.join(', '));
  console.log('PASS '+asset.name+' ('+response.status+', '+data.length+' chars)');
 }catch(error){
  failed++;
  console.error('FAIL '+asset.name+': '+String(error?.message||error));
 }
}
if(failed){
 console.error(failed+' public checks failed; check Pages publishing status and current deployment.');
 process.exitCode=1;
}else console.log('Public GitHub Pages HTTP smoke passed. This does not certify Safari, RGPD or backend user flows.');
