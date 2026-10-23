import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {RECOVERY_KEYS,validateRecoverySnapshot,compareRecoverySnapshots,formatRecoveryComparison} from '../scripts/compare-recovery-inventories.mjs';
const script=new URL('../scripts/compare-recovery-inventories.mjs',import.meta.url).pathname;
const md5='a'.repeat(32),policy='b'.repeat(32);
const snapshot=()=>({
 public_table_count:16,public_schema_fingerprint:md5,rls_disabled_tables:[],
 public_rls_policy_fingerprint:policy,privileged_anon_rpcs:[],
 user_roles_authenticated_can_write:false,user_roles_anon_can_write:false,
 role_requests_authenticated_can_write_directly:false,
 profiles_can_update_identity_or_timestamps:false,
 profiles_can_insert_timestamps:false,profiles_can_update_display_name:true,
 profiles_can_insert_id_and_display_name:true,auth_user_count:7,
 profile_count:7,role_count:9,club_team_count:5,
 pending_or_reviewed_role_requests_count:2
});
test('recovery inventory schema has strict, unique metadata fields',()=>{
 assert.equal(RECOVERY_KEYS.length,Object.keys(snapshot()).length);
 assert.deepEqual([...RECOVERY_KEYS].sort(),Object.keys(snapshot()).sort());
 assert.deepEqual(validateRecoverySnapshot(snapshot()),snapshot());
 assert.deepEqual(validateRecoverySnapshot({recovery_verification:snapshot()}),snapshot());
 assert.deepEqual(validateRecoverySnapshot({rows:[{recovery_verification:snapshot()}]}),snapshot());
});
test('equal safe source/restore metadata is compatible but not a restore certificate',()=>{
 const result=compareRecoverySnapshots(snapshot(),snapshot());
 assert.equal(result.compatible,true);
 assert.equal(result.checked,RECOVERY_KEYS.length);
 assert.deepEqual(result.differentKeys,[]);
 assert.match(formatRecoveryComparison(result),/ne prouve ni le succès de la restauration/);
});
test('a changed schema, policy, user count or roles must invalidate the comparison',()=>{
 for(const [field,value] of [
  ['public_schema_fingerprint','c'.repeat(32)],
  ['public_rls_policy_fingerprint','d'.repeat(32)],
  ['auth_user_count',8],['role_count',10],['club_team_count',4]
 ]){
  const changed={...snapshot(),[field]:value};
  const result=compareRecoverySnapshots(snapshot(),changed);
  assert.equal(result.compatible,false,field);
  assert.ok(result.differentKeys.includes(field),field);
 }
});
test('dangerous permissions invalidate comparison even when source and restored match',()=>{
 for(const [key,value] of [
  ['rls_disabled_tables',['profiles']],
  ['privileged_anon_rpcs',['admin_decide_role_request']],
  ['user_roles_anon_can_write',true],
  ['profiles_can_update_identity_or_timestamps',true],
  ['profiles_can_insert_timestamps',true],
  ['role_requests_authenticated_can_write_directly',true]
 ]){
  const s={...snapshot(),[key]:value};
  const result=compareRecoverySnapshots(s,s);
  assert.equal(result.compatible,false,key);
  assert.equal(result.unsafeConfigurations,true,key);
 }
});
test('unexpected personal data or malformed fields are rejected, never printed',()=>{
 for(const bad of [
  {...snapshot(),email:'example@example.invalid'},
  {...snapshot(),public_schema_fingerprint:'bad'},
  {...snapshot(),role_count:'9'},
  {...snapshot(),rls_disabled_tables:[{email:'private'}]},
  {...snapshot(),profiles_can_update_display_name:'true'},
  {...snapshot(),auth_user_count:-1},['not-object'],null
 ])assert.throws(()=>validateRecoverySnapshot(bad));
});
test('CLI refuses duplicate snapshot filenames and supports safe filesystem comparison',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'boissy-recovery-test-'));
 try{
  const src=join(directory,'source.json'),rest=join(directory,'restored.json');
  await Promise.all([writeFile(src,JSON.stringify(snapshot())),writeFile(rest,JSON.stringify(snapshot()))]);
  const pass=spawnSync(process.execPath,[script,src,rest],{encoding:'utf8'});
  assert.equal(pass.status,0,pass.stderr);
  assert.match(pass.stdout,/inventaires compatibles/);
  const same=spawnSync(process.execPath,[script,src,src],{encoding:'utf8'});
  assert.equal(same.status,1);
  assert.doesNotMatch(same.stderr,/[a-z0-9._-]+@example\.invalid/);
  await writeFile(rest,JSON.stringify({...snapshot(),role_count:100}));
  const mismatch=spawnSync(process.execPath,[script,src,rest],{encoding:'utf8'});
  assert.equal(mismatch.status,2,mismatch.stderr);
  assert.match(mismatch.stdout,/role_count/);
  assert.doesNotMatch(mismatch.stdout,/\.json|\/tmp\//);
 }finally{await rm(directory,{recursive:true,force:true});}
});
