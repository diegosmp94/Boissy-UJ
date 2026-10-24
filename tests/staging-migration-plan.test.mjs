import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 STAGING_PROPOSED_MIGRATIONS,STAGING_SCHEMA_BLOCKERS,
 stageSqlFingerprint,inspectStagingMigrationFiles,loadStagingMigrationPlan
} from '../scripts/staging-migration-plan.mjs';
const dir=new URL('../supabase/migrations/',import.meta.url).pathname;
const entries=()=>STAGING_PROPOSED_MIGRATIONS.map(p=>({
 file:p.file,sql:readFileSync(dir+p.file,'utf8')
}));
test('stage 58 identifies exactly six pending P2 modules in dependency order',()=>{
 assert.deepEqual(STAGING_PROPOSED_MIGRATIONS.map(e=>e.file),[
  '202610230001_member_news_reactions.sql',
  '202610230002_verified_news_media_assets.sql',
  '202610230003_premium_awards_ballots.sql',
  '202610230004_stripe_test_billing_webhook.sql',
  '202610230005_news_revision_restore.sql',
  '202610240001_free_event_tickets_gated.sql'
 ]);
 assert.ok(STAGING_SCHEMA_BLOCKERS.some(s=>s.includes('production schema')));
 assert.ok(STAGING_SCHEMA_BLOCKERS.some(s=>s.includes('No member data')));
});
test('all six actual tracked SQL files are in immutable review plan with SHA-256',async()=>{
 const rows=await loadStagingMigrationPlan(dir);
 assert.equal(rows.length,6);
 assert.deepEqual(rows.map(r=>r.filename),STAGING_PROPOSED_MIGRATIONS.map(x=>x.file));
 assert.equal(new Set(rows.map(r=>r.sha256)).size,6);
 for(const row of rows){
  assert.match(row.version,/^202610(?:23000[1-5]|240001)$/);
  assert.match(row.sha256,/^[a-f0-9]{64}$/);
  assert.equal(row.status,'requires-staging-review');
  assert.equal(Object.isFrozen(row),true);
 }
});
test('missing, duplicate, foreign migration or interrupted transaction never passes staging inventory',()=>{
 const rows=entries();
 assert.throws(()=>inspectStagingMigrationFiles(rows.slice(0,5)),/incomplete/);
 assert.throws(()=>inspectStagingMigrationFiles([...rows.slice(0,5),rows[0]]),/repeated/);
 assert.throws(()=>inspectStagingMigrationFiles([
  ...rows,{file:'202610230006_unreviewed.sql',sql:rows[0].sql}
 ]),/Unexpected/);
 assert.throws(()=>inspectStagingMigrationFiles([
  ...rows.slice(0,2),{...rows[2],sql:'select 1;'},...rows.slice(3)
 ]),/Invalid SQL|transaction/);
 assert.throws(()=>stageSqlFingerprint('begin;'),/Invalid/);
});
test('SQL fingerprints are content-addressed and do not materialize any private data',()=>{
 const s=entries()[0].sql,hash=stageSqlFingerprint(s);
 assert.match(hash,/^[a-f0-9]{64}$/);
 assert.notEqual(hash,stageSqlFingerprint(s+'\n-- review-only semantic difference'));
 assert.doesNotMatch(readFileSync(new URL('../scripts/staging-migration-plan.mjs',import.meta.url),'utf8'),
  /apply_migration\(|execute_sql\(|supabase\.db|psql\s|db\s+push/);
});
