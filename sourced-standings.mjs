/** Source-qualified form and archived standings. No invented current ranking. */
import {publicExternalFixtures} from './external-match-previews.mjs';
export const ARCHIVED_LEAGUE_POSITIONS=Object.freeze({
 a:Object.freeze({
  season:'2025-2026',competition:'Seniors D4 · Poule A',
  position:2,played:18,wins:14,draws:1,losses:3,
  points:43,goals_for:64,goals_against:24,
  source:'https://thefootdata.com/clubs/usjto-ukraine?equipe=204300-SEM-1&saison=2025'}),
 b:Object.freeze({
  season:'2025-2026',competition:'Seniors D4 · Poule B',
  position:5,played:14,wins:3,draws:3,losses:8,
  points:12,goals_for:31,goals_against:64,
  source:'https://thefootdata.com/clubs/boissy-uj?equipe=25504-SEM-2&saison=2025'})
});
export function knownClubSeasonForm(code,{season='2026-2027'}={}){
 const competitions={
  '2026-2027':{
   a:'Seniors D3 · Poule B',b:'Seniors D4 · Poule C',
   veterans:'Anciens D3 · Poule C',futsal:'Senior futsal D2 · Poule B'},
  '2025-2026':{
   a:'Seniors D4 · Poule A',b:'Seniors D4 · Poule B',futsal:'Senior futsal D1'}
 };
 const competition=competitions[season]?.[code];
 if(!competition)return null;
 const eligible=publicExternalFixtures({team:code,season,includePast:true,period:'all'})
  .filter(x=>x.status==='played'&&x.competition===competition&&
   Number.isInteger(x.home_score)&&Number.isInteger(x.away_score));
 if(!eligible.length)return null;
 const stats={played:0,wins:0,draws:0,losses:0,goals_for:0,goals_against:0,points:0};
 for(const x of eligible){
  const scored=x.is_home?x.home_score:x.away_score;
  const conceded=x.is_home?x.away_score:x.home_score;
  stats.played++;stats.goals_for+=scored;stats.goals_against+=conceded;
  if(scored>conceded)stats.wins++;else if(scored<conceded)stats.losses++;else stats.draws++;
 }
 stats.points=3*stats.wins+stats.draws;
 const sources=[...new Set(eligible.map(x=>x.source))];
 return Object.freeze({...stats,season,sources,competition,partial:true});
}

const e=(tag,cls='',value=null)=>{const n=document.createElement(tag);
 if(cls)n.className=cls;if(value!==null)n.textContent=String(value);return n;};
export function appendSourcedSportContext(container,teamCode,{includeCurrent=true}={}){
 const current=knownClubSeasonForm(teamCode,{season:'2026-2027'});
 const archive=ARCHIVED_LEAGUE_POSITIONS[teamCode];
 const group=e('div','sourced-standings-context');
 if(current&&includeCurrent){
  const card=e('section','sourced-standings-partial');
  card.append(e('h3','','Bilan partiel 2026–2027 · championnat'));
  const dl=e('dl','sourced-standings-stat-grid');
  for(const [label,value] of [['Matchs connus',current.played],['Victoires',current.wins],
   ['Nuls',current.draws],['Défaites',current.losses],['Points sur ces matchs',current.points],
   ['Buts pour',current.goals_for],['Buts contre',current.goals_against]]){
   const row=e('div');row.append(e('dt','',label),e('dd','',value));dl.append(row);
  }card.append(dl);
  card.append(e('p','league-source','Bilan calculé à partir des seuls scores de championnat retrouvés chez des tiers. Il peut manquer des matchs, des pénalités et les résultats des adversaires. Ce n’est ni le classement actuel, ni un rang officiel.'));
  card.append(e('small','sourced-standings-attribution',
   'Sources des résultats : SportCorico / TheFootData · données à confirmer par le club.'));
  group.append(card);
 }
 if(archive){
  const card=e('section','sourced-standings-archive');
  card.append(e('h3','','Archive 2025–2026 · '+archive.competition));
  card.append(e('p','sourced-standings-rank',archive.position+'e place · '+archive.points+' points'));
  card.append(e('p','league-source',archive.played+' matchs · '+archive.wins+' V / '+archive.draws+
   ' N / '+archive.losses+' D · '+archive.goals_for+' BP / '+archive.goals_against+
   ' BC. Saison terminée : ce rang ne représente pas la saison 2026–2027.'));
  card.append(e('small','sourced-standings-attribution',
   'Source du classement historique : TheFootData · archive de la saison 2025–2026.'));
  group.append(card);
 }
 if(group.children.length)container.append(group);
 else if(includeCurrent)container.append(e('p','league-source',
   'Aucun classement complet ni bilan actuel confirmé pour cette équipe. Le club doit publier sa poule et ses statistiques réelles.'));
}
