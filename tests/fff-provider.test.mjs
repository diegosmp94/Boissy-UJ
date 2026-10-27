import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FFF_CLUB_AFFILIATION,FFF_PUBLIC_PORTAL,FFF_FEED_STATUS,previewAuthorizedFffFeed} from '../fff-provider.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sample={
 schema_version:1,club_affiliation:'548423',
 matches:[{match_id:'2026-match-1',team_code:'a',opponent:'Club invité',
  start_at:'2026-11-01T15:00:00+01:00',venue:'Stade confirmé par le club',
  is_home:true,status:'scheduled',source_url:'https://epreuves.fff.fr/competition/club/verify'}]
};
test('FFF connector is disabled by default and targets only the verified Boissy UJ affiliation',()=>{
 assert.equal(FFF_CLUB_AFFILIATION,'548423');
 assert.equal(FFF_PUBLIC_PORTAL,'https://epreuves.fff.fr/');
 assert.equal(FFF_FEED_STATUS,'access-not-granted');
 const matches=previewAuthorizedFffFeed(sample);
 assert.equal(matches.length,1);
 assert.deepEqual(matches[0],{
  external_id:'2026-match-1',team_code:'a',opponent_name:'Club invité',
  scheduled_at:'2026-11-01T14:00:00.000Z',venue:'Stade confirmé par le club',
  is_home:true,match_status:'scheduled',home_score:null,away_score:null,
  source_kind:'fff',source_reference:'https://epreuves.fff.fr/competition/club/verify'
 });
});
test('unlicensed or malformed club/feed/team data is rejected with no partial import',()=>{
 const reject=x=>assert.throws(()=>previewAuthorizedFffFeed(x),/Flux FFF non conforme/);
 reject({...sample,club_affiliation:'500651'});
 reject({...sample,schema_version:2});
 reject({...sample,matches:[{...sample.matches[0],team_code:'senior-futsal'}]});
 reject({...sample,matches:[{...sample.matches[0],team_code:'unknown'}]});
 reject({...sample,matches:[sample.matches[0],sample.matches[0]]});
 reject({...sample,matches:[{...sample.matches[0],extra_private_player_id:'123'}]});
 reject({...sample,matches:[{...sample.matches[0],source_url:'https://fff.fr.evil.example/match'}]});
 reject({...sample,matches:[{...sample.matches[0],source_url:'http://epreuves.fff.fr/match'}]});
 reject({...sample,matches:[{...sample.matches[0],source_url:'https://api-dofa.fff.fr/api/clubs/1/calendrier'}]});
 reject({...sample,matches:[{...sample.matches[0],status:'played',home_score:null,away_score:null}]});
 reject({...sample,matches:[{...sample.matches[0],status:'scheduled',home_score:1}]});
 reject({...sample,matches:[{...sample.matches[0],start_at:'not a date'}]});
 reject({...sample,matches:[{...sample.matches[0],opponent:'X'}]});
});
test('futsal team remains named by the site; preview supports all five team codes',()=>{
 for(const team_code of ['a','b','c','veterans','futsal']){
  const data={...sample,matches:[{...sample.matches[0],team_code}]};
  assert.equal(previewAuthorizedFffFeed(data)[0].team_code,team_code);
 }
});
test('admin preview never writes, fetches unofficial endpoints, or bypasses MFA',()=>{
 const js=read('admin-management.mjs'),css=read('admin-console.css'),adapter=read('fff-provider.mjs');
 assert.match(js,/import \{previewAuthorizedFffFeed/);
 assert.match(js,/mountFffPreview\(root,api,userId,\{/);
 assert.match(js,/if\(!await guarded\(api,userId\)\)/);
 assert.match(js,/Aucun accès API FFF configuré/);
 assert.match(js,/JSON\.parse\(input\.value\)/);
 assert.match(css,/\.admin-fff-preview>summary:focus-visible/);
 assert.doesNotMatch(adapter,/(?:fetch\(|XMLHttpRequest|Authorization:|sb_secret_|service_role|api-dofa\.fff\.fr)/);
});
