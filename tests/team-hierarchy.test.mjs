import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CLUB_TEAMS,DISCIPLINES,categoryRoute,teamRoute,resolveTeamRoute} from '../club-teams.mjs';
import {loadTeamPublishedMatches,groupTeamResults} from '../team-pages.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const html=read('index.html'),app=read('app.js'),css=read('team-pages.css');
const a=CLUB_TEAMS.find(t=>t.code==='a');
const futsal=CLUB_TEAMS.find(t=>t.code==='futsal');
test('two category pages and five unique deep-linked team pages',()=>{
 assert.equal(DISCIPLINES.length,2);
 assert.deepEqual(DISCIPLINES.map(d=>categoryRoute(d.id)),['#/equipes/football','#/equipes/futsal']);
 assert.equal(new Set(CLUB_TEAMS.map(teamRoute)).size,5);
 assert.equal(teamRoute(a),'#/equipes/football/seniors-a');
 assert.equal(teamRoute(futsal),'#/equipes/futsal/boissy-uj-futsal');
 for(const d of DISCIPLINES)assert.deepEqual(resolveTeamRoute(categoryRoute(d.id).slice(1)),
  {kind:'category',discipline:d.id,team:null});
 for(const team of CLUB_TEAMS)assert.equal(resolveTeamRoute(teamRoute(team).slice(1))?.team?.code,team.code);
 assert.equal(resolveTeamRoute('/equipes/admin'),null);
 assert.equal(resolveTeamRoute('/equipes/football/boissy-uj-futsal'),null);
});
test('desktop menu has premium hover trigger and working navigation links',()=>{
 assert.match(html,/id="desktop-team-nav"/);
 assert.match(html,/id="desktop-teams-trigger" aria-controls="desktop-teams-submenu" aria-expanded="false"/);
 assert.doesNotMatch(html,/id="desktop-teams-toggle"|aria-label="Afficher les sous-pages des équipes"/);
 assert.match(html,/id="desktop-teams-submenu"[^>]*hidden/);
 assert.match(html,/class="desktop-teams-surface"/);
 for(const d of DISCIPLINES)assert.ok(html.includes('href="'+categoryRoute(d.id)+'"'));
 for(const team of CLUB_TEAMS)assert.ok(html.includes('href="'+teamRoute(team)+'"'));
 assert.match(html,/Tout voir/);
 assert.match(app,/function openDesktopTeams\(\)/);
 assert.match(app,/function closeDesktopTeams/);
 assert.match(app,/addEventListener\('pointerenter'/);
 assert.match(app,/addEventListener\('pointerleave'/);
 assert.match(app,/addEventListener\('focusin'/);
 assert.match(app,/addEventListener\('focusout'/);
 assert.match(app,/if\(e\.key!=='Escape'\)return/);
 assert.match(css,/\.desktop-teams-submenu\{position:absolute;top:100%/);
 assert.match(css,/@keyframes desktop-teams-reveal/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('mobile nested semantic details and dedicated team quick access',()=>{
 assert.match(html,/<details class="mobile-teams">/);
 assert.equal((html.match(/<details class="mobile-team-discipline">/g)||[]).length,2);
 assert.match(html,/<summary>Football à 11/);
 assert.match(html,/<summary>Futsal/);
 assert.match(html,/data-nav="equipes"/);
 assert.match(css,/\.bottom-nav\{grid-template-columns:repeat\(5,/);
 assert.match(css,/max-height:calc\(100dvh/);
 assert.match(css,/summary:focus-visible/);
});
test('router renders category and team profiles and mounts only team-specific live data',()=>{
 assert.match(app,/const teamRoutes=Object\.fromEntries/);
 assert.match(app,/\.\.\.teamRoutes\}/);
 assert.match(app,/function categoryTeamPage\(discipline\)/);
 assert.match(app,/function singleTeamPage\(team\)/);
 assert.match(app,/const activeTeam=teams\.find/);
 assert.match(app,/mountTeamProfile\(activeTeam\.code\)/);
 assert.match(app,/else \{unmountTeamProfile\(\);unmountTeamPublicExtras\(\);\}/);
 assert.match(app,/team-profile-live/);
 assert.match(app,/team-breadcrumbs/);
 assert.match(app,/teamRoute\(team\)/);
 assert.match(css,/\.team-profile-intro/);
});
test('match request is strictly read-only and scoped to the published team UUID',async()=>{
 const requests=[];
 const fetcher=async(url,options)=>{
  requests.push({url,options});
  if(url.includes('/club_teams?'))return {ok:true,json:async()=>[{id:'uuid-a',code:'a',discipline:'football'}]};
  return {ok:true,json:async()=>[
   {id:'one',team_id:'uuid-a',match_status:'played',scheduled_at:'2026-10-01T15:00:00Z',home_score:2,away_score:1},
   {id:'wrong-team',team_id:'uuid-b',match_status:'played'},
   {id:'cancelled',team_id:'uuid-a',match_status:'cancelled'}
  ]};
 };
 const result=await loadTeamPublishedMatches('a',{fetcher});
 assert.equal(result.configured,true);
 assert.deepEqual(result.matches.map(x=>x.id),['one']);
 assert.equal(requests.length,2);
 assert.ok(requests[0].url.includes('code=eq.a'));
 assert.match(requests[1].url,/team_id=eq.uuid-a/);
 assert.match(requests[1].url,/published=eq.true/);
 for(const request of requests){
  assert.equal(request.options.method,'GET');
  assert.doesNotMatch(request.url,/user_roles|profiles|app_private|callups/);
 }
});
test('unconfigured team never generates fictitious match data',async()=>{
 const fetcher=async()=>({ok:true,json:async()=>[]});
 assert.deepEqual(await loadTeamPublishedMatches('futsal',{fetcher}),{configured:false,matches:[]});
 await assert.rejects(loadTeamPublishedMatches('unknown',{fetcher}),/Équipe inconnue/);
});
test('fixtures are separated by publication state, status and ordering',()=>{
 const rows=[
  {id:'p1',match_status:'played',scheduled_at:'2026-09-15T15:00:00Z'},
  {id:'p2',match_status:'played',scheduled_at:'2026-10-15T15:00:00Z'},
  {id:'s1',match_status:'scheduled',scheduled_at:'2026-11-12T15:00:00Z'},
  {id:'s2',match_status:'postponed',scheduled_at:'2026-11-01T15:00:00Z'}
 ];
 const grouped=groupTeamResults(rows);
 assert.deepEqual(grouped.upcoming.map(x=>x.id),['s2','s1']);
 assert.deepEqual(grouped.played.map(x=>x.id),['p2','p1']);
 assert.doesNotMatch(read('team-pages.mjs'),/innerHTML\s*=|\.insert\(|\.update\(|method:'POST'/);
 assert.match(read('team-pages.mjs'),/item\.textContent=String\(value\)/);
});
test('home and directory cards navigate to individual profiles',()=>{
 assert.match(app,/href="\$\{teamRoute\(team\)\}" aria-label="Découvrir/);
 assert.match(app,/team-detail-link/);
 assert.match(app,/categoryRoute\(groupTeams\[0\]\.discipline\)/);
 assert.match(html,/team-pages\.css/);
 assert.match(read('auth-config.mjs'),/adminEnabled:\s*false/);
});
