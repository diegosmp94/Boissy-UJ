/** Public release identification, no credentials, databases or personal details. */
import {writeFile,readFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const commit=/^[0-9a-f]{40}$/;
export function publicReleaseRecord(sha){
 if(typeof sha!=='string'||!commit.test(sha))
  throw new Error('Refusing to publish an unverified Git commit.');
 return Object.freeze({commit:sha,source:'main'});
}
async function main(){
 const root=resolve(process.cwd(),'dist');
 await Promise.all([access(resolve(root,'index.html')),readFile(resolve(root,'index.html'),'utf8')]);
 const record=publicReleaseRecord(process.env.BOISSY_RELEASE_SHA);
 await writeFile(resolve(root,'release.json'),JSON.stringify(record)+'\n',{flag:'w'});
 console.log('Public release manifest generated for commit '+record.commit.slice(0,12)+'.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(()=>{
  console.error('Cannot create public manifest: build or exact Git revision missing.');
  process.exitCode=1;
 });
}
