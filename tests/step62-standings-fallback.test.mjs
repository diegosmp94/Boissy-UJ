import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('step62: unavailable standings cannot leave the loading spinner indefinitely',()=>{
 const s=read('league-standings.mjs');
 assert.match(s,/import \{boundedPublicRequest\} from '\.\/public-catalog-timeout\.mjs'/);
 assert.match(s,/const deadline=boundedPublicRequest\(ctrl\.signal\)/);
 assert.match(s,/fetchPublicStandings\(\{signal:deadline\.signal\}\)/);
 assert.match(s,/method:'GET',signal:deadline\.signal/);
 assert.match(s,/finally\{deadline\.dispose\(\);\}/);
});
test('step62: failure retains team source context without fabricating a league table',()=>{
 const s=read('league-standings.mjs');
 assert.match(s,/Classement du club momentanément indisponible : aucun rang officiel ne peut être confirmé/);
 assert.match(s,/renderLeagueStanding\(panel,null,team\)/);
 assert.match(s,/appendSourcedSportContext\(section,team\.code\)/);
 assert.match(s,/if\(id!==seq\|\|ctrl\.signal\.aborted\|\|!root\.isConnected\)return/);
 assert.doesNotMatch(s,/fakeRank|lastKnownRank|window\.open|href='https:/);
});
test('step62: public news cannot be silently created by a source-review tool',()=>{
 const review=read('admin-sport-source-review.mjs');
 const source=read('sport-source-review.mjs');
 assert.doesNotMatch(review+source,
  /admin_save_news|staff_save_news_article|staff_save_match|admin_save_league_standings|\.upsert\(|\.insert\(|\.delete\(|\.update\(/);
 assert.match(review,/consent_reviewed===true/);
 assert.match(review,/clubPublicationPerformed:false/);
});
