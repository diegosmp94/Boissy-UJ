/** Builds only client-facing files, including every root ESM/CSS dependency.
 * Internal SQL, tests, tooling, workflow files, and documentation never ship.
 */
import {access,cp,mkdir,readdir,rm,writeFile} from 'node:fs/promises';
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
await access(join(project,'assets'));
await cp(join(project,'assets'),join(dist,'assets'),{recursive:true});
await writeFile(join(dist,'.nojekyll'),'');
await writeFile(join(dist,'robots.txt'),'User-agent: *\nDisallow: /\n');
console.log('Boissy-UJ: '+copied+' root client files copied, assets included, internal folders excluded.');
