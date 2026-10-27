import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {safeRecoveryCodePath,createRecoveryCodeManifest,
 validateRecoveryCodeManifest,compareRecoveryCodeManifests}
 from '../scripts/step93-recovery-code-inventory.mjs';
import {validateBackupEnvironment,validateBackupReceipt,
 verifyEncryptedBackupReceipt,securePrivateBackupDirectory}
 from '../scripts/step93-encrypted-db-backup.mjs';
import {METADATA_FIELDS,validateStep93Metadata,compareStep93Metadata,
 formatStep93MetadataDiff}
 from '../scripts/step93-compare-private-recovery.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const a='a'.repeat(64),b='b'.repeat(64);
const metadata=()=>({
 version:1,public_and_private_table_count:55,catalog_schema_sha256:a,
 policy_sha256:b,no_rls_count:0,privileged_anon_rpc_count:0,
 auth_users:7,profiles:7,storage_objects_metadata:8,
 news_media_assets:3,awards_ballots:1,privacy_requests:2,privacy_steps:8
});
const config=()=>({
 PGHOST:'db.local.domain.test',PGPORT:'5432',PGDATABASE:'postgres',
 PGUSER:'db_readonly',PGPASSFILE:'/tmp/private.pgpass',PGSSLMODE:'verify-full',
 BOISSY_BACKUP_AGE_RECIPIENT:'age1'+'q'.repeat(58),
 BOISSY_RECOVERY_APPROVED:'I_APPROVE_ENCRYPTED_READ_ONLY_BACKUP_TO_PRIVATE_DIRECTORY'
});

test('step93: allowlisted recovery inventory excludes private and client account content',()=>{
 for(const p of [
  'package.json','supabase/config.toml',
  'supabase/migrations/202610270011_step92_privacy_rights_workflow.sql',
  'supabase/functions/_shared/stripe-test-ticket-verification.mjs',
  'supabase/functions/stripe-webhook/index.ts',
  'scripts/db-recovery-verification.sql',
  'scripts/db-step93-recovery-metadata.sql',
  'scripts/step93-recovery-code-inventory.mjs',
  'scripts/step93-encrypted-db-backup.mjs',
  'scripts/step93-compare-private-recovery.mjs'])
  assert.equal(safeRecoveryCodePath(p),true,p);
 for(const p of [
  '../../.env','.env','recovery-private/data.dump.age',
  'supabase/.temp/a.sql','supabase/functions/.env',
  'supabase/functions/api/secrets.json', '/tmp/backup.sql',
  'supabase/migrations/private_export.sql',
  'README.md','assets/private.jpg','public/account.json',
  'scripts/../../.env','supabase/functions/a/../../private.ts'
 ])assert.equal(safeRecoveryCodePath(p),false,p);
});

test('step93: code manifest stores digest+size only and verifies changed source',async()=>{
 const root=await mkdtemp(join(tmpdir(),'boissy-safe-code-'));
 try{
  await mkdir(join(root,'supabase'),{recursive:true});
  await writeFile(join(root,'package.json'),'{"version":1}');
  await writeFile(join(root,'supabase/config.toml'),'[functions]\n');
  const paths=['supabase/config.toml','package.json'];
  const m=await createRecoveryCodeManifest(root,paths);
  assert.equal(m.kind,'code-only');
  assert.equal(m.entries.length,2);
  assert.equal(m.entries[0].sha256,createHash('sha256')
   .update('{"version":1}').digest('hex'));
  assert.equal(compareRecoveryCodeManifests(m,m).compatible,true);
  const changed=JSON.parse(JSON.stringify(m));
  changed.entries[1].sha256='0'.repeat(64);
  assert.deepEqual(compareRecoveryCodeManifests(m,changed).changedPaths,
   ['supabase/config.toml']);
  assert.throws(()=>validateRecoveryCodeManifest({...m,email:'private@test.invalid'}));
  assert.throws(()=>validateRecoveryCodeManifest({...m,entries:[...m.entries,m.entries[0]]}));
  await rm(join(root,'supabase/config.toml'));
  await import('node:fs/promises').then(f=>f.symlink(join(root,'package.json'),
   join(root,'supabase/config.toml')));
  await assert.rejects(()=>createRecoveryCodeManifest(root,paths));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('step93: encrypted backup config requires explicit operator consent and verified TLS',()=>{
 const cfg=validateBackupEnvironment(config());
 assert.equal(cfg.PGSSLMODE,'verify-full');
 assert.equal(Object.hasOwn(cfg,'PGPASSWORD'),false);
 for(const changes of [
  {PGHOST:'db.local.domain.test',PGSSLMODE:'disable'},
  {PGSSLMODE:'require'},
  {PGHOST:'evil;sh'},
  {PGHOST:'cloud.local',PGSSLMODE:'prefer'},
  {PGPORT:'00000'},
  {PGPORT:'65536'},
  {PGPASSFILE:'./secret'},
  {PGDATABASE:'private users'},
  {PGUSER:'user space'},
  {BOISSY_BACKUP_AGE_RECIPIENT:'age1not-valid'},
  {BOISSY_RECOVERY_APPROVED:'no'}
 ]){
  assert.throws(()=>validateBackupEnvironment({...config(),...changes}),JSON.stringify(changes));
 }
 assert.equal(validateBackupEnvironment({
  ...config(),PGHOST:'localhost',PGSSLMODE:'disable'
 }).PGHOST,'localhost');
});

test('step93: backup receipts verify ciphertext hash privately and reject broken files',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'boissy-encrypted-'));
 try{
  const name='boissy-db-20261027T140500Z.dump.age';
  const content=Buffer.alloc(300,17);
  const path=join(dir,name);
  await writeFile(path,content,{mode:0o600});
  await chmod(dir,0o700);
  const receipt={version:1,kind:'encrypted-postgres',
   format:'pg_dump-custom-age',filename:name,ciphertext_bytes:content.length,
   ciphertext_sha256:createHash('sha256').update(content).digest('hex')};
  assert.deepEqual(validateBackupReceipt(receipt),receipt);
  assert.equal(await verifyEncryptedBackupReceipt(dir,receipt),true);
  await writeFile(path,Buffer.alloc(300,18));
  assert.equal(await verifyEncryptedBackupReceipt(dir,receipt),false);
  assert.throws(()=>validateBackupReceipt({...receipt,filename:'../private.dump.age'}));
  assert.throws(()=>validateBackupReceipt({...receipt,email:'private@test.invalid'}));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('step93: recovery-private directory must have exclusive permissions',async()=>{
 const root=await mkdtemp(join(tmpdir(),'boissy-secret-home-'));
 try{
  const dir=await securePrivateBackupDirectory(root);
  assert.ok(dir.endsWith('/recovery-private'));
  await chmod(dir,0o755);
  await assert.rejects(()=>securePrivateBackupDirectory(root));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('step93: private metadata fingerprints and counts are strict and non-PII',()=>{
 const m=metadata();
 assert.equal(METADATA_FIELDS.length,Object.keys(m).length);
 assert.deepEqual(validateStep93Metadata(m),m);
 assert.deepEqual(validateStep93Metadata({step93_recovery_metadata:m}),m);
 assert.deepEqual(validateStep93Metadata({rows:[{step93_recovery_metadata:m}]}),m);
 for(const variant of [
  {...m,email:'someone@test.invalid'},{...m,auth_users:'7'},
  {...m,policy_sha256:'short'},{...m,privacy_steps:-1},
  {...m,version:9}
 ])assert.throws(()=>validateStep93Metadata(variant));
 assert.equal(compareStep93Metadata(m,m).compatible,true);
 assert.match(formatStep93MetadataDiff(compareStep93Metadata(m,m)),
  /ne sont pas vérifiés/);
});

test('step93: restore private mismatch and unsafe privileges cause failure',()=>{
 const original=metadata();
 for(const changes of [
  {auth_users:8},{privacy_steps:9},{storage_objects_metadata:9},
  {catalog_schema_sha256:'f'.repeat(64)},
  {policy_sha256:'c'.repeat(64)},
  {no_rls_count:1},{privileged_anon_rpc_count:1}
 ]){
  const result=compareStep93Metadata(original,{...original,...changes});
  assert.equal(result.compatible,false);
  assert.ok(result.differentKeys.some(k=>Object.hasOwn(changes,k)));
 }
 const unsafe=compareStep93Metadata(
  {...original,privileged_anon_rpc_count:1},
  {...original,privileged_anon_rpc_count:1});
 assert.equal(unsafe.unsafe,true);
 assert.equal(unsafe.compatible,false);
});

test('step93: encrypted export CLI cannot activate without private configuration',async()=>{
 const exporter=new URL('../scripts/step93-encrypted-db-backup.mjs',import.meta.url).pathname;
 const r=spawnSync(process.execPath,[exporter,'--export-encrypted'],{
  encoding:'utf8',env:{PATH:process.env.PATH,HOME:process.env.HOME}});
 assert.equal(r.status,1);
 assert.match(r.stderr,/BLOCKED:/);
 assert.doesNotMatch(r.stdout+r.stderr,/postgresql:\/\/|PGPASSWORD|age1[q]+/);
});

test('step93: physical Storage files, Auth settings and Edge Functions remain explicit separate tasks',async()=>{
 const sql=await read('scripts/db-step93-recovery-metadata.sql');
 assert.match(sql,/READ-ONLY recovery metadata/);
 assert.match(sql,/from storage\.objects/);
 assert.match(sql,/from auth\.users/);
 assert.match(sql,/extensions\.digest/);
 assert.match(sql,/pg_policies/);
 assert.doesNotMatch(sql,/delete from|update auth\.|insert into|create table/i);
 const db=await read('scripts/step93-encrypted-db-backup.mjs');
 assert.match(db,/spawnProcess\('pg_dump'/);
 assert.match(db,/spawnProcess\('age'/);
 assert.match(db,/pipeline\(pg\.stdout,age\.stdin\)/);
 assert.match(db,/pipeline\(age\.stdout,writer\)/);
 assert.match(db,/mode:0o600/);
 assert.match(db,/--no-owner/);
 assert.match(db,/No plaintext file/);
 assert.doesNotMatch(db,/pg_restore|TRUNCATE|DROP DATABASE|DROP SCHEMA|CREATE DATABASE/);
 const cmp=await read('scripts/step93-compare-private-recovery.mjs');
 assert.match(cmp,/ne sont pas vérifiés/);
 const ignore=await read('.gitignore');
 assert.match(ignore,/recovery-private\//);
});
