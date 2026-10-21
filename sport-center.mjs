import { supabaseConfig } from './auth-config.mjs';

const ENDPOINT = supabaseConfig.url + '/rest/v1/';
const TEAM_CODES = ['a','b','c','veterans'];
/* Fallback de présentation uniquement, sans rencontre inventée.
   Ces identités correspondent aux catégories confirmées dans le cahier des charges. */
const FALLBACK_TEAMS = Object.freeze([
  { id:'pending-a', code:'a', name:'Seniors A', division:'Départemental 3' },
  { id:'pending-b', code:'b', name:'Seniors B', division:'Départemental 4' },
  { id:'pending-c', code:'c', name:'Seniors C', division:'Matchs amicaux' },
  { id:'pending-veterans', code:'veterans', name:'Vétérans', division:'Départemental 3' }
]);

let currentRequest;
let renderGeneration = 0;

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
  return {upcoming,results};
}
export function filterPublishedFixtures(matches, {teamId='all',seasonId='all'}={}) {
  return matches.filter(match => (teamId==='all'||match.team_id===teamId)
    && (seasonId==='all'||match.season_id===seasonId));
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
async function getRows(table, params, signal) {
  const url=ENDPOINT + table + '?' + new URLSearchParams(params);
  const response=await fetch(url,{
    method:'GET',signal,cache:'no-store',
    headers:{'apikey':supabaseConfig.publishableKey,'Accept':'application/json'}
  });
  if (!response.ok) throw new Error('Source sportive indisponible');
  const rows=await response.json();
  if (!Array.isArray(rows)) throw new Error('Réponse sportive invalide');
  return rows;
}
function matchCard(match,teamsById) {
  const club=teamsById.get(match.team_id)?.name || 'Boissy-UJ';
  const card=element('article','sport-match-card');
  const meta=element('div','sport-match-meta');
  meta.append(
    element('span','sport-pill',statusLabel(match.match_status)),
    element('span','sport-date',dateLabel(match.scheduled_at))
  );
  const sides=element('div','sport-sides');
  sides.append(
    element('strong','',match.is_home?club:match.opponent_name),
    element('span','sport-score',scoreLabel(match)),
    element('strong','',match.is_home?match.opponent_name:club)
  );
  const foot=element('div','sport-foot');
  const teamLabel=element('span','',club);
  const source=element('span','',match.source_kind === 'fff'
    ? 'Référence FFF fournie par le club · à vérifier'
    : 'Données saisies par le club');
  foot.append(teamLabel,source);
  if (match.venue) foot.append(element('span','',match.venue));
  card.append(meta,sides,foot);
  return card;
}
function mountEmpty(container,message) {
  const empty=element('div','sport-empty');
  empty.append(element('span','sport-empty-icon','⚽'),element('p','',message));
  container.append(empty);
}
function displayFixtures(root,teams,matches,seasons=[]) {
  root.replaceChildren();
  const map = new Map(teams.map(team=>[team.id,team]));
  const filter=element('div','sport-filter-bar');
  const label=element('label','', 'Afficher :');
  const select=element('select','sport-team-select');
  select.setAttribute('aria-label','Filtrer les rencontres par équipe');
  const all=element('option','','Toutes les équipes');
  all.value='all';
  select.append(all);
  for(const team of teams) {
    const option=element('option','',team.name);
    option.value=team.id;
    select.append(option);
  }
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
  filter.append(element('span','sport-count',matches.length+' rencontre(s) publiée(s)'));
  const data=element('div','sport-fixtures');
  root.append(filter,data);
  function redraw(){
    data.replaceChildren();
    const selection=select.value;
    const filtered=filterPublishedFixtures(matches,{
      teamId:selection,seasonId:seasonSelect?.value||'all'
    });
    const blocks=splitMatches(filtered);
    for (const [title,list,empty] of [
      ['Prochaines rencontres',blocks.upcoming,'Aucune rencontre à venir publiée pour cette équipe.'],
      ['Derniers résultats',blocks.results,'Aucun résultat publié pour cette équipe.']
    ]) {
      const section=element('section','sport-fixture-group');
      section.append(element('h3','',title));
      const cards=element('div','sport-match-list');
      if(list.length) list.forEach(m=>cards.append(matchCard(m,map)));
      else mountEmpty(cards,empty);
      section.append(cards);
      data.append(section);
    }
  }
  select.addEventListener('change',redraw);
  seasonSelect?.addEventListener('change',redraw);
  redraw();
}
export function unmountSport() {
  renderGeneration++;
  currentRequest?.abort();
  currentRequest=null;
}
export async function mountSport() {
  unmountSport();
  const generation=renderGeneration;
  const root=document.getElementById('match-center-live');
  if(!root) return;
  const abort=new AbortController();
  currentRequest=abort;
  root.replaceChildren(element('p','sport-loading','Chargement des informations du club…'));
  try{
    const [teams,matches,seasons]=await Promise.all([
      getRows('club_teams',{select:'id,code,name,division,source_kind,sort_order',order:'sort_order.asc'},abort.signal),
      getRows('matches',{select:'id,team_id,season_id,opponent_name,scheduled_at,venue,is_home,home_score,away_score,match_status,source_kind',
        published:'eq.true',order:'scheduled_at.asc',limit:'100'},abort.signal),
      getRows('club_seasons',{select:'id,label,state',order:'label.desc'},abort.signal)
    ]);
    if (abort.signal.aborted || generation!==renderGeneration || !root.isConnected) return;
    const uniqueCodes=new Set(teams.map(t=>t.code));
    if (!TEAM_CODES.every(c=>uniqueCodes.has(c))) throw new Error('Équipes non configurées');
    displayFixtures(root,teams,matches,seasons);
  } catch(err){
    if (abort.signal.aborted || generation!==renderGeneration || !root.isConnected) return;
    // La migration sportive n'est pas encore présente dans tous les environnements.
    // Conserver l'interface sans annoncer faussement un calendrier vide ou un score.
    displayFixtures(root,FALLBACK_TEAMS,[]);
    const notice=element('p','sport-notice',
      'La source du calendrier n’est pas encore disponible. Présentation des équipes uniquement ; aucun match ni résultat ne peut être confirmé pour le moment.');
    notice.setAttribute('role','status');
    root.prepend(notice);
  }
}
