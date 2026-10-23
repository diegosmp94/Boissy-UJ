/**
 * Step 58 local substitute for unavailable hosted staging.
 * STATIC / LOCAL TOOLING ONLY. No database connections, cloud access,
 * authentication or remote database modification.
 * Operator can run supabase start locally with Docker after validation.
 */
import {readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

export const BOISSY_PRODUCTION_REF='dahzewvbybujqhogumte';
export const LOCAL_STACK_ID='boissy-uj-local';
const projectLine=content=>content.match(/^\s*project_id\s*=\s*"([^"]+)"\s*$/m)?.[1]||null;
export function assessLocalSupabaseSetup({toml,ignore,linkedRef=null}){
 if(typeof toml!=='string'||typeof ignore!=='string')
  throw new Error('Missing local project settings.');
 const project=projectLine(toml);
 if(project!==LOCAL_STACK_ID||project===BOISSY_PRODUCTION_REF)
  throw new Error('An isolated local project_id is required.');
 if(!/^\s*\[db\]\s*$/m.test(toml)||
    !/^\s*major_version\s*=\s*17\s*$/m.test(toml))
  throw new Error('Local database must use PostgreSQL 17.');
 for(const pattern of [/^supabase\/\.temp\/\s*$/m,/^supabase\/\.branches\/\s*$/m]){
  if(!pattern.test(ignore))
   throw new Error('Temporary Supabase CLI state must be excluded from Git.');
 }
 if(/\[remotes\./i.test(toml)||toml.includes(BOISSY_PRODUCTION_REF)||
    /supabase\.co|sb_secret_|service_role|postgres(?:ql)?:\/\//i.test(toml))
  throw new Error('Do not embed remote project coordinates or credentials.');
 if(linkedRef!==null){
  // An isolated clone has no .temp/project-ref: refuse any remote link.
  throw new Error('This working copy is linked to a remote Supabase project.');
 }
 return Object.freeze({localOnly:true,projectId:project,postgres:17,
  productionDataCopied:false,cloudProjectCreated:false});
}
async function readLinkedRef(projectRoot){
 const path=join(projectRoot,'supabase','.temp','project-ref');
 try{await access(path);return 'linked';}catch{return null;}
}
export async function inspectLocalCheckout(projectRoot){
 const [toml,ignore,linkedRef]=await Promise.all([
  readFile(join(projectRoot,'supabase','config.toml'),'utf8'),
  readFile(join(projectRoot,'.gitignore'),'utf8'),
  readLinkedRef(projectRoot)
 ]);
 return assessLocalSupabaseSetup({toml,ignore,linkedRef});
}
function commandAvailable(executable,args){
 const cmd=process.platform==='win32'?executable+'.exe':executable;
 try{
  const r=spawnSync(cmd,args,{encoding:'utf8',timeout:10000,
   shell:false,windowsHide:true,maxBuffer:200000});
  return r.status===0&&!r.error;
 }catch{return false;}
}
export function checkLocalRuntimes(run=commandAvailable){
 if(!run('supabase',['--version']))
  throw new Error('Supabase CLI must be installed on this local workstation.');
 if(!run('docker',['info','--format','{{.ServerVersion}}']))
  throw new Error('Local Docker daemon must be running before Supabase start.');
 return Object.freeze({cli:true,docker:true});
}
async function main(){
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 await inspectLocalCheckout(root);
 console.log('PASS: local Supabase configuration is isolated and unlinked.');
 checkLocalRuntimes();
 console.log('PASS: Supabase CLI and Docker are locally available.');
 console.log('NEXT: review migrations, then explicitly run supabase start locally.');
 console.log('NOT VERIFIED: migrations, recovery or seven-user RLS.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(()=>{
  // Credentials, linked refs, Docker info and full paths are never printed.
  console.error('BLOCKED: local Supabase prerequisites or isolation failed.');
  process.exitCode=1;
 });
}
