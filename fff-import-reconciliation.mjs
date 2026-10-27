/** Authorized future FFF export: exact team/fixture comparison only.
 * No network, credentials, database writes or implied license.
 */
import {previewAuthorizedFffFeed,FFF_FEED_STATUS} from './fff-provider.mjs';
import {parisDateKey} from './calendar-month.mjs';
import {CLUB_TEAMS} from './club-teams.mjs';
const normalize=value=>String(value||'').normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').toLowerCase()
 .replace(/[^a-z0-9]/g,'');
const safeTeam=new Set(CLUB_TEAMS.map(x=>x.code));
const STATUS=Object.freeze({
 available:'À comparer et vérifier',
 already_recorded:'Rencontre déjà enregistrée',
 conflict:'Conflit avec le dossier du club',
 ambiguous:'Rapprochement ambigu',
 team_missing:'Équipe du club non liée',
 unavailable:'Dossiers officiels indisponibles'
});
export const FFF_REVIEW_LABELS=STATUS;
function clubSignature(teamCode,day,opponent){return teamCode+'|'+day+'|'+normalize(opponent);}
function normalizedScore(item){
 return item.match_status==='played'&&Number.isInteger(item.home_score)&&
 Number.isInteger(item.away_score)?item.home_score+'-'+item.away_score:null;
}
export function reviewAuthorizedFffImport(input,teams,existing,now=Date.now()){
 const feed=previewAuthorizedFffFeed(input);
 if(!Array.isArray(teams)||!Array.isArray(existing)||!Number.isFinite(now))
  throw Error('Dossiers du club indisponibles.');
 if(teams.length>40||existing.length>=250||!Array.isArray(input.matches))
  throw Error('Inventaire administratif incomplet : rapprochement interdit.');
 const lookup=new Map();
 for(const team of teams){
  if(!team||typeof team.id!=='string'||!safeTeam.has(team.code)||
    lookup.has(team.code))throw Error('Correspondance des équipes ambiguë.');
  lookup.set(team.code,team.id);
 }
 const matches=new Map();
 for(const row of existing){
  if(!row||typeof row.team_id!=='string'||typeof row.opponent_name!=='string'||
   typeof row.scheduled_at!=='string')continue;
  const code=[...lookup].find(([,id])=>id===row.team_id)?.[0];
  if(!code)continue;
  const date=Date.parse(row.scheduled_at);
  if(!Number.isFinite(date))continue;
  const signature=clubSignature(code,parisDateKey(date),row.opponent_name);
  if(!matches.has(signature))matches.set(signature,[]);
  matches.get(signature).push(row);
 }
 const count=new Map();
 for(const item of feed){
  const signature=clubSignature(item.team_code,parisDateKey(Date.parse(item.scheduled_at)),item.opponent_name);
  count.set(signature,(count.get(signature)||0)+1);
 }
 const report=feed.map(item=>{
  const day=parisDateKey(Date.parse(item.scheduled_at));
  const signature=clubSignature(item.team_code,day,item.opponent_name);
  const candidates=matches.get(signature)||[];
  let status='available';
  if(!lookup.has(item.team_code))status='team_missing';
  else if(count.get(signature)!==1||candidates.length>1)status='ambiguous';
  else if(candidates.length===1){
   const original=candidates[0];
   const a=normalizedScore(item);
   const b=normalizedScore(original);
   status=(original.match_status!==item.match_status||
     original.is_home!==item.is_home||
     a!==b||
     Math.abs(Date.parse(original.scheduled_at)-Date.parse(item.scheduled_at))>5*60*1000)
    ?'conflict':'already_recorded';
  }
  return Object.freeze({
   ...item,localDay:day,team_id:lookup.get(item.team_code)||null,
   review_status:status,club_confirmed:false,
   import_performed:false,published:false
  });
 });
 return Object.freeze({
  status:FFF_FEED_STATUS,
  automatic_sync_enabled:false,
  club_publication_performed:false,
  source_permission_verified:false,
  records:Object.freeze(report),
  counts:Object.freeze(Object.fromEntries(Object.keys(STATUS).map(k=>[
   k,report.filter(x=>x.review_status===k).length
  ])))
 });
}
/** Form data is an untrusted draft: no source-backed result is copied as final.
 * The club must classify the competition and explicitly input played scores.
 */
export function prepareFffManualDraft(record){
 if(!record||record.review_status!=='available'||!record.team_id||
  typeof record.opponent_name!=='string'||!Number.isFinite(Date.parse(record.scheduled_at)))
  throw Error('Rencontre non préparable : résoudre le conflit ou le manque de correspondance.');
 const date=new Intl.DateTimeFormat('sv-SE',{
  timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'
 }).format(new Date(record.scheduled_at)).replace(' ','T');
 return Object.freeze({
  team_id:record.team_id,opponent_name:record.opponent_name,
  scheduled_local:date,venue:record.venue,is_home:record.is_home,
  match_status:record.match_status,home_score:'',away_score:'',
  competition_kind:'unspecified',competition_label:'',
  published:false,source_kind:'manual',source_reference:null
 });
}
