import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../scripts/backend-roster-production-preflight.sql',import.meta.url),'utf8');
test('preflight reports twelve real checks and two explicit blocked acceptance cases',()=>{
 for(let i=1;i<=14;i++)assert.ok(sql.includes(String(i).padStart(2,'0')+'_'),'check '+i+' is present');
 assert.match(sql,/13_live_permission_matrix','BLOCKED'/);
 assert.match(sql,/14_live_concurrent_writes','BLOCKED'/);
 assert.match(sql,/order by check_id/);
});
test('preflight is read-only, aggregate-only, and checks team locks, release and RPC privileges',()=>{
 assert.match(sql,/team_membership_release_jersey/);
 assert.match(sql,/team_player_position_unique_number/);
 assert.match(sql,/has_function_privilege\('anon',p\.oid,'execute'\)/);
 assert.match(sql,/search_path/);
 assert.match(sql,/Team scope revoked before write/);
 assert.match(sql,/from app_private\.team_player_memberships m/);
 assert.doesNotMatch(sql,/\b(create|alter|drop|truncate|delete|update|insert|grant|revoke|perform|set\s+role)\s+(?:table|function|schema|on|into|from|public\.|app_private\.)/i);
 assert.doesNotMatch(sql,/auth\.users|service_role|email|password|\.display_name/);
});
