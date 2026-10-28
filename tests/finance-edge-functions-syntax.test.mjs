import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

// Parse all deployed-capable Edge Function entrypoints without executing them.
// Prior CI only parsed app.js, missing a corrupted Stripe TEST webhook.
const root=fileURLToPath(new URL('../supabase/functions/',import.meta.url));
const functions=readdirSync(root,{withFileTypes:true})
 .filter(entry=>entry.isDirectory()&&!entry.name.startsWith('_'))
 .map(entry=>join(root,entry.name,'index.ts'));
test('all Supabase Edge Function entrypoints parse as ES modules',()=>{
 assert.ok(functions.length>=7,'expected seven finance Edge Functions');
 for(const file of functions){
  const source=readFileSync(file,'utf8');
  const result=spawnSync(process.execPath,['--check','--input-type=module'],{
   input:source,encoding:'utf8',timeout:10000,maxBuffer:1048576
  });
  assert.equal(result.status,0,`${file}: ${result.stderr||result.error||'syntax check failed'}`);
 }
});
