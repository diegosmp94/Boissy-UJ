/** RGPD engineering inventory of static first-party code (not a legal certification).
 * Reports external origins and browser storage APIs, but contains no user records.
 */
import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {extname,join,resolve} from 'node:path';
const src=process.cwd(),out=resolve(src,'smoke-artifacts');
const extensions=new Set(['.html','.js','.mjs','.css']);
const files=(await readdir(src)).filter(name=>extensions.has(extname(name))&&!name.endsWith('.test.mjs'));
const origins=new Map(),storage=new Map();
const trackerPatterns=[
 /googletagmanager\.com/i,/google-analytics\.com/i,/connect\.facebook\.net/i,
 /static\.hotjar\.com/i,/cdn\.segment\.com/i,/api\.mixpanel\.com/i,
 /googleadservices\.com/i,/doubleclick\.net/i
];
const blockers=[];
for(const file of files){
 const source=await readFile(join(src,file),'utf8');
 for(const hit of source.matchAll(/https?:\/\/([a-z0-9][a-z0-9.-]*)(?=[/:'"\\\s]|$)/gi)){
  const domain=hit[1].toLowerCase(),list=origins.get(domain)||new Set();
  list.add(file);origins.set(domain,list);
  if(trackerPatterns.some(rx=>rx.test(domain)))blockers.push(file+' includes tracking endpoint '+domain);
 }
 const uses=[];
 for(const [pattern,name] of [
  [/\b(?:window\.)?localStorage\b/g,'localStorage'],
  [/\b(?:window\.)?sessionStorage\b/g,'sessionStorage'],
  [/\bdocument\.cookie\b/g,'document.cookie'],
  [/\bindexedDB\b/g,'indexedDB']
 ]){
  if(pattern.test(source))uses.push(name);
 }
 if(uses.length)storage.set(file,uses);
}
const report={
 auditedAt:new Date().toISOString(),
 note:'Code-level inventory only. Check third-party network requests, cookies and contracts in a real browser before RGPD sign-off.',
 origins:[...origins].sort(([a],[b])=>a.localeCompare(b))
  .map(([domain,usedBy])=>({domain,sourceFiles:[...usedBy].sort()})),
 browserStorage:[...storage].map(([file,apis])=>({file,apis})),
 forbiddenTrackingEndpoints:blockers
};
await mkdir(out,{recursive:true});
await writeFile(join(out,'privacy-inventory.json'),JSON.stringify(report,null,2));
console.log('RGPD technical inventory: '+files.length+' source files, '+origins.size+' external domains, '+storage.size+' browser-storage code paths.');
for(const item of report.origins)console.log('  origin '+item.domain+' ('+item.sourceFiles.length+' files)');
for(const item of report.browserStorage)console.log('  storage '+item.file+': '+item.apis.join(', '));
if(blockers.length){
 console.error('Third-party tracking code requires review before shipping:\n'+blockers.join('\n'));
 process.exitCode=1;
}
