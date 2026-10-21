import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CLUB_TEAMS} from '../club-teams.mjs';
import {parsePublicRoute,teamDeepLink} from '../team-links.mjs';
import {filterNews} from '../media-center.mjs';
import {filterPublishedFixtures} from '../sport-center.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('app.js'),sport=read('sport-center.mjs'),media=read('media-center.mjs');
test('deep links are valid and do not admit untrusted team codes',()=>{
 for(const t of CLUB_TEAMS){
  for(const section of ['matchs','actualites']){
   const hash=teamDeepLink(section,t.code);
   assert.deepEqual(parsePublicRoute(hash),{path:'/'+section,teamCode:t.code});
  }
 }
 assert.equal(teamDeepLink('matchs','futsal'),'#/matchs?equipe=futsal');
 assert.throws(()=>teamDeepLink('matchs','unknown'),/inconnu/);
 assert.throws(()=>teamDeepLink('admin','a'),/inconnu/);
 assert.equal(parsePublicRoute('#/actualites?equipe=admin').teamCode,null);
 assert.equal(parsePublicRoute('#/actualites?equipe=futsal%3Cscript%3E').teamCode,null);
 assert.deepEqual(parsePublicRoute('#/equipes/football/seniors-a'),{path:'/equipes/football/seniors-a',teamCode:null});
});
test('route parser does not accidentally redirect team-specific hash URLs to homepage',()=>{
 assert.deepEqual(parsePublicRoute('#/matchs?equipe=a'),{path:'/matchs',teamCode:'a'});
 assert.deepEqual(parsePublicRoute('#/actualites?equipe=veterans'),{path:'/actualites',teamCode:'veterans'});
 assert.deepEqual(parsePublicRoute('#/'),{path:'/',teamCode:null});
 assert.deepEqual(parsePublicRoute(''),{path:'/',teamCode:null});
 assert.match(app,/const route=parsePublicRoute\(location.hash\)/);
 assert.match(app,/if\(path==='\/matchs'\) void mountSport\(route.teamCode\)/);
 assert.match(app,/if\(path==='\/actualites'\) void mountNews\(route.teamCode\)/);
});
test('profile links route to scoped results and scoped editorial feed',()=>{
 assert.match(app,/teamDeepLink\('matchs',team.code\)/);
 assert.match(app,/teamDeepLink\('actualites',team.code\)/);
 assert.match(read('team-profile-data.mjs'),/teamDeepLink\('actualites',teamCode\)/);
 assert.match(read('index.html'),/team-deep-links\.css/);
});
test('news search filters by actual UUID as well as category and query',()=>{
 const posts=[
  {id:'a',team_id:'football-id',content_kind:'article',title:'Seniors A',excerpt:'Victoire',body:''},
  {id:'b',team_id:'futsal-id',content_kind:'video',title:'Futsal',excerpt:'Victoire',body:''},
  {id:'c',team_id:null,content_kind:'article',title:'Club',excerpt:'Programme',body:''}
 ];
 assert.deepEqual(filterNews(posts,{teamId:'futsal-id'}).map(p=>p.id),['b']);
 assert.deepEqual(filterNews(posts,{teamId:'football-id',query:'victoire'}).map(p=>p.id),['a']);
 assert.deepEqual(filterNews(posts,{teamId:'futsal-id',kind:'article'}),[]);
 assert.deepEqual(filterNews(posts,{teamId:'__unavailable__'}),[]);
 assert.equal(filterNews(posts).length,3);
});
test('news team filter fetches only public posts, read-only team metadata, and never guesses mapping',()=>{
 assert.match(media,/select:'id,team_id,slug,title,excerpt,body,content_kind,published_at'/);
 assert.match(media,/status:'eq.published'/);
 assert.match(media,/visibility:'eq.public'/);
 assert.match(media,/consent_reviewed:'eq.true'/);
 assert.match(media,/TEAM_BASE/);
 assert.match(media,/select:'id,code,name,discipline'/);
 assert.match(media,/new Map\(teams.map\(t=>\[t.id,t\]\)\)/);
 assert.match(media,/Filtrer les actualités par équipe/);
 assert.match(media,/teamSelect.addEventListener\('change',update\)/);
 assert.match(media,/Aucune actualité d’une autre équipe ne sera affichée/);
 assert.doesNotMatch(media,/innerHTML\s*=|method:'POST'/);
});
test('Match Center prefills both discipline and exact requested team, preserving isolation',()=>{
 assert.match(sport,/function displayFixtures\(root,teams,matches,seasons=\[\],initialTeamCode=null\)/);
 assert.match(sport,/requested=teams.find\(t=>t.code===initialTeamCode\)/);
 assert.match(sport,/disciplineSelect.value=requested.discipline/);
 assert.match(sport,/select.value=requested.id/);
 assert.match(sport,/export async function mountSport\(initialTeamCode=null\)/);
 const teams=[{id:'football-id',discipline:'football'},{id:'futsal-id',discipline:'futsal'}];
 const matches=[{team_id:'football-id',id:'one'},{team_id:'futsal-id',id:'two'}];
 assert.deepEqual(filterPublishedFixtures(matches,{teamId:'futsal-id',discipline:'futsal',teams}).map(m=>m.id),['two']);
 assert.deepEqual(filterPublishedFixtures(matches,{teamId:'football-id',discipline:'futsal',teams}),[]);
});
test('match and news cards offer accurate per-team profile links without personal data',()=>{
 assert.match(sport,/teamRoute\(team\)/);
 assert.match(media,/a.href=teamRoute\(known\)/);
 assert.doesNotMatch(sport+media,/user_roles|staff_team_assignments|team_player_memberships|service_role/);
 assert.match(read('team-deep-links.css'),/@media\(min-width:761px\)/);
 assert.match(read('team-deep-links.css'),/@media\(prefers-reduced-motion:reduce\)/);
});
