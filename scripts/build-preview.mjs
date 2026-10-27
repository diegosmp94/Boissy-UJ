/** Builds only client-facing files, including every root ESM/CSS dependency.
 * Internal SQL, tests, tooling, workflow files, and documentation never ship.
 */
import {access,cp,mkdir,readdir,rm,readFile,writeFile} from 'node:fs/promises';
import {buildPublicCssBundle,findLocalStylesheets,PUBLIC_CSS_BUNDLE} from './css-bundle.mjs';
import {join,dirname,extname} from 'node:path';
const project=process.cwd(),dist=join(project,'dist');
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
const clientExtensions=new Set(['.html','.js','.mjs','.css']);
const contents=await readdir(project,{withFileTypes:true});
let copied=0;
for(const entry of contents){
 if(!entry.isFile()||!clientExtensions.has(extname(entry.name)))continue;
 if(entry.name.endsWith('.test.mjs')||entry.name.endsWith('.test.js'))continue;
 const source=join(project,entry.name),destination=join(dist,entry.name);
 await mkdir(dirname(destination),{recursive:true});
 await cp(source,destination);copied++;
}
if(copied<8)throw new Error('Preview bundle is incomplete: fewer than 8 public entrypoints');
// GitHub Pages: one CSS request, same cascade, no third-party resources.
const originalHtml=await readFile(join(project,'index.html'),'utf8');
const cssSources=new Map();
for(const name of findLocalStylesheets(originalHtml)){
 cssSources.set(name,await readFile(join(project,name),'utf8'));
}
const optimized=buildPublicCssBundle(originalHtml,cssSources);
await writeFile(join(dist,PUBLIC_CSS_BUNDLE),optimized.css);
await writeFile(join(dist,'index.html'),optimized.html);
console.log('Boissy-UJ: '+optimized.names.length+
 ' original CSS requests consolidated to one ordered local stylesheet.');
await access(join(project,'assets'));
await cp(join(project,'assets'),join(dist,'assets'),{recursive:true});
await writeFile(join(dist,'.nojekyll'),'');
await writeFile(join(dist,'robots.txt'),'User-agent: *\nDisallow: /\n');
console.log('Boissy-UJ: '+copied+' root client files copied, assets included, internal folders excluded.');
