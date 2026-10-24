/**
 * Step 62: pure, read-only reconciliation of third-party fixture observations.
 * Never grants "club confirmed" status. A sourced record is not an FFF license,
 * a signed club publication, or permission to bulk copy a provider's data.
 */
import {CLUB_TEAMS} from './club-teams.mjs';
import {parisDateKey} from './calendar-month.mjs';

const allowed=new Set(CLUB_TEAMS.map(team=>team.code));
const normalize=value=>String(value??'').normalize('NFD')
 .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const safeDate=value=>typeof value==='string'&&datePattern.test(value)&&
 !Number.isNaN(Date.parse(value+'T12:00:00Z'))&&
 new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const key=(team,day,opponent)=>team+'|'+day+'|'+normalize(opponent);
export const SPORT_REVIEW_STATUSES=Object.freeze({
 new:'À valider par le club',
 outdated:'Match passé sans résultat confirmé',
 source_result:'Score relevé par un tiers · à homologuer',
 conflict:'Écart avec le dossier du club · vérification requise',
 recorded:'Rencontre déjà saisie dans le dossier du club',
 invalid:'Donnée source invalide'
});
/**
 * This never changes Supabase or the source array. Independent source data
 * must be compared with a club-authorized report before any import.
 */
export function sportSourceReview(source=[],clubMatches=[],teams=[],now=Date.now()){
 if(!Array.isArray(source)||!Array.isArray(clubMatches)||
   !Array.isArray(teams)||!Number.isFinite(now))
  throw new Error('Invalid sports source review request');
 const teamCodeById=new Map(teams.filter(x=>typeof x?.id==='string'&&allowed.has(x.code))
   .map(x=>[x.id,x.code]));
 const official=new Map();
 for(const match of clubMatches){
  if(!match||typeof match.opponent_name!=='string'||!match.scheduled_at)continue;
  const code=teamCodeById.get(match.team_id);
  const start=Date.parse(match.scheduled_at);
  if(!code||!Number.isFinite(start))continue;
  const signature=key(code,parisDateKey(start),match.opponent_name);
  if(!official.has(signature))official.set(signature,match);
 }
 const duplicates=new Map(),items=[];
 for(const row of source){
  const code=row?.team_code,opponent=String(row?.opponent??'').trim();
  const day=row?.localDay||row?.date?.slice(0,10);
  const id=key(code,day,opponent);
  const valid=allowed.has(code)&&safeDate(day)&&opponent.length>=2&&opponent.length<=140&&
    Number.isFinite(row?.time??Date.parse(row?.date))&&
    ['scheduled','played','administrative','unknown','postponed','cancelled'].includes(row?.status);
  const match=official.get(id);
  let kind='invalid';
  if(valid){
   const externalPlayed=['played','administrative'].includes(row.status);
   const clubScoresKnown=match?.match_status==='played'&&
    Number.isInteger(match.home_score)&&Number.isInteger(match.away_score);
   const scoresConflict=externalPlayed&&clubScoresKnown&&
    Number.isInteger(row.home_score)&&Number.isInteger(row.away_score)&&
    (row.home_score!==match.home_score||row.away_score!==match.away_score);
   const statusConflict=match?.match_status==='cancelled'&&row.status==='scheduled';
   const extraConflict=match?.match_status==='played'&&row.status==='scheduled';
   if(scoresConflict||statusConflict||extraConflict)kind='conflict';
   else if(match)kind='recorded';
   else if(externalPlayed)kind='source_result';
   else if(row.status==='scheduled'&&
      Number(row.time??Date.parse(row.date))<now)kind='outdated';
   else kind='new';
  }
  duplicates.set(id,(duplicates.get(id)||0)+1);
  items.push(Object.freeze({
   teamCode:allowed.has(code)?code:'invalid',opponent,localDay:day||'',
   sourceName:String(row?.source_label||'Source extérieure').slice(0,80),
   kind,clubApproved:false,
   resultLabel:kind==='source_result'&&typeof row.result==='string'
     ?row.result.slice(0,30):null,
   competition:String(row?.competition||'Compétition non précisée').slice(0,100),
   sourceReviewedAt:typeof row.reviewed_at==='string'?row.reviewed_at:null,
   recordExists:Boolean(match)
  }));
 }
 const rows=items.map((item,i)=>{
  const original=source[i];
  const id=key(original?.team_code,original?.localDay||original?.date?.slice(0,10),
    original?.opponent);
  if(duplicates.get(id)<=1)return item;
  return Object.freeze({...item,kind:'conflict',resultLabel:null});
 });
 const counts={};
 for(const status of Object.keys(SPORT_REVIEW_STATUSES))counts[status]=rows.filter(x=>x.kind===status).length;
 return Object.freeze({
  total:rows.length,needsReview:rows.filter(x=>!['recorded'].includes(x.kind)).length,
  counts:Object.freeze(counts),records:Object.freeze(rows),
  clubPublicationPerformed:false,sourceOwnershipConfirmed:false
 });
}
export function sportReviewTeamCounts(report){
 return CLUB_TEAMS.map(team=>Object.freeze({
  code:team.code,name:team.name,
  pending:report.records.filter(r=>r.teamCode===team.code&&r.kind!=='recorded').length,
  sourced:report.records.filter(r=>r.teamCode===team.code).length
 }));
}
