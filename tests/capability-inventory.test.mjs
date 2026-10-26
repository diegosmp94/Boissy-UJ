import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 CAPABILITIES,validateInventorySnapshot,collectRepositoryPaths,
 reconcileCapabilities,createCapabilityReport
} from '../scripts/capability-inventory.mjs';

const root=new URL('../',import.meta.url).pathname;
const snapshot=JSON.parse(readFileSync(new URL('../docs/inventaire-supabase-20261026.json',import.meta.url),'utf8'));

test('step 66 snapshot contains only metadata and explicit provenance',()=>{
 assert.equal(snapshot.schema_version,1);
 assert.ok(/Supabase read-only/.test(snapshot.source));
 assert.equal(snapshot.public_rls_count,20);
 assert.equal(snapshot.public_table_count,20);
 assert.equal(snapshot.buckets.includes('boissy-uj-approved'),false);
 assert.deepEqual(snapshot.edge_functions,[]);
 assert.ok(snapshot.migration_history.every(x=>/^\d{14}:[a-z0-9_]+$/.test(x)));
 assert.equal(validateInventorySnapshot(snapshot),snapshot);
 assert.deepEqual(Object.keys(snapshot).sort(),[
  'schema_version','observed_at','project_ref','source','public_table_count',
  'public_rls_count','tables','rpc_functions','buckets','edge_functions','migration_history'
 ].sort());
});

test('step 66 real snapshot reconciles core and correctly labels six undeployed modules',async()=>{
 const report=await createCapabilityReport(root,snapshot);
 assert.equal(CAPABILITIES.length,16);
 assert.equal(report.counts.connected,10);
 assert.equal(report.counts.prepared,6);
 assert.equal(report.counts.mismatch,0);
 assert.equal(report.counts.missingSource,0);
 assert.equal(report.counts.awaitingApproval,0);
 assert.equal(report.scope,'inventory-only-no-real-user-test');
 for(const id of ['reactions','media','awards_voting','stripe_test','news_history','free_tickets'])
  assert.equal(report.results.find(x=>x.id===id).state,'prepared-not-deployed');
 assert.ok(report.results.find(x=>x.id==='media').missingRuntime.includes('bucket:boissy-uj-approved'));
 assert.ok(report.results.find(x=>x.id==='stripe_test').missingRuntime.includes('edge:premium-stripe-test-webhook'));
});

test('a missing core RPC is runtime drift, not a successful readiness probe',async()=>{
 const paths=await collectRepositoryPaths(root);
 const altered={...snapshot,rpc_functions:snapshot.rpc_functions.filter(x=>x!=='admin_decide_role_request')};
 const report=reconcileCapabilities(altered,paths);
 const role=report.results.find(x=>x.id==='roles');
 assert.equal(role.state,'runtime-mismatch');
 assert.deepEqual(role.missingRuntime,['rpc:admin_decide_role_request']);
});

test('a staged module never automatically becomes enabled when its SQL appears',async()=>{
 const paths=await collectRepositoryPaths(root);
 const cap=CAPABILITIES.find(x=>x.id==='reactions');
 const altered={...snapshot,tables:[...snapshot.tables,'public.news_reactions']};
 const result=reconcileCapabilities(altered,paths,[cap]).results[0];
 assert.equal(result.state,'deployed-awaiting-approval');
 assert.deepEqual(result.missingRuntime,[]);
});

test('missing code or migration is different from a missing runtime object',async()=>{
 const paths=await collectRepositoryPaths(root);
 paths.delete('news-reactions.mjs');
 const report=reconcileCapabilities(snapshot,paths,[CAPABILITIES.find(x=>x.id==='reactions')]);
 assert.equal(report.results[0].state,'source-incomplete');
 assert.deepEqual(report.results[0].missingCode,['news-reactions.mjs']);
});

test('invalid snapshot shapes are rejected instead of becoming false positives',()=>{
 assert.throws(()=>validateInventorySnapshot({...snapshot,tables:'all'}),/snapshot field/);
 assert.throws(()=>validateInventorySnapshot({...snapshot,public_rls_count:22}),/public RLS/);
 assert.throws(()=>validateInventorySnapshot({...snapshot,rpc_functions:[...snapshot.rpc_functions,snapshot.rpc_functions[0]]}),/snapshot field/);
 assert.throws(()=>validateInventorySnapshot({...snapshot,observed_at:'unknown'}),/header/);
});

test('snapshot is not an auth or RLS test and source files never turn an unpaid feature on',()=>{
 const source=readFileSync(new URL('../scripts/capability-inventory.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/process\.env\.SUPABASE_SERVICE_ROLE|auth\.admin\.createUser|api\.rpc\(/);
 assert.match(source,/inventory-only-no-real-user-test/);
 assert.match(source,/deployed-awaiting-approval/);
});
