import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../supabase/migrations/202610260003_team_jersey_membership_lock_order.sql',import.meta.url),'utf8');
const functionBody=(name)=>{
 const start=source.indexOf('create or replace function public.'+name+'(');
 const end=source.indexOf('\n$fn$;',start);
 assert.ok(start>=0&&end>start);
 return source.slice(start,end);
};
test('staff jersey mutation locks team before membership row and preserves delegated scope check',()=>{
 const f=functionBody('staff_set_affiliated_player_position');
 const lock=f.indexOf('pg_catalog.pg_advisory_xact_lock');
 const membership=f.indexOf('perform 1 from app_private.team_player_memberships');
 const oldRow=f.indexOf('select * into v_old from app_private.team_player_positions');
 const mutation=f.indexOf('insert into app_private.team_player_positions');
 assert.ok(lock>=0&&lock<membership&&membership<oldRow&&oldRow<mutation);
 assert.match(f,/for share of m/);
 assert.match(f,/for share of a,r/);
 assert.match(f,/Team scope revoked before write/);
 assert.match(f,/p_expected_updated_at is distinct from v_old.updated_at/);
 assert.match(f,/insert into app_private.team_player_position_audit/);
 assert.doesNotMatch(f,/team_public_people/);
});
test('admin membership changes use identical per-team advisory key before row lock and trigger',()=>{
 const f=functionBody('admin_set_player_team_membership');
 const staff=functionBody('staff_set_affiliated_player_position');
 const signature='pg_catalog.hashtextextended(p_team_id::text,17409)';
 assert.ok(f.includes(signature)&&staff.includes(signature));
 assert.ok(f.indexOf('pg_catalog.pg_advisory_xact_lock')<
   f.indexOf('select tm.active into v_old_active'));
 assert.match(f,/app_private.is_admin\(\)/);
 assert.match(f,/v_actor=p_player_user_id/);
 assert.match(f,/where r.user_id=p_player_user_id and r.role='player'/);
 assert.match(f,/insert into app_private.team_membership_admin_audit/);
 assert.match(source,/revoke all on function public.staff_set_affiliated_player_position/);
 assert.match(source,/revoke all on function public.admin_set_player_team_membership/);
 assert.doesNotMatch(source,/insert into public.team_public_people/);
});
test('exit trigger uses same team advisory key and releases a number atomically',()=>{
 const trigger=readFileSync(new URL('../supabase/migrations/202610260001_release_inactive_team_jersey.sql',import.meta.url),'utf8');
 assert.match(trigger,/pg_catalog.hashtextextended\(OLD.team_id::text,17409\)/);
 assert.match(trigger,/delete from app_private.team_player_positions/);
 assert.match(trigger,/team_player_position_release_audit/);
});
