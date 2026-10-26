import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL(
  '../supabase/migrations/202610260004_cover_missing_foreign_keys.sql',
  import.meta.url
),'utf8');
const statements=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n')
  .split(';').map(s=>s.trim()).filter(Boolean);
const expected=[
  ['app_private','league_standings_audit','actor_user_id'],
  ['app_private','match_competition_audit','actor_user_id'],
  ['app_private','match_competition_audit','match_id'],
  ['app_private','team_player_position_audit','actor_user_id'],
  ['app_private','team_player_position_audit','player_user_id'],
  ['app_private','team_player_position_audit','team_id'],
  ['app_private','team_player_positions','updated_by'],
  ['public','team_league_standings','season_id'],
  ['public','team_league_standings','updated_by']
];
test('P2: exactly nine additive foreign-key indexes, each targeting the verified schema and column',()=>{
  assert.equal(statements.length,expected.length);
  const targets=[];
  const names=new Set();
  for(const statement of statements){
    const match=statement.match(
      /^create\s+index\s+if\s+not\s+exists\s+([a-z_][\w]*)\s+on\s+(public|app_private)\.([a-z_][\w]*)\s*\(\s*([a-z_][\w]*)\s*\)$/i
    );
    assert.ok(match,'Only simple idempotent single-column B-tree indexes are allowed');
    assert.ok(!names.has(match[1]),'Each index name must be distinct');
    names.add(match[1]);
    targets.push([match[2],match[3],match[4]]);
  }
  assert.deepEqual(targets,expected);
});
test('P2: foreign-key performance patch has no data, permission, or RLS modifications',()=>{
  assert.doesNotMatch(statements.join(';'),/\b(insert|update|delete|truncate|drop|alter|grant|revoke|create\s+policy|security\s+definer)\b/i);
  assert.doesNotMatch(statements.join(';'),/concurrently|service_role|auth\.users|\bcreate\s+table\b/i);
});
