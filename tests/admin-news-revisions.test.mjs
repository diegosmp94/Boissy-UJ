import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {revisionSafetySummary,revisionLabels} from '../admin-news-revisions.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const migration=read('supabase/migrations/202610230005_news_revision_restore.sql');
const ui=read('admin-news-revisions.mjs');
const center=read('admin-center.mjs');
const nav=read('admin-navigation.mjs');
const css=read('admin-console.css');

test('only valid saved revision id is accepted and no private JSON is surfaced',()=>{
 assert.equal(revisionSafetySummary(null),null);
 assert.equal(revisionSafetySummary({revision_id:'2'}),null);
 assert.equal(revisionSafetySummary({revision_id:-1}),null);
 assert.deepEqual(revisionSafetySummary({revision_id:7,action:'restore_draft',
  title:'Ancienne version',excerpt:'Extrait',body:'Texte',was_published:true}),{
   id:7,label:'Restauration en brouillon',
   title:'Ancienne version',excerpt:'Extrait',body:'Texte',wasPublished:true
 });
 assert.ok(revisionLabels.unpublish);
 assert.ok(revisionLabels.create_publish);
});
test('history and restoration enforce admin role, AAL2 and deny raw private audit rows',()=>{
 assert.match(migration,/function public\.admin_list_news_revisions\(p_post_id uuid\)/);
 assert.match(migration,/function public\.admin_restore_news_revision\(/);
 assert.match(migration,/function public\.admin_news_revisions_ready\(\)/);
 assert.ok(migration.match(/auth\.jwt\(\)->>'aal'/g)?.length>=3);
 assert.ok(migration.match(/app_private\.is_admin\(\)/g)?.length>=3);
 assert.match(migration,/return query[\s\S]*?select a\.id,a\.created_at,a\.action/);
 assert.doesNotMatch(migration,/return query select a\.\*|grant select on public\.staff_news_audit/i);
 assert.match(migration,/limit 40;/);
 assert.match(migration,/revoke all on function public\.admin_list_news_revisions\(uuid\)/);
 assert.match(migration,/revoke all on function public\.admin_restore_news_revision\(uuid,bigint,timestamptz\)/);
 assert.match(migration,/revoke all on function public\.admin_news_revisions_ready\(\)/);
 assert.doesNotMatch(migration,/to anon\s*;/i);
});
test('restore is draft-only, resets consent and publication date while preserving team',()=>{
 for(const rule of [
  "v_old.updated_at is distinct from p_expected_updated_at",
  "using errcode='40001'",
  "a.id=p_revision_id and a.post_id=p_post_id",
  "v_snapshot->>'team_id' is distinct from v_old.team_id::text",
  "v_snapshot->>'id' is distinct from p_post_id::text",
  "v_snapshot->>'content_kind' is distinct from 'article'",
  "v_snapshot->>'visibility' is distinct from 'public'",
  "v_old.team_id is null",
  "where id=p_post_id returning * into v_new",
  "status='draft',consent_reviewed=false,published_at=null",
  "to_jsonb(v_old),to_jsonb(v_new)",
  "'restore_draft'"
 ])assert.ok(migration.includes(rule),rule);
 assert.match(migration,/from public\.news_posts p where p\.id=p_post_id for update/);
 assert.match(migration,/insert into public\.staff_news_audit/);
 assert.doesNotMatch(migration,/delete from public\.staff_news_audit/i);
 assert.doesNotMatch(migration,/insert into public\.news_posts/i);
});
test('UI requires MFA at load and before restore with explicit check confirmation',()=>{
 for(const rule of [
  "adminSessionStatus(api,userId)",
  "access.status==='admin'&&access.level==='aal2'",
  "api.rpc('admin_list_management_news')",
  "api.rpc('admin_list_news_revisions'",
  "api.rpc('admin_restore_news_revision'",
  "p_expected_updated_at:article.updated_at",
  "if(!await ensureAdmin())throw",
  "if(busy||restore.disabled||!root.isConnected||!confirmCheck.checked)return",
  "confirmCheck.checked=false",
  "Version restaurée comme brouillon non publié",
  "Restauration refusée",
  "root.replaceChildren"
 ])assert.ok(ui.includes(rule),rule);
 assert.doesNotMatch(ui,/\.innerHTML\s*=|service_role|\.from\('staff_news_audit'\)/i);
 assert.match(css,/\.admin-revision-body\{white-space:pre-wrap/);
 assert.match(nav,/newsRevisionsReady===true/);
 assert.match(read('admin-control-reliability.mjs'),/admin_news_revisions_ready/);
 assert.match(center,/await adminCapabilities\(api\)/);
});
