/** Live browser smoke on the public build, with Chrome DevTools Protocol and no npm deps.
 * Chrome runs against a loopback HTTP server; no credentials or test users are created.
 */
import {createServer} from 'node:http';
import {assessAnonymousPublicOrigins} from './browser-origin-policy.mjs';
import {isReadyPublicRouteSnapshot} from './browser-smoke-readiness.mjs';
import {readFile,writeFile,mkdir,mkdtemp,rm,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {join,resolve,extname,dirname} from 'node:path';
import {tmpdir} from 'node:os';

const root=resolve(process.cwd(),'dist');
const artifactDir=resolve(process.cwd(),'smoke-artifacts');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png',
 '.ico':'image/x-icon','.json':'application/json'};
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
const exists=async path=>{try{await access(path);return true;}catch{return false;}};
function server(){
 return createServer(async(request,response)=>{
  const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(file!==root&&!file.startsWith(root+'/')){
   response.writeHead(403);response.end();return;
  }
  try{
   const body=await readFile(file);
   response.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
   response.end(body);
  }catch{response.writeHead(404);response.end('Not found');}
 });
}
function resolveBrowser(){
 return [process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser']
  .filter(Boolean);
}
async function launchBrowserOnce(){
 const candidates=resolveBrowser();
 const binary=await (async()=>{
  for(const name of candidates)if(await exists(name))return name;
  throw new Error('Chrome or Chromium not installed: install browser for smoke test');
 })();
 const dir=await mkdtemp(join(tmpdir(),'boissy-smoke-'));
 const stderr=[];
 const browser=spawn(binary,[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--disable-background-networking','--no-first-run','--no-default-browser-check',
  '--remote-debugging-port=0','--user-data-dir='+dir,'about:blank'
 ],{stdio:['ignore','ignore','pipe']});
 browser.stderr.on('data',buf=>{if(stderr.length<100)stderr.push(buf.toString().slice(0,500));});
 let port;
 for(let i=0;i<90;i++){
  if(browser.exitCode!==null)break;
  try{
   const data=(await readFile(join(dir,'DevToolsActivePort'),'utf8')).trim().split('\n');
   if(Number(data[0])>0){port=Number(data[0]);break;}
  }catch{}
  await sleep(150);
 }
 if(!port){
  browser.kill('SIGKILL');await rm(dir,{recursive:true,force:true,maxRetries:6,retryDelay:200});
  throw new Error('Chrome DevTools unavailable: '+stderr.slice(-4).join(' ').slice(0,500));
 }
 const targets=await (await fetch('http://127.0.0.1:'+port+'/json')).json();
 const page=targets.find(x=>x.type==='page');
 if(!page?.webSocketDebuggerUrl)throw new Error('Chrome page target unavailable');
 const ws=new WebSocket(page.webSocketDebuggerUrl);
 const pending=new Map();let seq=0;
 // Rapport de navigation réseau sans URL complète, cookies, identifiants ni corps des requêtes.
 const networkOrigins=new Set();
 await new Promise((resolve,reject)=>{
  ws.addEventListener('open',resolve,{once:true});
  ws.addEventListener('error',reject,{once:true});
 });
 ws.addEventListener('message',event=>{
  const message=JSON.parse(event.data);
  if(message.method==='Network.requestWillBeSent'){
   try{const origin=new URL(message.params.request.url).origin;
    if(origin.startsWith('http:')||origin.startsWith('https:'))networkOrigins.add(origin);
   }catch{}
  }
  if(!message.id)return;
  const entry=pending.get(message.id);
  if(!entry)return;
  pending.delete(message.id);
  if(message.error)entry.reject(new Error(message.error.message));
  else entry.resolve(message.result);
 });
 const send=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++seq;pending.set(id,{resolve,reject});
  ws.send(JSON.stringify({id,method,params}));
 });
 const shutdown=async()=>{
  ws.close();browser.kill('SIGKILL');await rm(dir,{recursive:true,force:true,maxRetries:6,retryDelay:200});
 };
 return {send,shutdown,networkOrigins};
}
/** Retry only the ephemeral browser launch. Each attempt has a fresh profile,
 * and the failed DevTools startup cleans up its Chrome process and temp folder.
 * A repeat failure is reported as a real CI failure, never marked as passed. */
async function startBrowser(){
 let lastError;
 for(let attempt=1;attempt<=2;attempt++){
  try{return await launchBrowserOnce();}
  catch(error){
   lastError=error;
   if(String(error?.message||'').includes('not installed'))throw error;
   if(attempt===2)break;
   console.warn('Chromium startup unavailable (attempt 1/2); retrying with a clean profile.');
   await sleep(500);
  }
 }
 throw lastError;
}
async function evaluate(send,expression){
 const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(result.exceptionDetails)throw new Error('Browser JS exception: '+result.exceptionDetails.text);
 return result.result?.value;
}
async function ready(send,match){
 // A navigated hash and a nonempty <main> in one CDP read can be a transient
 // frame while app.js is replacing content. Require three successive valid
 // snapshots of the *same* #main as the later assertions.
 // The 20 s budget also covers the 12 s public/auth network deadline.
 let consecutive=0;
 for(let i=0;i<160;i++){
  try{
   const value=await evaluate(send,`(()=>{
    const main=document.querySelector('#main');
    return {path:location.hash,dom:document.readyState,
      mainCount:document.querySelectorAll('#main').length,
      mainChars:main?.textContent?.trim().length||0};
   })()`);
   consecutive=isReadyPublicRouteSnapshot(value,match)?consecutive+1:0;
   if(consecutive>=3)return;
  }catch{consecutive=0;}
  await sleep(125);
 }
 throw new Error('Timed out waiting for stable public route content '+match);
}
await mkdir(artifactDir,{recursive:true});
const app=server();
await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
const port=app.address().port;
let chrome;
const scenarios=[
 {name:'mobile-home',hash:'#/',width:320,height:760},
 {name:'mobile-teams',hash:'#/equipes',width:390,height:844},
 {name:'mobile-matches',hash:'#/matchs',width:390,height:844},
 {name:'mobile-admin-guest',hash:'#/control-center',width:390,height:844},
 {name:'mobile-privacy',hash:'#/confidentialite',width:390,height:844},
 {name:'mobile-account',hash:'#/mon-espace',width:390,height:844},
 {name:'tablet-legal',hash:'#/mentions-legales',width:768,height:980},
 {name:'tablet-join',hash:'#/rejoindre',width:768,height:980},
 {name:'mobile-premium',hash:'#/communaute',width:320,height:760},
 {name:'tablet-premium',hash:'#/communaute',width:768,height:980},
 {name:'mobile-awards',hash:'#/awards',width:390,height:844},
 {name:'mobile-events',hash:'#/evenements',width:390,height:844},
 {name:'mobile-support',hash:'#/soutenir',width:390,height:844},
 {name:'desktop-events',hash:'#/evenements',width:1366,height:850},
 {name:'desktop-news',hash:'#/actualites',width:1366,height:850},
 {name:'desktop-futsal',hash:'#/equipes/futsal/boissy-uj-futsal',width:1366,height:850}
];
const reports=[];
try{
 chrome=await startBrowser();
 await chrome.send('Page.enable');
 await chrome.send('Runtime.enable');
 await chrome.send('Network.enable');
 for(const scenario of scenarios){
  await chrome.send('Emulation.setDeviceMetricsOverride',{
   width:scenario.width,height:scenario.height,deviceScaleFactor:1,mobile:scenario.width<768
  });
  await chrome.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/'+scenario.hash});
  await ready(chrome.send,scenario.hash);
  const result=await evaluate(chrome.send,`(()=>{
   const expected=${JSON.stringify(scenario.hash)};
   const width=${scenario.width};
   const errors=[];
   if(location.hash!==expected)errors.push('Incorrect route');
   const availableWidth=document.documentElement.clientWidth;
   // Desktop Chromium may reserve ~15px of the viewport for the native scrollbar.
   if(availableWidth>width||width-availableWidth>20)errors.push('Incorrect viewport');
   if(document.documentElement.scrollWidth>availableWidth+2)errors.push('Horizontal page overflow');
   const main=document.querySelector('#main');
   if(!main||!main.textContent.trim())errors.push('Missing main content');
   if(document.documentElement.lang!=='fr')errors.push('Missing document language');
   const csp=document.querySelector('meta[http-equiv="Content-Security-Policy"]');
   if(!csp||!csp.content.includes("object-src 'none'")||
      !csp.content.includes("script-src 'self' https://cdn.jsdelivr.net"))
     errors.push('Static browser security policy missing');
   if(document.querySelector('meta[name="referrer"]')?.content!=='no-referrer')
     errors.push('Personal navigation URL could leak via Referer');
   if(document.querySelector('link[href*="fonts.googleapis.com"],link[href*="fonts.gstatic.com"]'))
     errors.push('Passive third-party font request is not allowed');
   const skipLink=document.querySelector('a.skip-link[href="#main"]');
   if(!skipLink)errors.push('Skip navigation link absent');
   if(document.querySelectorAll('#main').length!==1)errors.push('Main landmark duplicated');
   const emptyLabels=[...document.querySelectorAll('header a,header button,.global-legal-footer a')]
     .filter(el=>el.getClientRects().length>0)
     .filter(el=>!((el.getAttribute('aria-label')||el.textContent||'').trim()));
   if(emptyLabels.length)errors.push('Unlabelled header or legal control');
   if(!document.querySelector('a[href="#/confidentialite"]')||
      !document.querySelector('a[href="#/mentions-legales"]'))errors.push('Legal links missing');
   if(width<768){
    const tiny=[...document.querySelectorAll('#menu-toggle,.bottom-nav a')]
     .filter(node=>node.getClientRects().length>0)
     .filter(node=>node.getBoundingClientRect().height<44||
       node.getBoundingClientRect().width<44);
    if(tiny.length)errors.push('Small touch target in primary mobile navigation');
   }
   if(expected==='#/'){
    if(document.querySelectorAll('.chapter').length!==8)errors.push('Expected 8 cinematic chapters');
    // The mobile menu and account entry must be comfortably tappable on a 320px device.
    if(width<768){
     for(const selector of ['#menu-toggle','.header-account']){
      const element=document.querySelector(selector);
      if(element&&element.getClientRects().length){
       const rect=element.getBoundingClientRect();
       if(rect.width<44||rect.height<44)errors.push('Insufficient mobile target size: '+selector);
      }
     }
    }
    if(width<768){
     const menu=document.querySelector('#mobile-menu'),toggle=document.querySelector('#menu-toggle');
     if(!menu||!toggle)errors.push('Mobile navigation elements missing');
     else{
      toggle.click();
      if(menu.hidden||toggle.getAttribute('aria-expanded')!=='true')errors.push('Mobile menu not opening');
      document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
      if(!menu.hidden||toggle.getAttribute('aria-expanded')!=='false')errors.push('Mobile menu not closing');
      if(document.activeElement!==toggle)errors.push('Focus not restored after Escape');
     }
    }
   }
   if(expected==='#/confidentialite'){
    if(!main.textContent.includes('Responsable et finalités'))errors.push('Privacy page incomplete');
    // Test réel du lien d'évitement : un href #main ne doit jamais casser la route #/...
    if(skipLink){skipLink.focus();skipLink.click();
     if(location.hash!==expected)errors.push('Skip link replaced current SPA route');
     if(document.activeElement!==main)errors.push('Skip link did not focus main');
    }
   }
   if(expected==='#/control-center'){
    if(!main.querySelector('#real-admin-root'))errors.push('Protected administration guard absent');
    if(main.querySelector('.admin-module-tab'))errors.push('Guest obtained administrator navigation');
   }
   if(expected==='#/mon-espace'){
    if(!main.querySelector('[data-auth-root]'))errors.push('Account authentication mount absent');
    if(!main.textContent.includes('Protection des données'))errors.push('Privacy notice absent from account');
    const unlabeled=[...main.querySelectorAll('input,textarea,select')]
      .filter(node=>node.getClientRects().length>0)
      .filter(node=>!node.labels?.length&&!node.getAttribute('aria-label')&&
       !node.getAttribute('aria-labelledby'));
    if(unlabeled.length)errors.push('Account form contains unlabeled inputs');
   }
   if(expected==='#/communaute'){
    const root=main.querySelector('#premium-plan-selector');
    const monthly=root?.querySelector('[data-period="monthly"]');
    const annual=root?.querySelector('[data-period="annual"]');
    const price=root?.querySelector('.premium-price-row strong');
    if(!root||!monthly||!annual||!price)errors.push('Premium comparison missing');
    else{
      if(price.textContent!=='10 €'||monthly.getAttribute('aria-pressed')!=='true')
        errors.push('Initial monthly plan incorrect');
      annual.click();
      if(price.textContent!=='100 €'||annual.getAttribute('aria-pressed')!=='true'||
         monthly.getAttribute('aria-pressed')!=='false')
        errors.push('Annual period switch broken');
      monthly.click();
      if(price.textContent!=='10 €'||monthly.getAttribute('aria-pressed')!=='true')
        errors.push('Return to monthly plan broken');
      if(!main.textContent.includes('Souscription indisponible'))
        errors.push('Premium availability notice missing');
    }
    if(main.querySelector('a[href*="checkout"],a[href*="stripe"]'))
      errors.push('Payment link unexpectedly active');
   }
   if(expected==='#/awards'){
    if(!main.querySelector('#awards-public-catalog'))
      errors.push('Awards published catalogue mount absent');
    if(!main.textContent.includes('Aucun vote actif'))
      errors.push('Awards vote safety notice missing');
   }
   if(expected==='#/evenements'){
    if(!main.querySelector('#events-public-catalog'))
      errors.push('Events catalogue mount absent');
    if(!main.textContent.includes('Billetterie non activée'))
      errors.push('Ticketing availability notice missing');
    if(main.querySelector('a[href*="checkout"],button[data-buy-ticket]'))
      errors.push('Unverified ticket purchase element');
   }
   if(expected==='#/soutenir'){
    if(!main.textContent.includes('Aucun paiement actif'))
      errors.push('Donation availability notice missing');
    if(!main.querySelector('.support-commitments'))
      errors.push('Donation transparency roadmap absent');
   }
   if(expected==='#/mentions-legales'&&!main.textContent.includes('Mentions légales provisoires'))
    errors.push('Legal page incomplete');
   if(expected.includes('/futsal/')&&(!main.textContent.includes('Senior')||
      !main.textContent.includes('Départemental 2')))errors.push('Futsal team identity broken');
   return {route:location.hash,title:document.title,width:document.documentElement.clientWidth,
    fullWidth:document.documentElement.scrollWidth,errors};
  })()`);
  if(scenario.hash==='#/'){
   await chrome.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
   const reducedMotion=await evaluate(chrome.send,`(()=>{
    const rule=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el=document.querySelector('.chapter');
    const style=el?getComputedStyle(el):null;
    return {active:rule,animation:style?.animationDuration,transition:style?.transitionDuration};
   })()`);
   if(!reducedMotion.active)result.errors.push('Reduced-motion media setting ignored');
   const durations=String(reducedMotion.animation||'0s').split(',').concat(String(reducedMotion.transition||'0s').split(','));
   if(durations.some(d=>parseFloat(d)>0.01))result.errors.push('Motion durations not reduced');
   await chrome.send('Emulation.setEmulatedMedia',{features:[]});
   result.reducedMotion=reducedMotion;
  }
  reports.push({...scenario,...result});
  const shot=await chrome.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(join(artifactDir,scenario.name+'.png'),Buffer.from(shot.data,'base64'));
  if(result.errors.length)throw new Error(scenario.name+': '+result.errors.join(', '));
  console.log('BROWSER PASS '+scenario.name+': '+result.route+' '+result.width+'px');
 }

 // Critical genuine SPA flow: follow links without a full reload, then verify
 // focus and the newly rendered view. No accounts or production writes.
 await chrome.send('Emulation.setDeviceMetricsOverride',{
  width:390,height:844,deviceScaleFactor:1,mobile:true
 });
 await chrome.send('Page.navigate',{url:'http://127.0.0.1:'+port+'/#/mon-espace'});
 await ready(chrome.send,'#/mon-espace');
 const flow=[
  {selector:'.trust-auth-notice a[href="#/confidentialite"]',
   route:'#/confidentialite',marker:'Responsable et finalités'},
  {selector:'.global-legal-footer a[href="#/mentions-legales"]',
   route:'#/mentions-legales',marker:'Mentions légales provisoires'},
  {selector:'.bottom-nav a[href="#/matchs"]',
   route:'#/matchs',marker:'Calendriers et résultats publiés'}
 ];
 for(const step of flow){
  const clicked=await evaluate(chrome.send,
   '(()=>{const link=document.querySelector('+JSON.stringify(step.selector)+');'+
   'if(!link||!link.getClientRects().length)return false;link.click();return true;})()');
  if(!clicked)throw Error('Critical SPA link not reachable: '+step.selector);
  let passed=false;
  for(let attempt=0;attempt<60;attempt++){
   const state=await evaluate(chrome.send,
    '(()=>{const main=document.querySelector("#main");return {'+
    'route:location.hash,body:main?.textContent||"",focused:document.activeElement===main,'+
    'overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+2};})()');
   if(state.route===step.route&&state.body.includes(step.marker)&&state.focused&&!state.overflow){
    passed=true;break;
   }
   await sleep(100);
  }
  if(!passed)throw Error('Critical mobile SPA navigation/focus failed on '+step.route);
 }
 console.log('BROWSER PASS critical mobile SPA navigation, focus and no horizontal overflow');
 await writeFile(join(artifactDir,'browser-smoke.json'),JSON.stringify(reports,null,2));
 const origins=[...chrome.networkOrigins].filter(origin=>!origin.startsWith('http://127.0.0.1:')).sort();
 const originAudit=assessAnonymousPublicOrigins(origins);
 await writeFile(join(artifactDir,'browser-network-origins.json'),JSON.stringify({
  scope:'Anonymous local preview only; no user account tested; only origin names recorded',
  externalOrigins:origins,
  passed:originAudit.passed,
  unreviewedOrigins:originAudit.unreviewedOrigins
 },null,2));
 if(!originAudit.passed)throw new Error(
  'Unexpected third-party browser origins. Review data protection before publishing: '+
  originAudit.unreviewedOrigins.join(', '));
 console.log(scenarios.length+' public routes verified in Chromium; approved anonymous origins inventoried without cookies or identities.');
}finally{
 if(chrome)await chrome.shutdown();
 await new Promise(resolve=>app.close(resolve));
}
