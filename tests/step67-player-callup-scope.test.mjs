import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../supabase/migrations/202610260005_player_callup_active_role_scope.sql',import.meta.url),'utf8');
const body=source.split('as $fn$')[1]?.split('$fn$;')[0]||'';

test('callup reply requires a signed-in approved player and active team membership',()=>{
 assert.match(source,/create or replace function public\.player_respond_callup\(\s*p_match_id uuid,p_response text\s*\)/i);
 assert.match(source,/language plpgsql security definer set search_path=''/);
 assert.match(body,/v_actor uuid := \(select auth\.uid\(\)\)/);
 assert.match(body,/r\.user_id=v_actor and r\.role='player'/);
 assert.match(body,/for share of r/);
 assert.match(body,/tm\.player_user_id=v_actor and tm\.active=true/);
 assert.match(body,/join public\.matches m on m\.team_id=tm\.team_id/);
 assert.match(body,/m\.id=p_match_id/);
 assert.match(body,/for share of tm/);
 assert.match(body,/raise exception 'Active player team affiliation required'/);
});

test('reply locks in order role, team affiliation, then own invitation',()=>{
 const role=body.indexOf('for share of r');
 const membership=body.indexOf('for share of tm');
 const callup=body.indexOf('for update of c');
 const update=body.indexOf('update app_private.match_callups');
 assert.ok(role!==-1 && role<membership && membership<callup && callup<update);
 assert.match(body,/c\.match_id=p_match_id and c\.player_user_id=v_actor/);
 assert.match(body,/if not found or v_prior='cancelled'/);
 assert.match(body,/p_response not in \('confirmed','declined','unsure'\)/);
 assert.match(body,/m\.match_status not in \('cancelled','played'\)/);
 assert.match(body,/insert into app_private\.callup_action_audit/);
});

test('patch preserves RPC signature and does not widen grants or expose member details',()=>{
 assert.match(source,/revoke all on function public\.player_respond_callup\(uuid,text\)\s+from public,anon,authenticated;/);
 assert.match(source,/grant execute on function public\.player_respond_callup\(uuid,text\)\s+to authenticated;/);
 assert.doesNotMatch(source,/grant (?:select|insert|update|delete) on/i);
 assert.doesNotMatch(source,/create table|drop table|truncate|alter table/i);
 assert.doesNotMatch(source,/\b(email|phone|birth_date|display_name|raw_user_meta_data)\b/i);
 assert.match(source,/^begin;/m);
 assert.match(source,/^commit;/m);
});
