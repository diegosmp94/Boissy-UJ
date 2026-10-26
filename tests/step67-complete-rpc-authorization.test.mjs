import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610260007_rpc_revocation_consistency.sql');
const audit=read('scripts/db-step67-rpc-readonly-audit.sql');
const functionText=(name)=>{
 const marker='-- Reviewed: '+name+'\n';
 const i=sql.indexOf(marker);
 if(i<0)throw Error('Missing function '+name);
 const next=sql.indexOf('\n-- Reviewed: ',i+marker.length);
 return sql.slice(i,next<0?sql.indexOf('revoke all on function',i):next);
};

test('five SECURITY DEFINER functions preserve signatures, search_path and EXECUTE grants',()=>{
 assert.match(sql,/^begin;/m);
 assert.match(sql,/^commit;/m);
 for(const name of ['admin_set_coach_team_assignment','admin_set_player_team_membership','staff_save_match','staff_save_news_article','staff_set_callup']){
  const scope=functionText(name);
  assert.match(scope,new RegExp('CREATE OR REPLACE FUNCTION public\\.'+name+'\\('));
  assert.match(scope,/SECURITY DEFINER\s+SET search_path TO ''/i);
  assert.match(scope,/for share of (?:r|r,a)/i);
  assert.match(sql,new RegExp('revoke all on function public\\.'+name+'\\([\\s\\S]*?\\) from public,anon,authenticated;','i'));
  assert.match(sql,new RegExp('grant execute on function public\\.'+name+'\\([\\s\\S]*?\\) to authenticated;','i'));
 }
 assert.doesNotMatch(sql,/\b(?:create table|alter table|drop table|truncate table|insert into auth\.users)\b/i);
});

test('assignment functions lock an approved TARGET role before writing affiliation',()=>{
 for(const [name,role,target] of [
  ['admin_set_coach_team_assignment','coach','p_coach_user_id'],
  ['admin_set_player_team_membership','player','p_player_user_id']
 ]){
  const f=functionText(name);
  assert.match(f,new RegExp("r\\.user_id\\s*=\\s*"+target+"\\s+and r\\.role\\s*=\\s*'"+role+"'","i"));
  const lock=f.toLowerCase().indexOf('for share of r');
  const write=f.toLowerCase().indexOf(name.includes('coach')?'insert into public.staff_team_assignments':'insert into app_private.team_player_memberships');
  assert.ok(lock>=0&&lock<write);
  assert.match(f,/if not found then/i);
 }
});

test('coach writes pin own role/team assignment; admin AAL2 branch pins admin role',()=>{
 for(const name of ['staff_save_match','staff_save_news_article','staff_set_callup']){
  const f=functionText(name);
  assert.match(f,/r\.role='admin'/);
  assert.match(f,/r\.role='coach'/);
  assert.match(f,/a\.team_id=(?:p_team_id|v_team) and a\.active=true/);
  assert.match(f,/for share of r,a/);
  assert.match(f,/for share of r/);
  const verification=f.lastIndexOf('for share of r,a');
  const dataWrite=f.search(/(?:insert into public\.matches|insert into public\.news_posts|insert into app_private\.match_callups)/);
  assert.ok(verification>=0&&verification<dataWrite);
 }
});

test('callup creation locks player role, affiliation and match status before invitation',()=>{
 const f=functionText('staff_set_callup');
 const iRole=f.indexOf("r.user_id=p_player_user_id and r.role='player'");
 const iMember=f.indexOf("tm.player_user_id=p_player_user_id and tm.team_id=v_team");
 const iMatch=f.indexOf("m.id=p_match_id and m.team_id=v_team");
 const iWrite=f.indexOf('insert into app_private.match_callups');
 assert.ok(iRole>=0&&iRole<iMember&&iMember<iMatch&&iMatch<iWrite);
 assert.match(f,/tm\.active=true[\s\S]+?for share of tm/);
 assert.match(f,/m\.match_status not in \('played','cancelled'\)[\s\S]+?for share of m/);
});

test('metadata audit inventories exposed definer RPCs but no individual member rows',()=>{
 assert.match(audit,/pg_proc/);
 assert.match(audit,/has_function_privilege\('authenticated'/);
 assert.match(audit,/has_function_privilege\('anon'/);
 assert.match(audit,/REVIEWED_STRUCTURE_ONLY/);
 assert.match(audit,/REVIEW_TEAM_AUTHORIZATION/);
 assert.match(audit,/checks_admin_aal2_helper/);
 assert.match(audit,/references_server_roles/);
 assert.match(audit,/references_team_scope/);
 assert.match(audit,/select rpc,arguments,anonymous_execute/);
 assert.doesNotMatch(audit,/\b(?:insert into|update public|delete from|alter table|drop table|truncate|copy)\b/i);
 assert.doesNotMatch(audit,/\bauth\.users\b|select\s+\*\s+from/i);
});
