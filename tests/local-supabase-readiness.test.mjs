import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {
 BOISSY_PRODUCTION_REF,LOCAL_STACK_ID,assessLocalSupabaseSetup,
 inspectLocalCheckout,checkLocalRuntimes
} from '../scripts/local-supabase-readiness.mjs';

const configPath=new URL('../supabase/config.toml',import.meta.url);
const ignorePath=new URL('../.gitignore',import.meta.url);
const good={
 toml:readFileSync(configPath,'utf8'),
 ignore:readFileSync(ignorePath,'utf8'),
 linkedRef:null
};
test('local project has distinct ID, same major PostgreSQL 17 and ignored CLI state',async()=>{
 const result=assessLocalSupabaseSetup(good);
 assert.equal(result.localOnly,true);
 assert.equal(result.projectId,LOCAL_STACK_ID);
 assert.equal(result.postgres,17);
 assert.equal(result.productionDataCopied,false);
 assert.equal(result.cloudProjectCreated,false);
 assert.equal(Object.isFrozen(result),true);
 const root=new URL('../',import.meta.url).pathname;
 assert.equal((await inspectLocalCheckout(root)).localOnly,true);
});
test('any linked Supabase project or production ID is refused before local operations',()=>{
 for(const bad of [
  {...good,linkedRef:BOISSY_PRODUCTION_REF},
  {...good,linkedRef:'abcdefghijabcdefghij'},
  {...good,toml:good.toml.replace(LOCAL_STACK_ID,BOISSY_PRODUCTION_REF)},
  {...good,toml:good.toml.replace('major_version = 17','major_version = 15')},
  {...good,toml:good.toml+'\\n[remotes.prod]\\nproject_id="other"\\n'},
  {...good,toml:good.toml+'\\n# https://other.supabase.co\\n'},
  {...good,toml:good.toml+'\\n# service_role key not permitted\\n'},
  {...good,ignore:'# no state ignored'},
  {toml:'',ignore:good.ignore},
 ])assert.throws(()=>assessLocalSupabaseSetup(bad));
});
test('runtime preflight checks CLI version and local Docker status, never a remote DB command',()=>{
 const seen=[];
 const ok=checkLocalRuntimes((program,args)=>{
  seen.push([program,...args]);return true;
 });
 assert.deepEqual(ok,{cli:true,docker:true});
 assert.deepEqual(seen,[
  ['supabase','--version'],
  ['docker','info','--format','{{.ServerVersion}}']
 ]);
 assert.throws(()=>checkLocalRuntimes((program)=>program==='docker'),/Supabase CLI/);
 assert.throws(()=>checkLocalRuntimes((program)=>program==='supabase'),/Docker/);
});
test('isolated preflight rejects real invocation without CLI/Docker before printing any keys',()=>{
 const source=new URL('../scripts/local-supabase-readiness.mjs',import.meta.url);
 const code=readFileSync(source,'utf8');
 assert.doesNotMatch(code,/supabase\s+(?:db\s+push|link|login)|apply_migration|create_project|db\.execute_sql/);
 assert.doesNotMatch(code,/console\.log\([^)]*(?:\.key|\.password|\.secret|linkedRef)/);
 const p=spawnSync(process.execPath,[source.pathname],{encoding:'utf8',timeout:15000});
 assert.ok([0,1].includes(p.status));
 assert.doesNotMatch(p.stdout+p.stderr,/sb_secret_|service_role|db\.dahzewvbybujqhogumte/i);
});
