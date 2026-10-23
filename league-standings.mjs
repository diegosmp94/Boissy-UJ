import {appendSourcedSportContext} from './sourced-standings.mjs';
import {supabaseConfig} from './auth-config.mjs';
import {CLUB_TEAMS,teamRoute} from './club-teams.mjs';

export function clubOutcome(match){
 if(match?.match_status==='administrative'&&['V','D'].includes(match.administrative_outcome))
  return match.administrative_outcome;
 if(match?.match_status!=='played'||!Number.isInteger(match.home_score)||
  !Number.isInteger(match.away_score))return null;
 const scored=match.is_home===true?match.home_score:match.away_score;
 const conceded=match.is_home===true?match.away_score:match.home_score;
 return scored>conceded?'V':scored<conceded?'D':'N';
}
export function standingComputed(row){
 const wins=Number(row.wins),draws=Number(row.draws),losses=Number(row.losses),
  gf=Number(row.goals_for),ga=Number(row.goals_against),adjustment=Number(row.points_adjustment);
 const played=wins+draws+losses;
 if(![wins,draws,losses,gf,ga,adjustment].every(Number.isSafeInteger)||
  Math.min(wins,draws,losses,gf,ga)<0||Math.max(wins,draws,losses)>80||
  gf>500||ga>500||adjustment < -40||adjustment>40)
  throw new Error('Statistiques de classement incohérentes');
 return {played,goalDifference:gf-ga,points:3*wins+draws+adjustment};
}
export function validateStandings(entries){
 if(!Array.isArray(entries)||entries.length>24)throw Error('Nombre de clubs invalide');
 const names=new Set(),positions=new Set();
 return entries.map(row=>{
  const name=String(row.name??'').trim();
  const position=Number(row.position),computed=standingComputed(row);
  if(name.length<2||name.length>100||/[\u0000-\u001f\u007f]/.test(name)||
   names.has(name.toLocaleLowerCase('fr-FR'))||!Number.isSafeInteger(position)||
   position<1||position>entries.length||positions.has(position)||
   computed.played!==Number(row.played))throw Error('Classement invalide');
  names.add(name.toLocaleLowerCase('fr-FR'));positions.add(position);
  return {...row,...computed,name,position};
 }).sort((a,b)=>a.position-b.position);
}
export function moveRanking(entries,index,delta){
 if(!Array.isArray(entries)||!Number.isInteger(index)||![-1,1].includes(delta)||
  index<0||index>=entries.length||index+delta<0||index+delta>=entries.length)
  return entries;
 const next=entries.map(x=>({...x}));
 [next[index],next[index+delta]]=[next[index+delta],next[index]];
 return next.map((x,i)=>({...x,position:i+1}));
}
export async function fetchPublicStandings({signal,fetcher=fetch}={}){
 const url=supabaseConfig.url+'/rest/v1/team_league_standings?'+new URLSearchParams({
  select:'team_id,season_id,matchday,entries,published,updated_at',
  published:'eq.true',order:'updated_at.desc',limit:'5'});
 const response=await fetcher(url,{method:'GET',signal,cache:'no-store',
  headers:{apikey:supabaseConfig.publishableKey,Accept:'application/json'}});
 if(!response.ok)throw Error('Classements indisponibles');
 const result=await response.json();
 if(!Array.isArray(result))throw Error('Réponse classements invalide');
 return result.filter(row=>row.published===true).map(row=>({...row,entries:validateStandings(row.entries)}));
}
const el=(tag,cls='',value=null)=>{const n=document.createElement(tag);if(cls)n.className=cls;
 if(value!==null)n.textContent=String(value);return n;};
export function renderLeagueStanding(root,standing,team){
 root.replaceChildren();
 const section=el('section','league-standing');
 section.append(el('h2','','Classement · '+team.division));
 if(!standing){
  section.append(el('p','league-empty','Rang 2026–2027 non vérifié : aucun classement de poule confirmé par le club. Voir le bilan partiel et les archives ci-dessous.'));
  appendSourcedSportContext(section,team.code);
  root.append(section);return;
 }
 section.append(el('p','league-source',
  'Journée '+standing.matchday+' · classement renseigné et publié par le club, non synchronisé avec la FFF.'));
 const wrap=el('div','league-scroll');
 const table=el('table','league-table'),thead=el('thead'),theadRow=el('tr');
 for(const name of ['Rang','Équipe','J','V','N','D','BP','BC','Diff.','Pts']){
  const th=el('th','',name);th.scope='col';theadRow.append(th);
 }thead.append(theadRow);
 const body=el('tbody');
 for(const row of standing.entries){
  const tr=el('tr','');
  const isOwn=/^boissyuj(?:[0-9]+)?$/.test(row.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,''));
  if(isOwn)tr.classList.add('league-own-team');
  for(const v of [row.position,row.name,row.played,row.wins,row.draws,row.losses,
   row.goals_for,row.goals_against,row.goalDifference,row.points]){
   tr.append(el('td','',v));
  }
  body.append(tr);
 }
 table.append(thead,body);wrap.append(table);section.append(wrap);
 appendSourcedSportContext(section,team.code,{includeCurrent:false});
 const a=el('a','league-team-link','Voir la fiche '+team.name+' ↗');
 a.href=teamRoute(team);section.append(a);
 root.append(section);
}
let seq=0,abort=null;
export function unmountLeagueStandings(){seq++;abort?.abort();abort=null;}
export async function mountLeagueStandings(code=null){
 unmountLeagueStandings();
 const id=seq,root=document.getElementById('team-league-standing');
 if(!root)return;
 const ctrl=new AbortController();abort=ctrl;
 root.replaceChildren(el('p','league-empty','Chargement du classement publié…'));
 try{
  const data=await fetchPublicStandings({signal:ctrl.signal});
  if(id!==seq||ctrl.signal.aborted||!root.isConnected)return;
  const teams=CLUB_TEAMS.filter(t=>code===null||t.code===code);
  const r=await fetch(supabaseConfig.url+'/rest/v1/club_teams?'+new URLSearchParams({
   select:'id,code',order:'sort_order.asc',limit:'5'}),
   {method:'GET',signal:ctrl.signal,cache:'no-store',
    headers:{apikey:supabaseConfig.publishableKey,Accept:'application/json'}});
  if(!r.ok)throw Error('Équipes indisponibles');
  const mapped=await r.json();
  if(!Array.isArray(mapped))throw Error('Format équipes invalide');
  if(id!==seq||ctrl.signal.aborted||!root.isConnected)return;
  root.replaceChildren();
  for(const team of teams){
   const record=mapped.find(t=>t.code===team.code);
   const panel=el('div','league-team-panel');
   renderLeagueStanding(panel,data.find(s=>s.team_id===record?.id)||null,team);
   root.append(panel);
  }
 }catch{
  if(id!==seq||ctrl.signal.aborted||!root.isConnected)return;
  root.replaceChildren(el('p','league-empty','Classement temporairement indisponible. Aucun rang non vérifié n’est affiché.'));
 }
}
