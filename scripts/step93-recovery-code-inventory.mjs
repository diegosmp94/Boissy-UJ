/** Step 93 — privacy-safe code recovery inventory (zero PII, zero remote calls).
 * Reads only explicitly tracked code, SQL migrations and configuration.
 * The output lists hashes, not file content or database records.
 */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstat,readFile,mkdir,realpath,writeFile} from 'node:fs/promises';
import {join,relative,resolve,sep,basename} from 'node:path';
import {fileURLToPath} from 'node:url';

export const RECOVERY_MANIFEST_VERSION=1;
export const CODE_PATH_EXACT=Object.freeze([
 'package.json','supabase/config.toml',
 'scripts/db-recovery-verification.sql',
 'scripts/db-recovery-schema-fingerprint.sql',
 'scripts/compare-recovery-inventories.mjs',
 'scripts/verify-recovery-target.mjs'
]);
const digest=b=>createHash('sha256').update(b).digest('hex');
export function safeRecoveryCodePath(p){
 if(typeof p!=='string'||p.length>240||p.includes('\\')||
  p.startsWith('/')||p.includes('..')||p.includes('\0')||
  !/^[a-zA-Z0-9_./-]+$/.test(p))return false;
 if(CODE_PATH_EXACT.includes(p))return true;
 if(/^supabase\/migrations\/[0-9]{12,14}_[a-z0-9_]+\.sql$/.test(p))return true;
 return /^supabase\/functions\/(?:[a-z0-9_-]+|_shared)\/(?:[a-zA-Z0-9._-]+\/)*[a-zA-Z0-9._-]+\.(?:ts|mjs|js|json)$/.test(p);
}
export function validateRecoveryCodeManifest(data){
 if(!data||typeof data!=='object'||Array.isArray(data)||
  Object.keys(data).sort().join()!=='entries,kind,version'||
  data.version!==RECOVERY_MANIFEST_VERSION||data.kind!=='code-only'||
  !Array.isArray(data.entries)||!data.entries.length||data.entries.length>2000)
  throw Error('Invalid recovery code manifest');
 const paths=new Set();
 let prev='';
 for(const entry of data.entries){
  if(!entry||Object.keys(entry).sort().join()!=='path,sha256,size'||
   !safeRecoveryCodePath(entry.path)||paths.has(entry.path)||
   entry.path<=prev||!Number.isSafeInteger(entry.size)||entry.size<0||
   entry.size>1000000||typeof entry.sha256!=='string'||
   !/^[0-9a-f]{64}$/.test(entry.sha256))
   throw Error('Unsafe recovery code entry');
  paths.add(entry.path);prev=entry.path;
 }
 return data;
}
export async function createRecoveryCodeManifest(root,paths){
 if(!Array.isArray(paths)||!paths.every(safeRecoveryCodePath)||
  paths.length<1||new Set(paths).size!==paths.length)
  throw Error('Invalid tracked code list');
 const entries=[];
 for(const path of [...paths].sort()){
  const full=resolve(root,path),rel=relative(resolve(root),full);
  if(rel.startsWith('..'+sep)||rel==='..'||rel.startsWith(sep))
   throw Error('Unsafe code file path');
  const info=await lstat(full);
  if(!info.isFile()||info.isSymbolicLink()||info.size>1000000)
   throw Error('Missing or unsafe tracked source');
  const data=await readFile(full);
  entries.push({path,size:data.length,sha256:digest(data)});
 }
 return validateRecoveryCodeManifest({
  version:RECOVERY_MANIFEST_VERSION,kind:'code-only',entries
 });
}
export function compareRecoveryCodeManifests(source,target){
 const a=validateRecoveryCodeManifest(source),b=validateRecoveryCodeManifest(target);
 const left=new Map(a.entries.map(x=>[x.path,x])),right=new Map(b.entries.map(x=>[x.path,x]));
 const changes=[...new Set([...left.keys(),...right.keys()])].sort()
  .filter(p=>!left.has(p)||!right.has(p)||
   left.get(p).sha256!==right.get(p).sha256||
   left.get(p).size!==right.get(p).size);
 return Object.freeze({compatible:changes.length===0,
  checked:a.entries.length,changedPaths:changes});
}
function trackedPaths(root){
 const raw=execFileSync('git',['-C',root,'ls-files','--cached','-z'],{
  encoding:'utf8',maxBuffer:4000000,stdio:['ignore','pipe','ignore']});
 return raw.split('\0').filter(safeRecoveryCodePath);
}
async function secureDir(root){
 const target=resolve(root,'recovery-private');
 if(await realpath(root).catch(()=>null)!==resolve(root))
  throw Error('Repository path must be canonical');
 await mkdir(target,{recursive:true,mode:0o700});
 const st=await lstat(target);
 if(!st.isDirectory()||st.isSymbolicLink()||(st.mode&0o077)!==0)
  throw Error('Private directory permissions too broad');
 return target;
}
async function main(argv){
 const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
 const mode=argv[0];
 if(mode==='--create'&&argv.length===1){
  const paths=trackedPaths(root);
  const manifest=await createRecoveryCodeManifest(root,paths);
  const dir=await secureDir(root);
  const output=join(dir,'recovery-code-inventory.json');
  await writeFile(output,JSON.stringify(manifest,null,2)+'\n',{mode:0o600,flag:'wx'});
  console.log('PASS: private code-only inventory created, '+
    manifest.entries.length+' files. No database or Storage contents exported.');
 }else if(mode==='--verify'&&argv.length===2&&
  basename(argv[1])==='recovery-code-inventory.json'){
  const manifest=validateRecoveryCodeManifest(JSON.parse(await readFile(argv[1],'utf8')));
  const next=await createRecoveryCodeManifest(root,trackedPaths(root));
  const diff=compareRecoveryCodeManifests(manifest,next);
  console.log(diff.compatible?'PASS: recovery code hashes match.':
   'FAIL: code recovery inventory drifted ('+diff.changedPaths.length+' paths).');
  if(!diff.compatible)process.exitCode=2;
 }else throw Error('Use --create or --verify recovery-code-inventory.json');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 main(process.argv.slice(2)).catch(()=>{
  console.error('BLOCKED: invalid recovery command, output permissions or inventory.');
  process.exitCode=1;
 });
}
