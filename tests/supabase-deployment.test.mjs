import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610210007_security_indexes.sql');
const deployment=read('docs/ETAT_SUPABASE_20261021.md');
const config=read('auth-config.mjs');
test('event trigger cannot be invoked from public RPC via browser roles',()=>{
 assert.match(sql,/revoke all on function public\.rls_auto_enable\(\) from public, anon, authenticated/);
});
test('schema hardening preserves read-only catalogue and private audit',()=>{
 assert.match(sql,/revoke insert, update, delete on public\.club_teams, public\.matches/);
 assert.match(sql,/revoke all on public\.staff_news_audit from anon, authenticated/);
 assert.equal((sql.match(/create index if not exists/g)||[]).length,6);
});
test('migration provenance and deployment restrictions are documented',()=>{
 for(const marker of [
 'boissy_uj_sport_public_v1_20261021','boissy_uj_news_public_v1_20261021',
 'boissy_uj_events_public_v1_20261021','boissy_uj_staff_content_workflows_20261021',
 'boissy_uj_security_indexes_20261021'
 ]) assert.ok(deployment.includes(marker),marker);
 assert.match(deployment,/8 tables applicatives/);
 assert.match(config,/enabled:\s*false/);
});
