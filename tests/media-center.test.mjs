import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { filterNews, humanKind } from '../media-center.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610210004_news_public_v1.sql');
const script=read('media-center.mjs');
const app=read('app.js');
test('editorial RLS exposes only consent-approved public published content',()=>{
 assert.match(sql,/alter table public.news_posts enable row level security/);
 for (const gate of ["visibility = 'public'","status = 'published'","consent_reviewed = true","published_at <= now()"]) assert.ok(sql.includes(gate),gate);
 assert.match(sql,/revoke all on public.news_posts from anon, authenticated/);
 assert.match(sql,/grant select on public.news_posts to anon, authenticated/);
 assert.doesNotMatch(sql,/for (insert|update|delete) to (anon|authenticated)/i);
});
test('publishing requires a date and rights review',()=>{
 assert.match(sql,/constraint published_requires_consent_and_date/);
 assert.match(sql,/consent_reviewed = true and published_at is not null/);
 assert.match(sql,/visibility text not null default 'public'/);
});
test('search and media filters operate on actual data without mutation',()=>{
 const rows=[
  {title:'Un entraînement',excerpt:'Seniors A',body:'Photo du club',content_kind:'article'},
  {title:'Galerie des Seniors B',excerpt:'Photos',body:'Images autorisées',content_kind:'photo'},
  {title:'Vidéo de la saison',excerpt:'Résumé',body:'Séquence',content_kind:'video'}
 ];
 assert.equal(filterNews(rows).length,3);
 assert.deepEqual(filterNews(rows,{kind:'photo'}).map(x=>x.title),['Galerie des Seniors B']);
 assert.deepEqual(filterNews(rows,{query:'séNIORS'}).map(x=>x.title),['Un entraînement','Galerie des Seniors B']);
 assert.equal(humanKind('video'),'Vidéo');
 assert.equal(rows.length,3);
});
test('public endpoint rejects drafts and premium through explicit filters',()=>{
 for (const token of ["status:'eq.published'","visibility:'eq.public'","consent_reviewed:'eq.true'","published_at:'lte.'"]) assert.ok(script.includes(token),token);
 assert.match(script,/method:'GET'/);
 assert.match(script,/node\.textContent|n\.textContent/);
 assert.doesNotMatch(script,/innerHTML\s*=|method:'POST'|\.insert\(|\.upsert\(/);
});
test('news view is connected, responds safely when source is unavailable',()=>{
 assert.match(app,/import \{mountNews,unmountNews\} from '\.\/media-center.mjs'/);
 assert.match(app,/id="news-feed-public"/);
 assert.match(app,/if\(path==='\/actualites'\|\|activeSubpage\?\.section==='actualites'\)/);
 assert.match(app,/mountNews\(activeSubpage\?\.team\.code\|\|route\.teamCode\)/);
 assert.match(app,/else unmountNews\(\)/);
 assert.match(script,/showFeed\(root,\[\],false,\[\],initialTeamCode\)/);
 assert.match(script,/Aucune actualité fictive n’est affichée/);
});
