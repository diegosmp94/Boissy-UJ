import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610230005_news_revision_restore.sql');
const management=read('admin-management.mjs');
const revisions=read('admin-news-revisions.mjs');
const readiness=read('admin-control-reliability.mjs');
const nav=read('admin-navigation.mjs');

test('club-wide articles have a nullable audit team: no fake UUID and no silent omission',()=>{
 assert.match(sql,/alter table public\.staff_news_audit alter column team_id drop not null/);
 assert.match(sql,/v_snapshot->>'team_id' is distinct from v_old\.team_id::text/);
 assert.match(sql,/v_snapshot->>'id' is distinct from p_post_id::text/);
 assert.doesNotMatch(sql,/or v_old\.team_id is null/);
 assert.doesNotMatch(sql,/insert into public\.club_teams|update public\.club_teams/);
 assert.match(management,/option\('','Actualité générale du club'\)/);
 assert.match(management,/p_team_id:d\.team\|\|null/);
});

test('revision history returns bounded plain fields only with internal admin and MFA checks',()=>{
 const history=sql.split('create or replace function public.admin_list_news_revisions(')[1]
  .split('-- Restitution uniquement')[0];
 assert.ok(history);
 assert.match(history,/security definer set search_path=''/);
 assert.match(history,/auth\.jwt\(\)->>'aal'/);
 assert.match(history,/app_private\.is_admin\(\)/);
 assert.match(history,/a\.new_state->>'title'/);
 assert.match(history,/a\.new_state->>'excerpt'/);
 assert.match(history,/a\.new_state->>'body'/);
 assert.match(history,/limit 40;/);
 assert.doesNotMatch(history,/return query\s+select a\.\*|actor_user_id|author_user_id/);
});

test('restore checks optimistic version and same article and team, then resets publication and rights',()=>{
 const restore=sql.split('create or replace function public.admin_restore_news_revision(')[1]
  .split('-- AAL2 admin editor:')[0];
 assert.ok(restore);
 for(const expected of [
  'p_expected_updated_at is null','v_old.updated_at is distinct from p_expected_updated_at',
  "using errcode='40001'","a.id=p_revision_id and a.post_id=p_post_id",
  "v_snapshot->>'team_id' is distinct from v_old.team_id::text",
  "v_snapshot->>'content_kind' is distinct from 'article'",
  "v_snapshot->>'visibility' is distinct from 'public'",
  "status='draft',consent_reviewed=false,published_at=null",
  'insert into public.staff_news_audit',"'restore_draft'",
  'to_jsonb(v_old),to_jsonb(v_new)'
 ])assert.ok(restore.includes(expected),expected);
 assert.match(restore,/from public\.news_posts p where p\.id=p_post_id for update/);
 assert.doesNotMatch(restore,/delete from public\.news_posts/);
});

test('stale editor submissions reject 40001 before the existing audited save',()=>{
 const checked=sql.split('create or replace function public.admin_save_news_article_checked(')[1]
  .split('-- Read-only capability probe;')[0];
 assert.ok(checked);
 assert.match(checked,/p_expected_updated_at timestamptz/);
 assert.match(checked,/auth\.jwt\(\)->>'aal'/);
 assert.match(checked,/app_private\.is_admin\(\)/);
 assert.match(checked,/for share of r/);
 assert.match(checked,/from public\.news_posts p where p\.id=p_post_id for update/);
 assert.match(checked,/v_current is distinct from p_expected_updated_at/);
 assert.match(checked,/using errcode='40001'/);
 assert.match(checked,/return public\.staff_save_news_article\(/);
 assert.doesNotMatch(checked,/update public\.news_posts|insert into public\.news_posts/);
});

test('all three protected editor RPCs are explicitly callable by authenticated only',()=>{
 for(const [name,signature] of [
  ['admin_save_news_article_checked','uuid,uuid,text,text,text,boolean,boolean,timestamptz'],
  ['admin_list_news_revisions','uuid'],
  ['admin_restore_news_revision','uuid,bigint,timestamptz'],
  ['admin_news_revisions_ready','']
 ]){
  assert.ok(sql.includes('revoke all on function public.'+name+'('+signature+')'),name);
  assert.match(sql,new RegExp('grant execute on function public\\.'+name+'\\('+signature.replaceAll(',','[,]')+'\\)\\s+to authenticated'));
 }
 assert.doesNotMatch(sql,/grant\s+(?:all|execute)\s+on\s+function[\s\S]{0,150}\s+to\s+(?:anon|public)\s*;/i);
 assert.doesNotMatch(sql,/grant select on public\.staff_news_audit/i);
});

test('frontend uses optimistic article version and only restores after explicit admin recheck',()=>{
 assert.match(management,/rpcSave:'admin_save_news_article_checked'/);
 assert.match(management,/p_expected_updated_at:row\?\.updated_at\|\|null/);
 assert.match(management,/if\(requiresConfirmation&&key!==confirmKey\)/);
 assert.match(revisions,/api\.rpc\('admin_restore_news_revision'/);
 assert.match(revisions,/p_expected_updated_at:article\.updated_at/);
 assert.match(revisions,/if\(!await ensureAdmin\(\)\)throw/);
 assert.match(revisions,/articleSelect\.disabled=true;revisionsSelect\.disabled=true/);
 assert.match(revisions,/selectedArticle\(\)\?\.id!==article\.id/);
 assert.match(revisions,/confirmCheck\.checked=false/);
 assert.match(revisions,/Version restaurée comme brouillon non publié/);
 assert.match(readiness,/admin_news_revisions_ready/);
 assert.match(nav,/newsRevisionsReady===true/);
 assert.doesNotMatch(management+revisions,/\.innerHTML\s*=|service_role|\.from\('staff_news_audit'\)/i);
});
