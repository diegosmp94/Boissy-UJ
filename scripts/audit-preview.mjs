/** Static export verification for CI, no external dependencies or network calls. */
import {readFile,readdir,access} from 'node:fs/promises';
import {join,resolve,dirname,extname} from 'node:path';
const root=resolve(process.cwd(),'dist');
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
const fail=[];
for(const file of ['index.html','app.js','auth.mjs','admin-center.mjs','styles.css','member-sports.css','assets/ecusson-boissy-uj.webp','.nojekyll']){
 if(!await exists(join(root,file)))fail.push('Missing public resource '+file);
}
const entries=await readdir(root);
for(const forbidden of ['docs','tests','scripts','supabase','.github','.env','package.json']){
 if(await exists(join(root,forbidden)))fail.push('Internal resource leaked: '+forbidden);
}
let checked=0;
const files=entries.filter(file=>['.mjs','.js'].includes(extname(file)));
for(const file of files){
 const source=await readFile(join(root,file),'utf8');
 const imports=[...source.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g)];
 for(const m of imports){
  const dependency=m[1].split('?')[0].split('#')[0];
  if(!dependency.startsWith('./')&&!dependency.startsWith('../'))continue;
  const target=resolve(dirname(join(root,file)),dependency);
  if(!target.startsWith(root+'/'))fail.push('Import escapes dist: '+file+' -> '+dependency);
  else if(!await exists(target))fail.push('Unresolved import: '+file+' -> '+dependency);
  checked++;
 }
 if(/(?:sk_live_|sb_secret_|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY)/.test(source))
  fail.push('Private credential marker in '+file);
}
const html=await readFile(join(root,'index.html'),'utf8');
for(const m of html.matchAll(/(?:src|href)=["']\.\/([^"'?#]+)[^"']*["']/g)){
 const file=decodeURIComponent(m[1]);
 if(!await exists(resolve(root,file)))fail.push('Missing HTML asset: '+file);
}
// Real Pages build must load one local stylesheet in original cascade order.
const cssLinks=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/gi)];
if(cssLinks.length!==1||!cssLinks[0][0].includes('href="./site-bundle.css"'))
 fail.push('Pages build must load exactly one local CSS bundle');
else{
 const combined=await readFile(join(root,'site-bundle.css'),'utf8');
 const originals=[...combined.matchAll(/\/\* SOURCE ([a-z0-9-]+\.css) \*\//g)]
  .map(x=>x[1]);
 if(originals.length<15||new Set(originals).size!==originals.length||
  originals[0]!=='styles.css')
  fail.push('Missing CSS source ordering and coverage in bundle');
 if(/@import\s|url\(\s*['"]?https?:/i.test(combined))
  fail.push('CSS bundle includes unexpected remote dependency');
}
for(const fragment of ['#/confidentialite','#/mentions-legales','name="robots" content="noindex, nofollow"']){
 if(!html.includes(fragment))fail.push('Preview compliance guard absent: '+fragment);
}
// Static Pages cannot set response headers in this repository; verify that
// its head provides a limited CSP, no passive font provider and no Referer.
const configuration=await readFile(join(root,'auth-config.mjs'),'utf8');
const supabaseHost=configuration.match(/url:\s*["']https:\/\/([a-z0-9]{20}\.supabase\.co)["']/)?.[1];
const csp=html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*\/?>/i)?.[1]||'';
if(!supabaseHost||!csp.includes('https://'+supabaseHost))
 fail.push('Browser security policy does not pin the configured Supabase origin');
for(const rule of ["default-src 'self'","script-src 'self' https://cdn.jsdelivr.net",
 "object-src 'none'","base-uri 'self'","frame-src 'none'",
 "form-action 'self'","upgrade-insecure-requests"]){
 if(!csp.includes(rule))fail.push('Browser CSP guard absent: '+rule);
}
if(/script-src[^;]*(?:'unsafe-inline'|'unsafe-eval'|\*)/.test(csp))
 fail.push('Script CSP cannot allow inline execution, eval or wildcard sources');
if(!html.includes('name="referrer" content="no-referrer"'))
 fail.push('Referrer protection is absent');
if(/<link\b[^>]*https?:\/\/fonts\.(?:googleapis|gstatic)\.com/i.test(html))
 fail.push('External font provider reintroduced without privacy review');
if(fail.length){
 console.error(fail.join('\n'));
 process.exitCode=1;
}else console.log('Release preflight passed: '+files.length+' JS modules, '+checked+' internal imports, all public resources present, private source folders absent.');
