import { supabaseConfig } from './auth-config.mjs';
import {boundedPublicRequest} from './public-catalog-timeout.mjs';
import {CLUB_TEAMS,teamRoute} from './club-teams.mjs';
import {publicExternalFixtures} from './external-match-previews.mjs';
import {clubOutcome} from './league-standings.mjs';
import {victoryCongratulations,collectiveVictoryCongratulations} from './victory-congratulations.mjs';
import {createVictoryNotice} from './victory-notice.mjs';
import {buildCompetitionTabs,competitionKind,cupInformation} from './competition-tabs.mjs';
import {publishedMatchParams,filterPublishedMatchRows,unconfirmedWithoutClubDecision,watchPublicSportsRefresh} from './public-sports-sync.mjs';

const ENDPOINT = supabaseConfig.url + '/rest/v1/';
/* Fallback de présentation uniquement, sans rencontre inventée.
   Ces identités correspondent aux catégories confirmées dans le cahier des charges. */
const FALLBACK_TEAMS = Object.freeze([
  { id:'pending-a', code:'a', name:'Seniors A', division:'Départemental 3', discipline:'football' },
  { id:'pending-b', code:'b', name:'Seniors B', division:'Départemental 4', discipline:'football' },
  { id:'pending-c', code:'c', name:'Seniors C', division:'Matchs amicaux', discipline:'football' },
  { id:'pending-veterans', code:'veterans', name:'Vétérans', division:'Départemental 3',discipline:'football' },
  { id:'pending-futsal',code:'futsal',name:'Senior',division:'Départemental 2',discipline:'futsal' }
]);

let currentRequest;
let renderGeneration = 0;
let refreshCleanup=null;

function element(tag, className = '', text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== null) node.textContent = String(text);
  return node;
}
export function splitMatches(matches) {
  const upcoming = matches.filter(m => m.match_status !== 'played')
    .sort((a,b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
  const results = matches.filter(m => m.match_status === 'played')
    .sort((a,b) => Date.parse(b.scheduled_at) - Date.parse(a.scheduled_at));
  const cancelled = matches.filter(m=>m.match_status==='cancelled')
    .sort((a,b)=>Date.parse(b.scheduled_at)-Date.parse(a.scheduled_at));
  return {upcoming:upcoming.filter(m=>m.match_status!=='cancelled'),results,cancelled};
}
export function filterPublishedFixtures(matches, {teamId='all',seasonId='all',discipline='all',teams=[]}={}) {
  const disciplineMap=new Map(teams.map(t=>[t.id,t.discipline]));
  return matches.filter(match => (teamId==='all'||match.team_id===teamId)
    && (seasonId==='all'||match.season_id===seasonId)
    && (discipline==='all'||disciplineMap.get(match.team_id)===discipline));
}
export function scoreLabel(match) {
  return match.match_status === 'played'
    && Number.isInteger(match.home_score)
    && Number.isInteger(match.away_score)
    ? String(match.home_score) + ' – ' + String(match.away_score) : 'VS';
}
export function statusLabel(status) {
  return ({
    scheduled:'À venir', played:'Terminé', postponed:'Reporté', cancelled:'Annulé'
  })[status] || 'À confirmer';
}
function dateLabel(value) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Date à confirmer';
  return new Intl.DateTimeFormat('fr-FR', {
    day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',
    timeZone:'Europe/Paris'
  }).format(new Date(value));
}
async function getRows(table, params, signal, fetcher=fetch) {
  const url=ENDPOINT + table + '?' + new URLSearchParams(params);
  const response=await fetcher(url,{
    method:'GET',signal,cache:'no-store',
    headers:{'apikey':supabaseConfig.publishableKey,'Accept':'application/json'}
  });
  if (!response.ok) throw new Error('Source sportive indisponible');
  const rows=await response.json();
  if (!Array.isArray(rows)) throw new Error('Réponse sportive invalide');
  return rows;
}
/**
 * Each public catalogue is independent: a missing season list must not hide
 * already published matches, and a missing team must not be assigned a
 * fabricated UUID. Unverified teams are display-only placeholders.
 */
export async function loadPublicSportCatalogs(signal,fetcher=fetch){
  const requests=[
    getRows('club_teams',{
      select:'id,code,name,division,source_kind,discipline,sort_order',
      order:'sort_order.asc',limit:'10'
    },signal,fetcher),
    getRows('matches',publishedMatchParams(),signal,fetcher),
    getRows('club_seasons',{select:'id,label,state',order:'label.desc',limit:'100'},signal,fetcher)
  ];
  const settled=await Promise.allSettled(requests);
  if(signal?.aborted)throw new Error('Requête annulée');
  const names=['club_teams','matches','club_seasons'];
  const unavailable=names.filter((_,i)=>settled[i].status==='rejected');
  const remoteTeams=settled[0].status==='fulfilled'?settled[0].value:[];
  const byCode=new Map(),usedIds=new Set();
  for(const row of remoteTeams){
    if(!row||typeof row!=='object')continue;
    const definition=CLUB_TEAMS.find(x=>x.code===row.code);
    if(!definition||row.discipline!==definition.discipline||
       typeof row.id!=='string'||!row.id||usedIds.has(row.id)||byCode.has(row.code))
      continue;
    usedIds.add(row.id);
    byCode.set(row.code,{...row,name:definition.name,discipline:definition.discipline});
  }
  // A partial team catalogue is not evidence that the absent squad has no
  // games. Only retain verified real IDs, never attach games to pending IDs.
  if(byCode.size<CLUB_TEAMS.length&&!unavailable.includes('club_teams'))
    unavailable.push('club_teams');
  const teams=CLUB_TEAMS.map(definition=>
    byCode.get(definition.code)||FALLBACK_TEAMS.find(t=>t.code===definition.code));
  const published=settled[1].status==='fulfilled'?settled[1].value:[];
  const matches=filterPublishedMatchRows(published).filter(match=>usedIds.has(match.team_id));
  const seasons=settled[2].status==='fulfilled'?settled[2].value:[];
  return {teams,matches,seasons,unavailable};
}
function matchCard(match,teamsById) {
  const linked=teamsById.get(match.team_id);
  const club=linked?.name || 'Boissy-UJ';
  const card=element('article','sport-match-card');
  const meta=element('div','sport-match-meta');
  meta.append(
    element('span','sport-pill',match.match_status==='scheduled'&&
      Date.parse(match.scheduled_at)<=Date.now()?'Horaire passé · résultat à confirmer':
      statusLabel(match.match_status)),
    element('span','sport-date',dateLabel(match.scheduled_at))
  );
  const sides=element('div','sport-sides');
  sides.append(
    element('strong','',match.is_home?club:match.opponent_name),
    element('span','sport-score',scoreLabel(match)),
    element('strong','',match.is_home?match.opponent_name:club)
  );
  const outcome=clubOutcome(match);
  if(outcome){
    card.classList.add('sport-result-'+outcome);
    const result=element('span','sport-outcome sport-outcome-'+outcome,
    outcome==='V'?'Victoire':outcome==='D'?'Défaite':'Match nul');
    meta.append(result);}
  const foot=element('div','sport-foot');
  foot.append(element('span','',club));
  if(match.competition_label)foot.append(element('span','sport-competition-label',match.competition_label));
  if (match.venue) foot.append(element('span','',match.venue));
  const team=CLUB_TEAMS.find(t=>t.code===linked?.code);
  if(team){const profile=element('a','sport-team-profile-link','Voir la fiche '+team.name+' ↗');profile.href=teamRoute(team);card.append(profile);}
  card.prepend(meta,sides,foot);
  const celebration=victoryCongratulations(match,linked?.code);
  if(celebration)card.append(createVictoryNotice(celebration));
  return card;
}
function mountEmpty(container,message) {
  const empty=element('div','sport-empty');
  empty.append(element('span','sport-empty-icon','⚽'),element('p','',message));
  container.append(empty);
}
function displayFixtures(root,teams,matches,seasons=[],initialTeamCode=null,{unavailable=[],initialCompetition='league'}={}) {
  root.replaceChildren();
  const map = new Map(teams.map(team=>[team.id,team]));
  const filter=element('div','sport-filter-bar');
  const disciplineLabel=element('label','','Discipline :');
  const disciplineSelect=element('select','sport-team-select');
  disciplineSelect.setAttribute('aria-label','Filtrer les rencontres par discipline');
  for(const [value,name] of [['all','Football & futsal'],['football','Football à 11'],['futsal','Futsal']]){
    const option=element('option','',name);option.value=value;disciplineSelect.append(option);
  }
  disciplineLabel.append(disciplineSelect);
  filter.append(disciplineLabel);
  const label=element('label','', 'Équipe :');
  const select=element('select','sport-team-select');
  select.setAttribute('aria-label','Filtrer les rencontres par équipe');
  function fillTeams(){
    select.replaceChildren();
    const all=element('option','','Toutes les équipes');all.value='all';select.append(all);
    for(const team of teams.filter(t=>disciplineSelect.value==='all'||t.discipline===disciplineSelect.value)){
      const option=element('option','',team.name);
      option.value=team.id;
      select.append(option);
    }
  }
  if(initialTeamCode){
    const requested=teams.find(t=>t.code===initialTeamCode);
    if(requested){disciplineSelect.value=requested.discipline;fillTeams();select.value=requested.id;}
    else fillTeams();
  }else fillTeams();
  label.append(select);
  filter.append(label);
  let seasonSelect=null;
  if(seasons.length){
    const seasonLabel=element('label','','Saison :');
    seasonSelect=element('select','sport-team-select');
    seasonSelect.setAttribute('aria-label','Filtrer les rencontres par saison');
    const any=element('option','','Toutes les saisons');any.value='all';
    seasonSelect.append(any);
    seasons.forEach(season=>{
      const option=element('option','',season.label);
      option.value=season.id;
      seasonSelect.append(option);
    });
    seasonLabel.append(seasonSelect);
    filter.append(seasonLabel);
  }
  filter.append(element('span','sport-count',unavailable.includes('matches')
    ?'Rencontres publiées : source momentanément indisponible'
    :matches.length+' rencontre(s) publiée(s)'));
  const data=element('div','sport-fixtures');
  const thirdParty=element('section','agenda-thirdparty sport-external-fixtures');
  const context=element('div','sport-competition-context');
  const collective=collectiveVictoryCongratulations(matches,teams);
  if(collective)root.append(createVictoryNotice(collective,{collective:true}));
  const legend=element('div','sport-result-legend');
  legend.setAttribute('aria-label','Légende des résultats des rencontres');
  for(const [code,label] of [['V','Victoire'],['N','Match nul'],['D','Défaite']]){
    legend.append(element('span','sport-outcome sport-outcome-'+code,label));
  }
  root.append(filter);
  let activeCompetition=initialCompetition==='cup'?'cup':'league',sourcedSeason='2026-2027';
  buildCompetitionTabs(root,{defaultKind:activeCompetition,onChange:value=>{activeCompetition=value;redraw();}});
  root.append(context,legend,data,thirdParty);
  function redraw(){
    data.replaceChildren();context.replaceChildren();
    const selection=select.value;
    const filtered=filterPublishedFixtures(matches,{
      teamId:selection,seasonId:seasonSelect?.value||'all',
      discipline:disciplineSelect.value,teams
    });
    const categorized=filtered.filter(m=>competitionKind(m)===activeCompetition||
      activeCompetition==='league'&&teams.some(t=>t.id===m.team_id&&t.code==='c')&&competitionKind(m)==='friendly');
    const unclassified=filtered.filter(m=>competitionKind(m)==='unspecified');
    const blocks=splitMatches(categorized);
    const categoryHeading=element('p','team-competition-help',
      activeCompetition==='cup'?'Coupe : uniquement les rencontres identifiées dans une compétition de coupe.':
      'Championnat : rencontres classées en championnat (ou amicaux pour Seniors C).');
    context.append(categoryHeading);
    const selectedTeam=teams.find(t=>t.id===select.value);
    if(activeCompetition==='cup'&&selectedTeam){
      const details=cupInformation(selectedTeam.code,'2026-2027');
      const box=element('aside','team-cup-participation');
      box.append(element('strong','',details.headline),element('p','',details.detail));
      context.append(box);
    }
    if(unclassified.length){
      context.append(element('p','team-competition-unclassified',
        unclassified.length+' rencontre(s) publiée(s) non classée(s). Un administrateur doit indiquer Championnat ou Coupe pour les faire apparaître dans le bon onglet.'));
    }
    thirdParty.replaceChildren();
    for (const [title,list,empty] of [
      ['Rencontres programmées ou reportées',blocks.upcoming,unavailable.includes('matches')
        ?'Calendrier du club momentanément indisponible pour cette équipe.'
        :'Aucune rencontre à venir publiée pour cette équipe.'],
      ['Derniers résultats',blocks.results,unavailable.includes('matches')
        ?'Résultats du club momentanément indisponibles pour cette équipe.'
        :'Aucun résultat publié pour cette équipe.'],
      ['Rencontres annulées',blocks.cancelled,unavailable.includes('matches')
        ?'Annulations momentanément indisponibles.'
        :'Aucune rencontre annulée publiée pour cette équipe.']
    ]) {
      const section=element('section','sport-fixture-group');
      section.append(element('h3','',title));
      const cards=element('div','sport-match-list');
      if(list.length) list.forEach(m=>cards.append(matchCard(m,map)));
      else mountEmpty(cards,empty);
      section.append(cards);
      data.append(section);
    }
    {
      const team=teams.find(t=>t.id===select.value);
      const availableExternal=publicExternalFixtures({
        team:team?.code||'all',discipline:disciplineSelect.value,
        includePast:true,period:'all'
      });
      const external=unconfirmedWithoutClubDecision(availableExternal,matches,teams)
       .filter(m=>(sourcedSeason==='all'||m.season===sourcedSeason)
        &&(competitionKind(m)===activeCompetition||
          activeCompetition==='league'&&m.team_code==='c'&&competitionKind(m)==='friendly'));
      if(availableExternal.length){
        thirdParty.append(element('h2','','Archives des matchs et résultats'));
        const seasonLabel=element('label','sport-source-season-label','Saison : ');
        const seasonControl=element('select','sport-team-select');
        seasonControl.setAttribute('aria-label','Filtrer les archives des matchs par saison');
        for(const [value,label] of [['all','Toutes les saisons'],['2026-2027','2026–2027'],['2025-2026','2025–2026']]){
          const option=element('option','',label);option.value=value;seasonControl.append(option);
        }
        seasonControl.value=sourcedSeason;
        seasonControl.addEventListener('change',()=>{
          sourcedSeason=seasonControl.value;redraw();
        });
        seasonLabel.append(seasonControl);thirdParty.append(seasonLabel);
        thirdParty.append(element('p','agenda-external-note',
          'Ces rencontres restent à confirmer par le club. Les dates et scores peuvent évoluer.'));
        const grid=element('div','agenda-external-grid');
        for(const match of external){
          const card=element('article','agenda-external-card');
          const date=element('time','agenda-date',match.dateOnly
            ?new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeZone:'UTC'}).format(new Date(match.localDay+'T12:00:00Z'))
            :dateLabel(match.time));
          date.dateTime=match.localDay;
          const result=['played','administrative'].includes(match.status)
            ?'Score : '+match.result+' · à confirmer par le club'
            :match.status==='unknown'?'Match passé · résultat non communiqué'
            :match.is_home?'Domicile · à confirmer':'Extérieur · à confirmer';
          card.append(date,element('h3','',match.team_name+' — '+match.opponent),
            element('p','',result),
            element('p','sport-date',match.season+' · '+(match.competition||'Compétition non précisée')));
          if(match.venue)card.append(element('p','sport-date',match.venue));
          if(['played','administrative'].includes(match.status)){
            const win=clubOutcome({...match,match_status:match.status});
            if(win){
              card.classList.add('sport-result-'+win);
              card.append(element('span','sport-outcome sport-outcome-'+win,
                win==='V'?'Victoire':win==='D'?'Défaite':'Match nul'));
            }
          }
          const teamProfile=CLUB_TEAMS.find(t=>t.code===match.team_code);
          if(teamProfile){
            const page=element('a','agenda-link','Fiche '+teamProfile.name+' ↗');
            page.href=teamRoute(teamProfile);card.append(page);
          }
          grid.append(card);
        }
        if(external.length)thirdParty.append(grid);
        else thirdParty.append(element('p','sport-form-empty','Aucune rencontre référencée pour cette saison.'));
      }
    }
  }
  disciplineSelect.addEventListener('change',()=>{fillTeams();redraw()});
  select.addEventListener('change',redraw);
  seasonSelect?.addEventListener('change',redraw);
  redraw();
}
export function unmountSport() {
  renderGeneration++;
  refreshCleanup?.();refreshCleanup=null;
  currentRequest?.abort();
  currentRequest=null;
}
export async function mountSport(initialTeamCode=null,{competition='league'}={}) {
  unmountSport();
  const generation=renderGeneration;
  const root=document.getElementById('match-center-live');
  if(!root) return;
  refreshCleanup=watchPublicSportsRefresh({
   active:()=>generation===renderGeneration&&root.isConnected,
   refresh:()=>void mountSport(initialTeamCode,{competition})
  });
  const abort=new AbortController();
  currentRequest=abort;
  const deadline=boundedPublicRequest(abort.signal);
  root.replaceChildren(element('p','sport-loading','Chargement des informations du club…'));
  try{
    const {teams,matches,seasons,unavailable}=await loadPublicSportCatalogs(deadline.signal);
    if (abort.signal.aborted || generation!==renderGeneration || !root.isConnected) return;
    displayFixtures(root,teams,matches,seasons,initialTeamCode,{unavailable,initialCompetition:competition});
    if(unavailable.length){
      const descriptions=[];
      if(unavailable.includes('club_teams'))
        descriptions.push('Certaines équipes ne sont pas vérifiables pour le moment ; leurs éventuelles rencontres officielles ne sont pas affichées');
      if(unavailable.includes('matches'))
        descriptions.push('Les rencontres publiées par le club sont temporairement indisponibles');
      if(unavailable.includes('club_seasons'))
        descriptions.push('Le filtre des saisons est temporairement indisponible, sans masquer les matchs accessibles');
      const notice=element('p','sport-notice',descriptions.join('. ')+
        '. Les autres rencontres restent consultables, mais ne sont pas confirmées par Boissy UJ.');
      notice.setAttribute('role','status');
      root.prepend(notice);
    }
  } catch(err){
    if (abort.signal.aborted || generation!==renderGeneration || !root.isConnected) return;
    // La migration sportive n'est pas encore présente dans tous les environnements.
    // Conserver l'interface sans annoncer faussement un calendrier vide ou un score.
    displayFixtures(root,FALLBACK_TEAMS,[],[],initialTeamCode,{initialCompetition:competition});
    const notice=element('p','sport-notice',
      'Le calendrier du club n’est pas encore disponible. Présentation des équipes uniquement ; aucun match ni résultat ne peut être confirmé pour le moment.');
    notice.setAttribute('role','status');
    root.prepend(notice);
  }finally{deadline.dispose();}
}
