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
for(const fragment of ['#/confidentialite','#/mentions-legales','name="robots" content="noindex, nofollow"']){
 if(!html.includes(fragment))fail.push('Preview compliance guard absent: '+fragment);
}
if(fail.length){
 console.error(fail.join('\n'));
 process.exitCode=1;
}else console.log('Release preflight passed: '+files.length+' JS modules, '+checked+' internal imports, all public resources present, private source folders absent.');
