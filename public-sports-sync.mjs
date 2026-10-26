/**
 * Shared public match feed contract across home, Match Center, agenda and team pages.
 * Only club-published rows; unapproved third-party listings are kept separate.
 * No private player data, results inference, browser storage or write operations.
 */
import {parisDateKey} from './calendar-month.mjs';

export const PUBLIC_MATCH_LIMIT=500;
export const PUBLIC_MATCH_COLUMNS='id,team_id,season_id,opponent_name,scheduled_at,venue,is_home,home_score,away_score,match_status,source_kind,published,competition_kind,competition_label';
const MATCH_STATUSES=new Set(['scheduled','played','postponed','cancelled']);
export function publishedMatchParams(extra={}){
 return {select:PUBLIC_MATCH_COLUMNS,published:'eq.true',
  order:'scheduled_at.asc',limit:String(PUBLIC_MATCH_LIMIT),...extra};
}
/** Returns only plausible already-published fixtures; the database remains authoritative. */
export function filterPublishedMatchRows(rows){
 if(!Array.isArray(rows))throw Error('Invalid match catalogue');
 const seen=new Set();
 return rows.filter(m=>{
  if(m?.published!==true||typeof m.id!=='string'||!m.id
   ||typeof m.team_id!=='string'||!m.team_id
   ||typeof m.opponent_name!=='string'||!m.opponent_name.trim()
   ||!MATCH_STATUSES.has(m.match_status)
   ||!Number.isFinite(Date.parse(m.scheduled_at))
   ||seen.has(m.id))return false;
  if(m.match_status==='played'&&(!Number.isInteger(m.home_score)
   ||!Number.isInteger(m.away_score)))return false;
  seen.add(m.id);
  return true;
 });
}
export function sourcedFixtureKey(teamCode,when,opponent){
 const day=typeof when==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(when)
  ?when:parisDateKey(when);
 if(!teamCode||!day||!String(opponent??'').trim())return null;
 const normalized=String(opponent).normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
 return teamCode+'|'+day+'|'+normalized;
}
/** Even a club cancellation or postponement suppresses a stale sourced copy. */
export function clubDecisionKeys(published,teams){
 const codeById=new Map(teams.map(t=>[t.id,t.code]));
 // Published cancellations/results also override sourced copies even when
 // their score is incomplete or later corrected; never resurrect an old date.
 return new Set((Array.isArray(published)?published:[])
  .filter(m=>m?.published===true&&typeof m.id==='string'&&m.id&&
    MATCH_STATUSES.has(m.match_status))
  .map(m=>sourcedFixtureKey(codeById.get(m.team_id),m.scheduled_at,m.opponent_name))
  .filter(Boolean));
}
export function unconfirmedWithoutClubDecision(external,published,teams){
 const confirmed=clubDecisionKeys(published,teams);
 return external.filter(row=>!confirmed.has(sourcedFixtureKey(
  row.team_code,row.localDay||row.date,row.opponent)));
}
/**
 * Every public route rechecks after an hour and on return from an inactive tab.
 * Call only while mounted; cleanup is mandatory to prevent stale route updates.
 * A module owns its own request cancellation and failure rendering.
 */
export function watchPublicSportsRefresh({refresh,active,
 intervalMs=60*60*1000,minResumeMs=60*1000,
 now=Date.now,windowTarget=window,documentTarget=document}){
 let live=true,last=now();
 const ready=()=>live&&active()&&documentTarget.visibilityState!=='hidden';
 const tick=()=>{
  if(!ready())return;
  last=now();
  refresh();
 };
 const resume=()=>{
  if(ready()&&now()-last>=minResumeMs)tick();
 };
 const timer=setInterval(tick,intervalMs);
 windowTarget.addEventListener('focus',resume);
 documentTarget.addEventListener('visibilitychange',resume);
 return ()=>{
  live=false;clearInterval(timer);
  windowTarget.removeEventListener('focus',resume);
  documentTarget.removeEventListener('visibilitychange',resume);
 };
}
