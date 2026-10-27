/** Step 93 — explicit, encrypted PostgreSQL logical export.
 * Human operator only. NO automatic runtime invocation or production restore.
 * Uses PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSFILE with no DSN in argv.
 * Streams pg_dump custom format directly through age into a 0600 private file:
 * plaintext is never written to disk or GitHub. No logs or error details exposed.
 *
 * Restore is NEVER implemented here, and requires an isolated local target.
 */
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,lstat,realpath,open,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {once} from 'node:events';
import {resolve,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';

const LOOPBACK=new Set(['127.0.0.1','localhost','::1']);
const AGE_RECIPIENT=/^age1[023456789acdefghjklmnpqrstuvwxyz]{58,90}$/;
export function validateBackupEnvironment(env){
 if(!env||typeof env!=='object')throw Error('Missing backup configuration');
 const mandatory=['PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSFILE',
  'PGSSLMODE','BOISSY_BACKUP_AGE_RECIPIENT'];
 if(mandatory.some(k=>typeof env[k]!=='string'||!env[k].trim()))
  throw Error('Missing required backup environment values');
 if(!/^[0-9]{2,5}$/.test(env.PGPORT)||
  Number(env.PGPORT)<1||Number(env.PGPORT)>65535||
  !/^[a-zA-Z0-9._-]{1,150}$/.test(env.PGHOST)||
  !/^[a-zA-Z0-9_][a-zA-Z0-9_-]{0,62}$/.test(env.PGDATABASE)||
  !/^[a-zA-Z0-9_][a-zA-Z0-9_-]{0,62}$/.test(env.PGUSER)||
  !resolve(env.PGPASSFILE).startsWith('/')||
  !AGE_RECIPIENT.test(env.BOISSY_BACKUP_AGE_RECIPIENT))
  throw Error('Invalid backup connection or recipient');
 if(LOOPBACK.has(env.PGHOST)){
  if(!['disable','verify-full'].includes(env.PGSSLMODE))
   throw Error('Local SSL mode unsupported');
 }else if(env.PGSSLMODE!=='verify-full'){
  throw Error('Remote PostgreSQL must use verified TLS');
 }
 if(env.BOISSY_RECOVERY_APPROVED!==
   'I_APPROVE_ENCRYPTED_READ_ONLY_BACKUP_TO_PRIVATE_DIRECTORY')
  throw Error('Explicit operator approval missing');
 return Object.freeze({
  PGHOST:env.PGHOST,PGPORT:env.PGPORT,PGDATABASE:env.PGDATABASE,
  PGUSER:env.PGUSER,PGPASSFILE:resolve(env.PGPASSFILE),
  PGSSLMODE:env.PGSSLMODE,PGCONNECT_TIMEOUT:'12',
  PGAPPNAME:'boissy_step93_recovery_export',
  BOISSY_BACKUP_AGE_RECIPIENT:env.BOISSY_BACKUP_AGE_RECIPIENT
 });
}
export function validateBackupReceipt(x){
 if(!x||Object.keys(x).sort().join()!=='ciphertext_bytes,ciphertext_sha256,filename,format,kind,version'||
  x.version!==1||x.kind!=='encrypted-postgres'||
  x.format!=='pg_dump-custom-age'||
  !/^boissy-db-[0-9]{8}T[0-9]{6}Z\.dump\.age$/.test(x.filename)||
  !Number.isSafeInteger(x.ciphertext_bytes)||x.ciphertext_bytes<120||
  !/^[0-9a-f]{64}$/.test(x.ciphertext_sha256))
  throw Error('Encrypted backup receipt invalid');
 return x;
}
export async function securePrivateBackupDirectory(root){
 const dir=resolve(root,'recovery-private');
 const resolvedRoot=await realpath(root);
 if(resolvedRoot!==resolve(root))throw Error('Recovery root not canonical');
 await mkdir(dir,{recursive:true,mode:0o700});
 const info=await lstat(dir);
 if(!info.isDirectory()||info.isSymbolicLink()||
  (info.mode&0o077)!==0)
  throw Error('Private backup folder permissions invalid');
 return dir;
}
async function sha256File(path){
 const hash=createHash('sha256');
 const stream=createReadStream(path);
 for await(const chunk of stream)hash.update(chunk);
 return hash.digest('hex');
}
const codeOf=async process=>{
 const [code,signal]=await once(process,'close');
 if(code!==0||signal)throw Error('Backup subprocess failed');
};
export async function exportEncryptedDatabase(root,rawEnv,{
 spawnProcess=spawn
}={}){
 const cfg=validateBackupEnvironment(rawEnv);
 const passwordFile=await lstat(cfg.PGPASSFILE);
 if(!passwordFile.isFile()||passwordFile.isSymbolicLink()||
  (passwordFile.mode&0o077)!==0)
  throw Error('Postgres password file permissions invalid');
 const dir=await securePrivateBackupDirectory(root);
 const timestamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\..+$/,'Z');
 const name='boissy-db-'+timestamp+'.dump.age';
 const final=join(dir,name),partial=final+'.partial';
 const handle=await open(partial,'wx',0o600);
 let committed=false;
 try{
  // Only an explicit PG* allowlist reaches pg_dump, never the age recipient or
  // project secrets. env inheritance is disallowed for subprocesses.
  const pgEnv={PATH:process.env.PATH,HOME:process.env.HOME,
   PGHOST:cfg.PGHOST,PGPORT:cfg.PGPORT,PGDATABASE:cfg.PGDATABASE,
   PGUSER:cfg.PGUSER,PGPASSFILE:cfg.PGPASSFILE,
   PGSSLMODE:cfg.PGSSLMODE,PGCONNECT_TIMEOUT:cfg.PGCONNECT_TIMEOUT,
   PGAPPNAME:cfg.PGAPPNAME};
  const pg=spawnProcess('pg_dump',[
   '--format=custom','--no-owner','--no-privileges','--file=-'
  ],{env:pgEnv,stdio:['ignore','pipe','ignore']});
  const age=spawnProcess('age',['-r',cfg.BOISSY_BACKUP_AGE_RECIPIENT],
   {env:{PATH:process.env.PATH,HOME:process.env.HOME},
    stdio:['pipe','pipe','ignore']});
  // Never write a raw dump to a plaintext intermediary.
  const writer=handle.createWriteStream({autoClose:false});
  const [results]=await Promise.all([
   Promise.all([pipeline(pg.stdout,age.stdin),
    pipeline(age.stdout,writer)]),
   codeOf(pg),codeOf(age)
  ]);
  await handle.sync();
  const stat=await handle.stat();
  if(stat.size<120)throw Error('Incomplete encrypted database archive');
  await handle.close();
  await rename(partial,final);
  committed=true;
  const receipt=validateBackupReceipt({
   version:1,kind:'encrypted-postgres',format:'pg_dump-custom-age',
   filename:name,ciphertext_bytes:stat.size,ciphertext_sha256:await sha256File(final)
  });
  await writeFile(final+'.receipt.json',JSON.stringify(receipt,null,2)+'\n',
   {mode:0o600,flag:'wx'});
  return receipt;
 }finally{
  await handle.close().catch(()=>{});
  if(!committed)await rm(partial,{force:true}).catch(()=>{});
 }
}
export async function verifyEncryptedBackupReceipt(dir,rawReceipt){
 const r=validateBackupReceipt(rawReceipt);
 const file=resolve(dir,r.filename),root=resolve(dir);
 if(!file.startsWith(root+'/'))throw Error('Backup outside private folder');
 const st=await lstat(file);
 if(!st.isFile()||st.isSymbolicLink()||(st.mode&0o077)!==0)
  throw Error('Encrypted archive not private');
 return st.size===r.ciphertext_bytes&&
  await sha256File(file)===r.ciphertext_sha256;
}
async function main(args){
 const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
 if(args.length===1&&args[0]==='--export-encrypted'){
  const out=await exportEncryptedDatabase(root,process.env);
  console.log('PASS: encrypted backup completed; SHA-256 '+out.ciphertext_sha256+
   '. No plaintext file created. Keep encrypted archive offline and protected.');
 }else if(args.length===1&&args[0]==='--verify-last'){
  const dir=await securePrivateBackupDirectory(root);
  const {readdir}=await import('node:fs/promises');
  const receipts=(await readdir(dir)).filter(x=>
   /^boissy-db-[0-9]{8}T[0-9]{6}Z\.dump\.age\.receipt\.json$/.test(x)).sort();
  if(!receipts.length)throw Error('No backup receipt available');
  const raw=JSON.parse(await readFile(join(dir,receipts.at(-1)),'utf8'));
  const ok=await verifyEncryptedBackupReceipt(dir,raw);
  console.log(ok?'PASS: ciphertext integrity hash matches.':
   'FAIL: encrypted backup checksum mismatch.');
  if(!ok)process.exitCode=2;
 }else throw Error('Use --export-encrypted or --verify-last');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 main(process.argv.slice(2)).catch(()=>{
  console.error('BLOCKED: backup operation failed; no restore or plaintext disclosure attempted.');
  process.exitCode=1;
 });
}
