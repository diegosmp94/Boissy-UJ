/** Homepage match card shares the club-published and attributed calendar sources
 * used by Match Center / Agenda. No outside links, no invented fixture.
 */
import {supabaseConfig} from './auth-config.mjs';
import {CLUB_TEAMS,teamRoute} from './club-teams.mjs';
import {publicExternalFixtures} from './external-match-previews.mjs';
import {parisDateKey} from './calendar-month.mjs';
import {boundedPublicRequest} from './public-catalog-timeout.mjs';
import {publishedMatchParams,filterPublishedMatchRows,unconfirmedWithoutClubDecision} from './public-sports-sync.mjs';

export const NEXT_MATCH_REFRESH_MS=60*60*1000;
const ENDPOINT=supabaseConfig.url+'/rest/v1/';
const normalize=value=>String(value??'').normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
const teamOf=code=>CLUB_TEAMS.find(team=>team.code===code);

export function parisNextMidnight(day){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(day)))return NaN;
 const [y,m,d]=day.split('-').map(Number);
 if(y<2000||y>2100)return NaN;
 const start=Date.UTC(y,m-1,d);
 if(!Number.isFinite(start)||new Date(start).toISOString().slice(0,10)!==day)
  return NaN;
 const nextUtc=start+86400000;
 // At UTC 00:00 Europe/Paris is 01:00 or 02:00. That offset is the
 // one active at *local midnight*, BEFORE any 02:00/03:00 DST switch.
 // Sampling midday on the next date instead produces a one-hour error
 // on the final Saturday of March/October.
 const parisHour=Number(new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/Paris',hour:'2-digit',hourCycle:'h23'
 }).format(new Date(nextUtc)));
 if(!Number.isInteger(parisHour)||parisHour<0||parisHour>3)return NaN;
 return nextUtc-parisHour*3600000;
}
/** Date-only fixtures have no kickoff hour: they remain pending until Paris midnight. */
export function nextMatchBoundary(fixture){
 if(fixture?.dateOnly)return parisNextMidnight(fixture.localDay);
 return Number(fixture?.time);
}
export function nextUpcomingMatch(fixtures,now=Date.now()){
 if(!Array.isArray(fixtures))return null;
 const valid=fixtures.filter(f=>
  (f.status==='scheduled')&&typeof f.localDay==='string'&&
  Number.isFinite(nextMatchBoundary(f))&&nextMatchBoundary(f)>now&&
  typeof f.opponent==='string'&&f.opponent.trim()!=='');
 valid.sort((a,b)=>a.localDay.localeCompare(b.localDay)||
  Number(a.dateOnly)-Number(b.dateOnly)||a.time-b.time||
  a.teamCode.localeCompare(b.teamCode)||a.opponent.localeCompare(b.opponent,'fr'));
 return valid[0]||null;
}
/** Roll over at the exact kickoff (or Paris day boundary for date-only fixtures). */
export function nextMatchRefreshDelay(fixtures,now=Date.now()){
 const next=nextUpcomingMatch(fixtures,now);
 if(!next)return NEXT_MATCH_REFRESH_MS;
 return Math.max(50,Math.min(NEXT_MATCH_REFRESH_MS,nextMatchBoundary(next)-now+1000));
}
export function mergeNextMatchCalendar(published=[],sourced=[],teams=[]){
 const codeById=new Map(teams.map(t=>[t.id,t.code]));
 // Published club decisions also override the source when a fixture is no longer
 // scheduled. Otherwise cancellation/reporting resurrects its sourced copy.
 const clubRows=published.filter(row=>row.published===true&&
  codeById.has(row.team_id)&&Number.isFinite(Date.parse(row.scheduled_at))&&
  typeof row.opponent_name==='string'&&row.opponent_name.trim()!=='');
 const official=clubRows.flatMap(row=>{
  const code=codeById.get(row.team_id),time=Date.parse(row.scheduled_at);
  if(!code||row.published!==true||row.match_status!=='scheduled'||
    !Number.isFinite(time)||!row.opponent_name)return [];
  return [{
   id:'club-'+row.id,teamCode:code,opponent:row.opponent_name,
   localDay:parisDateKey(time),time,dateOnly:false,status:'scheduled',
   is_home:row.is_home===true,venue:row.venue||null,
   competition:row.competition_label||null,
   published:true,clubConfirmed:true,sourceLabel:'Boissy UJ'
  }];
 });
 const external=unconfirmedWithoutClubDecision(sourced,clubRows,teams)
  .filter(row=>row.status==='scheduled')
  .map(row=>({
   id:'reference-'+row.team_code+'-'+row.localDay+'-'+normalize(row.opponent),
   teamCode:row.team_code,opponent:row.opponent,time:row.time,
   localDay:row.localDay,dateOnly:row.dateOnly,status:'scheduled',
   is_home:row.is_home===true,venue:null,competition:row.competition,
   published:false,clubConfirmed:false, // external listings are not club authorizations
   sourceLabel:row.source_label
  }));
 return [...official,...external];
}
export async function loadPublishedUpcoming({fetcher=fetch,signal,now=Date.now()}={}){
 const entries=[
  ['club_teams',{select:'id,code,name',order:'sort_order.asc',limit:'10'}],
  ['matches',publishedMatchParams()]
 ];
 const [teams,matches]=await Promise.all(entries.map(async([table,params])=>{
  const res=await fetcher(ENDPOINT+table+'?'+new URLSearchParams(params),{
   method:'GET',signal,cache:'no-store',headers:{
    apikey:supabaseConfig.publishableKey,Accept:'application/json'
   }
  });
  if(!res.ok)throw Error('Catalogue sportif indisponible');
  const rows=await res.json();
  if(!Array.isArray(rows))throw Error('Réponse sportive invalide');
  return rows;
 }));
 return {teams,matches:filterPublishedMatchRows(matches)};
}
const element=(tag,cls='',value=null)=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(value!==null)node.textContent=String(value);
 return node;
};
const dateFormat=new Intl.DateTimeFormat('fr-FR',{
 timeZone:'Europe/Paris',weekday:'long',day:'numeric',month:'long',year:'numeric'
});
const hourFormat=new Intl.DateTimeFormat('fr-FR',{
 timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit'
});
export function renderHomeNextMatch(root,fixture,{now=Date.now(),dataUnavailable=false}={}){
 root.replaceChildren();
 const heading=element('div','panel-heading');
 heading.append(element('span','live-dot'),document.createTextNode(' PROCHAIN MATCH'));
 root.append(heading);
 if(!fixture){
  root.append(element('p','home-next-empty',
   dataUnavailable?'Programme momentanément indisponible. Consultez le Match Center.':
   'Aucune rencontre à venir connue pour le moment.'));
  const a=element('a','home-next-action','Voir le calendrier du club ↗');
  a.href='#/agenda';root.append(a);
  return;
 }
 const team=teamOf(fixture.teamCode);
 const name=team?.name||'Équipe Boissy UJ';
 root.append(element('p','home-next-team',name));
 const sides=element('div','versus home-next-versus');
 const boissy=fixture.teamCode==='futsal'?'BOISSY UJ · SENIOR':'BOISSY UJ';
 const opponent=fixture.opponent;
 sides.append(element('strong','home-next-side',fixture.is_home?boissy:opponent),
  element('span','home-next-vs','VS'),
  element('strong','home-next-side',fixture.is_home?opponent:boissy));
 root.append(sides);
 const at=element('time','home-next-date',dateFormat.format(new Date(fixture.time))+
  ' · '+(fixture.dateOnly?'Horaire non communiqué':hourFormat.format(new Date(fixture.time))));
 at.dateTime=fixture.dateOnly?fixture.localDay:new Date(fixture.time).toISOString();
 root.append(at);
 root.append(element('p','home-next-ground',
  fixture.is_home?'À domicile'+(fixture.venue?' · '+fixture.venue:''):
   'À l’extérieur'+(fixture.venue?' · '+fixture.venue:'')));
 if(fixture.competition)root.append(element('p','home-next-competition',fixture.competition));
 const status=fixture.published?'Rencontre publiée par le club':
  fixture.clubConfirmed?'Date annoncée par le club · détails sportifs à confirmer':
   'Calendrier référencé · date et horaire à confirmer par le club';
 root.append(element('p','home-next-status',status));
 if(dataUnavailable){
  const warning=element('p','home-next-status home-next-sync-warning',
   'Mise à jour du calendrier du club momentanément indisponible. Les informations déjà publiées ou référencées peuvent avoir changé.');
  warning.setAttribute('role','status');
  root.append(warning);
 }
 const action=element('div','home-next-actions');
 const all=element('a','home-next-action','Tous les matchs ↗');
 all.href='#/matchs';action.append(all);
 if(team){
  const profile=element('a','home-next-action home-next-team-action','Fiche de '+name+' ↗');
  profile.href=teamRoute(team);action.append(profile);
 }
 root.append(action);
}
let sequence=0,controller=null,timer=null,visibleHandler=null,focusHandler=null;
export function unmountHomeNextMatch(){
 sequence++;
 controller?.abort();controller=null;
 if(timer!==null)clearTimeout(timer);timer=null;
 if(visibleHandler){document.removeEventListener('visibilitychange',visibleHandler);visibleHandler=null;}
 if(focusHandler){window.removeEventListener('focus',focusHandler);focusHandler=null;}
}
export function mountHomeNextMatch(){
 unmountHomeNextMatch();
 const root=document.getElementById('home-next-match');
 if(!root)return;
 const generation=sequence;
 let remote={teams:[],matches:[]},loading=false,lastSync=0,remoteUnavailable=false;
 const sourced=publicExternalFixtures({includePast:true,period:'all',season:'2026-2027'});
 const all=()=>mergeNextMatchCalendar(remote.matches,sourced,remote.teams);
 const active=()=>generation===sequence&&root.isConnected;
 const draw=()=>{
  if(!active())return;
  const now=Date.now(),fixtures=all();
  renderHomeNextMatch(root,nextUpcomingMatch(fixtures,now),{now,
   dataUnavailable:remoteUnavailable});
  if(timer!==null)clearTimeout(timer);
  timer=setTimeout(()=>{
   timer=null;
   // Change the displayed match immediately, even if the Supabase request is slow.
   draw();
   void sync();
  },nextMatchRefreshDelay(fixtures,now));
 };
 const sync=async()=>{
  if(loading||!active())return;
  loading=true;
  const abort=new AbortController();controller=abort;
  const deadline=boundedPublicRequest(abort.signal);
  try{
   const fresh=await loadPublishedUpcoming({signal:deadline.signal});
   if(!active()||abort.signal.aborted)return;
   remote=fresh;remoteUnavailable=false;lastSync=Date.now();
  }catch{
   // Continue to display the sourced season calendar; no invented club approval.
   if(!active()||abort.signal.aborted)return;
   remoteUnavailable=true;lastSync=Date.now();
  }finally{
   deadline.dispose();
   loading=false;
   if(active())draw();
  }
 };
 const resume=()=>{
  if(!active())return;
  draw();
  if(Date.now()-lastSync>=60*1000)void sync();
 };
 visibleHandler=()=>{if(document.visibilityState==='visible')resume();};
 focusHandler=()=>resume();
 document.addEventListener('visibilitychange',visibleHandler);
 window.addEventListener('focus',focusHandler);
 draw();void sync();
}
