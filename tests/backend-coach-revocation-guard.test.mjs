import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/202610260002_lock_coach_team_permission_during_jersey_write.sql',import.meta.url),'utf8');
const old=readFileSync(new URL('../supabase/migrations/202610240002_staff_team_player_positions.sql',import.meta.url),'utf8');
test('the jersey RPC revalidates delegated authorization after team serialization',()=>{
 assert.match(sql,/create or replace function public\.staff_set_affiliated_player_position\(/);
 const afterLock=sql.indexOf('perform pg_catalog.pg_advisory_xact_lock');
 const repeat=sql.indexOf("raise exception 'Team scope revoked before write'");
 const mutation=sql.indexOf('insert into app_private.team_player_positions');
 assert.ok(afterLock>=0&&repeat>afterLock&&mutation>repeat);
 assert.match(sql,/where a\.coach_user_id=v_actor and a\.team_id=p_team_id and a\.active=true\s+for share of a,r/);
 assert.match(sql,/join public\.user_roles r on r\.user_id=a\.coach_user_id and r\.role='coach'/);
 assert.match(sql,/if not coalesce\(\(select app_private\.is_admin\(\)\),false\) then/);
 assert.match(sql,/using errcode='42501'/);
});
test('function still checks membership and version, writes audited unique private number, never publishes',()=>{
 assert.match(sql,/m\.team_id=p_team_id and m\.player_user_id=p_player_user_id and m\.active=true/);
 assert.match(sql,/for share of m/);
 assert.match(sql,/p_expected_updated_at is distinct from v_old\.updated_at/);
 assert.match(sql,/insert into app_private\.team_player_position_audit/);
 assert.match(sql,/on conflict\(team_id,player_user_id\) do update/);
 assert.match(sql,/revoke all on function public\.staff_set_affiliated_player_position/);
 assert.match(sql,/grant execute on function public\.staff_set_affiliated_player_position[\s\S]*?to authenticated/);
 assert.doesNotMatch(sql,/insert into public\.team_public_people|update public\.team_public_people|service_role/i);
 assert.match(old,/create unique index if not exists team_player_position_unique_number/);
});
