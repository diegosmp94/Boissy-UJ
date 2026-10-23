import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reactionLabel} from '../news-reactions.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610230001_member_news_reactions.sql');
const script=read('news-reactions.mjs');
const feed=read('media-center.mjs');
const html=read('index.html');

test('reaction table belongs to accounts and prohibits cross-account reads or writes',()=>{
  assert.match(sql,/primary key \(post_id,user_id\)/);
  assert.match(sql,/references auth\.users\(id\) on delete cascade/);
  assert.match(sql,/alter table public\.news_reactions enable row level security/);
  assert.match(sql,/revoke all on table public\.news_reactions from public,anon,authenticated/);
  assert.match(sql,/for select to authenticated\s+using \(user_id = \(select auth\.uid\(\)\)\)/);
  assert.match(sql,/for delete to authenticated\s+using \(user_id = \(select auth\.uid\(\)\)\)/);
  assert.match(sql,/for insert to authenticated\s+with check \(\s+user_id = \(select auth\.uid\(\)\)/);
  assert.doesNotMatch(sql,/grant .*update.*news_reactions/i);
});
test('reaction insert is restricted to consent-reviewed public articles already published',()=>{
  for(const clause of ["p.status = 'published'","p.visibility = 'public'","p.consent_reviewed = true","p.published_at <= now()"])
    assert.ok(sql.includes(clause),clause);
});
test('only authenticated user can act; feedback remains accessible',()=>{
  assert.match(script,/getAuthClient\(\)/);
  assert.match(script,/api\.auth\.getUser\(\)/);
  assert.match(script,/\.eq\('user_id',user\.id\)/);
  assert.match(script,/\.insert\(\{post_id:postId,user_id:user\.id\}\)/);
  assert.match(script,/\.delete\(\)/);
  assert.match(script,/setAttribute\('aria-pressed'/);
  assert.match(script,/setAttribute\('aria-live','polite'\)/);
  assert.match(script,/button\.disabled=true/);
  assert.equal(reactionLabel(false),'J’aime');
  assert.equal(reactionLabel(true),'Retirer mon j’aime');
  assert.doesNotMatch(script,/innerHTML|service_role|sb_secret_|method:\s*'POST'/i);
});
test('reactions are integrated without outside links or blocking public news',()=>{
  assert.match(feed,/loadNewsReactions/);
  assert.match(feed,/showFeed\(root,data,true,teams,initialTeamCode\)/);
  assert.match(script,/link\.href='#\/mon-espace'/);
  assert.match(html,/news-reactions\.css/);
});
