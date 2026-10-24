import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CLUB_TEAMS,teamRoute} from '../club-teams.mjs';
import {TEAM_SUBPAGE_SECTIONS,teamSubpageRoute,resolveTeamSubpageRoute,teamSubpageNavigation} from '../team-subpages.mjs';
import {loadTeamPublicExtras} from '../team-profile-data.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('app.js'),css=read('team-subpages.css'),html=read('index.html');

test('all five squads have exactly three canonical public subpages',()=>{
 assert.equal(CLUB_TEAMS.length,5);
 assert.deepEqual(TEAM_SUBPAGE_SECTIONS.map(s=>s.id),['joueurs','matchs','actualites']);
 const links=CLUB_TEAMS.flatMap(team=>TEAM_SUBPAGE_SECTIONS.map(section=>
  teamSubpageRoute(team,section.id)));
 assert.equal(links.length,15);
 assert.equal(new Set(links).size,15);
 for(const team of CLUB_TEAMS){
  for(const section of TEAM_SUBPAGE_SECTIONS){
   const route=teamSubpageRoute(team,section.id);
   assert.equal(route,teamRoute(team)+'/'+section.id);
   assert.deepEqual(resolveTeamSubpageRoute(route.slice(1)),{team,section:section.id});
  }
  const nav=teamSubpageNavigation(team,'joueurs');
  assert.equal((nav.match(/href="#\/equipes\//g)||[]).length,4);
  assert.equal((nav.match(/aria-current="page"/g)||[]).length,1);
  assert.match(nav,/Joueurs<\/a>/);
  assert.match(nav,/Matchs<\/a>/);
  assert.match(nav,/Actualités<\/a>/);
 }
 assert.equal(CLUB_TEAMS.find(t=>t.code==='futsal').name,'Senior');
 assert.equal(teamSubpageRoute(CLUB_TEAMS.find(t=>t.code==='futsal'),'joueurs'),
  '#/equipes/futsal/boissy-uj-futsal/joueurs');
});

test('untrusted team code, extra segments or unknown section cannot be resolved',()=>{
 const known=CLUB_TEAMS[0];
 for(const key of ['admin','joueur','../joueurs','matchs/../admin','actualités','']){
  assert.throws(()=>teamSubpageRoute(known,key),/inconnue/);
 }
 assert.throws(()=>teamSubpageRoute({...known,code:'other'},'joueurs'),/inconnue/);
 assert.throws(()=>teamSubpageNavigation({name:'Fake',code:'other'}),/inconnue/);
 for(const url of [
  '/equipes/football/seniors-a/joueurs/edit',
  '/equipes/football/seniors-a/admin',
  '/equipes/football/seniors-b/actualites/../../admin',
  '/equipes/futsal/boissy-uj-futsal/actualites/private',
  '/equipes/football/boissy-uj-futsal/joueurs'
 ]) assert.equal(resolveTeamSubpageRoute(url),null);
});

test('subpage navigation marks only its own active route',()=>{
 const t=CLUB_TEAMS[1];
 for(const id of ['presentation',...TEAM_SUBPAGE_SECTIONS.map(s=>s.id)]){
  const nav=teamSubpageNavigation(t,id);
  const current=id==='presentation'?teamRoute(t):teamSubpageRoute(t,id);
  assert.match(nav,new RegExp('href="'+current+'" aria-current="page"'));
  assert.equal((nav.match(/aria-current="page"/g)||[]).length,1);
 }
});

test('app registers 15 distinct routes and mounts only relevant content per section',()=>{
 assert.match(app,/const teamSubpageRoutes=Object.fromEntries\(teams\.flatMap/);
 assert.match(app,/\.\.\.teamSubpageRoutes,\.\.\.teamRoutes\}/);
 assert.match(app,/resolveTeamSubpageRoute\(path\)/);
 assert.match(app,/activeSubpage\?\.section==='matchs'/);
 assert.match(app,/activeSubpage\?\.section==='joueurs'/);
 assert.match(app,/mountTeamPublicExtras\(activeTeam\.code,\{view:'players'\}\)/);
 assert.match(app,/mountTeamProfile\(activeTeam\.code\)/);
 assert.match(app,/activeSubpage\?\.section==='actualites'/);
 assert.match(app,/mountNews\(activeSubpage\?\.team\.code\|\|route\.teamCode\)/);
 assert.match(app,/\(!activeSubpage\|\|activeSubpage\.section==='matchs'\)/);
 assert.match(app,/id="team-profile-live"/);
 assert.match(app,/id="news-feed-public"/);
 assert.match(app,/id="team-profile-extras"/);
 assert.match(app,/teamSubpageNavigation\(team,section\)/);
 assert.match(app,/teamSubpageRoute\(t,'joueurs'\)/);
 assert.match(app,/teamSubpageRoute\(team,'actualites'\)/);
 assert.match(html,/href="\.\/team-subpages\.css"/);
 assert.match(css,/@media\(max-width:640px\)/);
 assert.match(css, /\.team-subpage-navigation a\[aria-current="page"\]/);
});

test('players-only reader fetches no metrics or news and enforces published + consented filters',async()=>{
 const team=CLUB_TEAMS.find(t=>t.code==='a');
 const calls=[];
 const people=[
  {team_id:'test-uuid',id:'authorized',person_kind:'player',
   published:true,consent_confirmed:true,display_name:'Exemple publié'},
  {team_id:'test-uuid',id:'draft',person_kind:'player',
   published:false,consent_confirmed:true,display_name:'Brouillon'},
  {team_id:'foreign-uuid',id:'foreign',person_kind:'player',
   published:true,consent_confirmed:true,display_name:'Autre équipe'}
 ];
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  if(url.includes('/club_teams?'))return {ok:true,json:async()=>[{id:'test-uuid',code:team.code,discipline:team.discipline}]};
  if(url.includes('/team_public_people?'))return {ok:true,json:async()=>people};
  throw new Error('Unexpected endpoint: '+url);
 };
 const result=await loadTeamPublicExtras(team.code,{onlyPeople:true,fetcher});
 assert.equal(result.configured,true);
 assert.deepEqual(result.people.map(p=>p.display_name),['Exemple publié']);
 assert.equal(result.metrics,null);
 assert.deepEqual(result.news,[]);
 assert.deepEqual(result.errors,[]);
 assert.equal(calls.length,2);
 const url=calls[1].url;
 for(const param of ['team_id=eq.test-uuid','published=eq.true','consent_confirmed=eq.true'])
  assert.ok(url.includes(param),param);
 assert.ok(calls.every(c=>c.options.method==='GET'));
 assert.doesNotMatch(calls.map(x=>x.url).join('\n'),/news_posts|team_form_summary|profiles|user_roles|auth\.users/);
});
