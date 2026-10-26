import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reactionPostIds,reactionLabel} from '../news-reactions.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610230001_member_news_reactions.sql');
const ui=read('news-reactions.mjs'),feed=read('media-center.mjs');

const articleA='11111111-1111-4111-8111-111111111111';
const articleB='22222222-2222-4222-8222-222222222222';

test('only distinct article UUIDs are eligible for reactions, not gallery, videos or other content',()=>{
 assert.deepEqual(reactionPostIds([
  {id:articleA,content_kind:'article'},
  {id:articleA,content_kind:'article'},
  {id:articleB,content_kind:'article'},
  {id:articleB,content_kind:'video'},
  {id:'not-an-id',content_kind:'article'},
  {id:'33333333-3333-3333-3333-333333333333',content_kind:'photo'}
 ]),[articleA,articleB]);
 assert.deepEqual(reactionPostIds(null),[]);
 assert.equal(reactionLabel(false),'J’aime');
 assert.equal(reactionLabel(true),'Retirer mon j’aime');
});

test('single reaction per account/article with no anonymous reads and no update permission',()=>{
 assert.match(sql,/primary key \(post_id,user_id\)/);
 assert.match(sql,/references auth\.users\(id\) on delete cascade/);
 assert.match(sql,/references public\.news_posts\(id\) on delete cascade/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on table public\.news_reactions from public,anon,authenticated/);
 assert.match(sql,/grant select \(post_id,user_id\),insert \(post_id,user_id\),delete/);
 assert.match(sql,/for select to authenticated\s+using \(user_id = \(select auth\.uid\(\)\)\)/);
 assert.match(sql,/for delete to authenticated\s+using \(user_id = \(select auth\.uid\(\)\)\)/);
 assert.match(sql,/for insert to authenticated[\s\S]*?with check \(\s+user_id = \(select auth\.uid\(\)\)/);
 assert.doesNotMatch(sql,/grant\s+update|create policy\s+.*for update/ig);
});

test('likes are allowed only on actively public, consent-reviewed TEXT articles',()=>{
 for(const marker of [
  "p.content_kind = 'article'", "p.status = 'published'",
  "p.visibility = 'public'", 'p.consent_reviewed = true','p.published_at <= now()'
 ])assert.ok(sql.includes(marker),marker);
 assert.match(sql,/create trigger news_reactions_target_guard/);
 assert.match(sql,/before insert on public\.news_reactions/);
 assert.match(sql,/new\.user_id is distinct from \(select auth\.uid\(\)\)/);
 assert.match(sql,/for share of p/);
 assert.match(sql,/Article is no longer published for reactions/);
});

test('unpublishing deletes only affected article reactions atomically to avoid stale member preferences',()=>{
 assert.match(sql,/create trigger news_reactions_unpublish_guard/);
 assert.match(sql,/after update of status,visibility,consent_reviewed,content_kind,published_at on public\.news_posts/);
 assert.match(sql,/old\.status='published' and old\.visibility='public'/);
 assert.match(sql,/new\.status is distinct from 'published'/);
 assert.match(sql,/new\.visibility is distinct from 'public'/);
 assert.match(sql,/new\.consent_reviewed is distinct from true/);
 assert.match(sql,/new\.content_kind is distinct from 'article'/);
 assert.match(sql,/new\.published_at is null or new\.published_at>now\(\)/);
 assert.match(sql,/delete from public\.news_reactions where post_id=new\.id/);
 assert.doesNotMatch(sql,/delete from public\.news_posts/);
 for(const f of ['app_private.verify_news_reaction_target','app_private.clear_unpublished_news_reactions'])
  assert.ok(sql.includes('revoke all on function '+f+'()'),f);
});

test('member reacts with session revalidation, optimistic dedupe and accessible feedback',()=>{
 assert.match(ui,/api\.auth\.getUser\(\)/);
 assert.match(ui,/fresh\.data\?\.user\?\.id!==user\.id/);
 assert.match(ui,/if\(!button\.isConnected\)return/);
 assert.match(ui,/button\.disabled=true/);
 assert.match(ui,/result\.error\.code==='23505'/);
 assert.match(ui,/\.select\('post_id'\)\.eq\('user_id',user\.id\)\.eq\('post_id',postId\)/);
 assert.match(ui,/\.insert\(\{post_id:postId,user_id:user\.id\}\)/);
 assert.match(ui,/\.delete\(\)/);
 assert.match(ui,/setAttribute\('aria-pressed'/);
 assert.match(ui,/setAttribute\('aria-live','polite'\)/);
 assert.match(ui,/guestReaction\(article\)/);
 assert.match(ui,/href='#\/mon-espace'/);
 assert.doesNotMatch(ui,/\.innerHTML|service_role|sb_secret_|\.update\(/i);
});

test('the public feed is still independent of the optional reaction plugin',()=>{
 assert.match(feed,/hydrateNewsIndependently/);
 assert.match(feed,/loadNewsReactions/);
 assert.match(feed,/loadMedia:/);
 assert.match(feed,/loadReactions:/);
 assert.match(feed,/isActive:alive/);
});
