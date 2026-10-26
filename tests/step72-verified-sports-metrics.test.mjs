import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getTeamCompetitionSummary,validateCompetitionFormRows} from '../team-stats.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610260011_verified_competition_stats.sql');
const form=read('team-stats.mjs'),editor=read('admin-league.mjs'),standings=read('league-standings.mjs');
const row={team_id:'team-a',code:'a',name:'Seniors A',division:'D3',season_id:'season-26',
 season_label:'2026/2027',competition_kind:'league',played:3,wins:2,draws:1,losses:0,
 goals_for:6,goals_against:2};

test('security-invoker stats only count published and played matches, isolated by season and competition',()=>{
 assert.match(sql,/create or replace view public\.team_competition_form_summary\s+with \(security_invoker=true\)/);
 assert.match(sql,/from public\.matches m[\s\S]*?join public\.club_teams t/);
 assert.match(sql,/left join public\.club_seasons s on s\.id=m\.season_id/);
 assert.match(sql,/where m\.published=true and m\.match_status='played'/);
 assert.match(sql,/m\.home_score is not null and m\.away_score is not null/);
 assert.match(sql,/m\.competition_kind in \('league','cup','friendly'\)/);
 assert.match(sql,/group by t\.id,t\.code,t\.name,t\.division,m\.season_id,s\.label,m\.competition_kind/);
 assert.match(sql,/revoke all on public\.team_competition_form_summary from public,anon,authenticated/);
 assert.match(sql,/grant select on public\.team_competition_form_summary to anon,authenticated/);
 assert.doesNotMatch(sql,/create policy|insert into|update public\.matches|delete from public\.matches/);
});

test('home and away goals and W/D/L are aggregated from club point of view',()=>{
 assert.match(sql,/m\.is_home and m\.home_score>m\.away_score/);
 assert.match(sql,/not m\.is_home and m\.away_score>m\.home_score/);
 assert.match(sql,/m\.home_score=m\.away_score/);
 assert.match(sql,/m\.is_home and m\.home_score<m\.away_score/);
 assert.match(sql,/not m\.is_home and m\.away_score<m\.home_score/);
 assert.match(sql,/case when m\.is_home then m\.home_score else m\.away_score end/);
 assert.match(sql,/case when m\.is_home then m\.away_score else m\.home_score end/);
});

test('validate distinct and internally consistent competition/season form without fabricated stats',()=>{
 const cup={...row,competition_kind:'cup',played:1,wins:0,draws:1,losses:0,goals_for:1,goals_against:1};
 const historical={...row,season_id:'season-25',season_label:'2025/2026'};
 assert.equal(validateCompetitionFormRows([row,cup,historical]).length,3);
 assert.equal(validateCompetitionFormRows([]).length,0);
 assert.throws(()=>validateCompetitionFormRows([row,row]),/Duplicate/);
 assert.throws(()=>validateCompetitionFormRows([{...row,played:4}]),/Inconsistent/);
 assert.throws(()=>validateCompetitionFormRows([{...row,wins:-1}]),/Invalid/);
 assert.throws(()=>validateCompetitionFormRows([{...row,competition_kind:'unspecified'}]),/classification/);
 assert.throws(()=>validateCompetitionFormRows([{...row,code:'unknown'}]),/classification/);
 assert.throws(()=>validateCompetitionFormRows([{...row,season_label:'2026-2027'}]),/classification/);
 assert.throws(()=>validateCompetitionFormRows([{...row,played:0,wins:0,draws:0,losses:0}]),/Inconsistent/);
 const legacy={...row,season_id:null,season_label:null};
 assert.equal(validateCompetitionFormRows([legacy])[0].season_id,null);
});

test('public breakdown URL reads only grouped published scores without players or private identities',async()=>{
 const requests=[];
 const fetcher=async(url,options)=>{
  requests.push({url,options});
  return {ok:true,json:async()=>[row,{...row,competition_kind:'cup',played:1,wins:1,draws:0,losses:0}]};
 };
 const list=await getTeamCompetitionSummary({fetcher});
 assert.equal(list.length,2);
 assert.equal(list[0].wins,2);
 assert.equal(requests[0].options.method,'GET');
 assert.match(requests[0].url,/\/rest\/v1\/team_competition_form_summary\?/);
 assert.match(requests[0].url,/season_label/);
 assert.match(requests[0].url,/competition_kind/);
 assert.doesNotMatch(requests[0].url,/app_private|auth\.users|updated_by|profiles|callups|player_user_id/);
});

test('public team totals explicitly separate all-season form from per-season competition breakdown',()=>{
 assert.match(form,/Promise\.allSettled\(\[\s*getTeamSummary/);
 assert.match(form,/getTeamCompetitionSummary\(\{signal:ctrl\.signal\}\)/);
 assert.match(form,/Total : toutes saisons et compétitions publiées/);
 assert.match(form,/Résultats par saison et compétition/);
 assert.match(form,/season_label\|\|'Saison non renseignée'/);
 assert.match(form,/competitionNames\[x\.competition_kind\]/);
 assert.match(form,/Détail Championnat\/Coupe temporairement indisponible/);
 assert.match(form,/Aucun résultat détaillé validé pour le moment/);
 assert.match(form,/Ne constitue pas un classement officiel FFF/);
});

test('published whole-league standings require a season and cannot represent friendly-only Seniors C',()=>{
 assert.match(sql,/check \(not published or season_id is not null\)/);
 assert.match(sql,/create trigger published_league_scope_guard/);
 assert.match(sql,/before insert or update on public\.team_league_standings/);
 assert.match(sql,/if v_code='c' then/);
 assert.match(sql,/Friendly-only Seniors C has no championship table/);
 assert.match(sql,/revoke all on function app_private\.validate_published_league_scope\(\)/);
 assert.match(editor,/publish\.checked&&\(!payload\.p_season_id/);
 assert.match(editor,/teams\.find\(t=>t\.id===payload\.p_team_id\)\?\.code==='c'/);
 assert.match(editor,/Le classement est un tableau complet saisi et contrôlé par le club/);
 assert.match(editor,/api\.rpc\('admin_save_league_standings',payload\)/);
});

test('public ranking discloses its actual season without inventing a current-season rank',()=>{
 assert.match(standings,/import \{loadPublicSeasons\} from '\.\/season-workspace\.mjs'/);
 assert.match(standings,/loadPublicSeasons\(deadline\.signal\)\.catch\(\(\)=>\[\]\)/);
 assert.match(standings,/renderLeagueStanding\(panel,standing,team,seasonLabels\.get\(standing\?\.season_id\)\|\|null\)/);
 assert.match(standings,/Saison : /);
 assert.match(standings,/non vérifiable actuellement/);
 assert.doesNotMatch(standings,/Rang 2026–2027 non vérifié/);
 assert.match(standings,/Aucun classement de poule publié par le club/);
 assert.doesNotMatch(sql,/insert into public\.team_league_standings|insert into public\.matches|insert into public\.club_seasons/);
});
