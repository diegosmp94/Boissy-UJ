import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration = readFileSync(
  new URL('../supabase/migrations/202610290001_advisor_missing_fk_indexes.sql', import.meta.url),
  'utf8'
);
const executable = migration.replace(/^--.*$/gm, '');

test('advisor 2026-10-29: all 7 uncovered foreign keys receive leading-column indexes', () => {
  const targets = [
    ['app_private.admin_awards_audit', 'actor_id'],
    ['app_private.award_ballots', 'user_id'],
    ['app_private.news_media_change_audit', 'actor_user_id'],
    ['app_private.news_media_purge_jobs', 'requested_by'],
    ['app_private.news_media_revocation_audit', 'actor_user_id'],
    ['app_private.privacy_retention_register', 'approved_by'],
    ['public.role_requests', 'self_approved_by']
  ];
  assert.equal((executable.match(/create\s+index\s+if\s+not\s+exists/gi) || []).length, targets.length);
  for (const [table, column] of targets) {
    const tableLiteral = table.replaceAll('.', '\\.');
    const pattern = new RegExp(
      'create\\s+index\\s+if\\s+not\\s+exists\\s+\\w+\\s+on\\s+' +
      tableLiteral + '\\s*\\(\\s*' + column + '\\s*\\)', 'i'
    );
    assert.match(executable, pattern, table + '.' + column);
  }
});

test('advisor FK migration is transactional, bounded and does not change permissions or data', () => {
  assert.match(executable, /^\s*begin\s*;/i);
  assert.match(executable, /set local lock_timeout\s*=\s*'5s'/i);
  assert.match(executable, /set local statement_timeout\s*=\s*'30s'/i);
  assert.match(executable, /commit\s*;\s*$/i);
  assert.doesNotMatch(executable, /\b(drop|truncate|delete|update|insert|alter|revoke|grant|create\s+policy|create\s+function)\b/i);
  assert.doesNotMatch(executable, /auth\.users|service_role|raw_user_meta_data/i);
});
