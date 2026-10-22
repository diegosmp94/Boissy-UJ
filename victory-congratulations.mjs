/** Boissy UJ: congratulations are based ONLY on club-published, completed
 * results. SportCorico third-party previews never trigger celebrations.
 * Seniors C are explicitly excluded by club request.
 */
import {clubOutcome} from './league-standings.mjs';

export const CONGRATULATED_TEAM_CODES=Object.freeze(['a','b','veterans','futsal']);
const TEAM_NAMES=Object.freeze({
 a:'Seniors A',b:'Seniors B',veterans:'Vétérans',futsal:'Senior futsal'
});
const parisParts=new Intl.DateTimeFormat('en-GB',{
 timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'
});
function parisDay(value){
 const date=new Date(value);
 if(!Number.isFinite(date.valueOf()))return null;
 const p=Object.fromEntries(parisParts.formatToParts(date).map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
export function mondayOfParisWeek(value){
 const key=parisDay(value);
 if(!key)return null;
 const [y,m,d]=key.split('-').map(Number);
 const day=new Date(Date.UTC(y,m-1,d));
 const offset=(day.getUTCDay()+6)%7;
 day.setUTCDate(day.getUTCDate()-offset);
 return day.toISOString().slice(0,10);
}
export function victoryCongratulations(match,teamCode){
 if(!CONGRATULATED_TEAM_CODES.includes(teamCode)||match?.published!==true||
   clubOutcome(match)!=='V'||!Number.isFinite(Date.parse(match.scheduled_at)))
  return null;
 return Object.freeze({
  teamCode,
  title:'Bravo aux '+TEAM_NAMES[teamCode]+' !',
  message:'Félicitations aux joueurs et à tout le staff pour cette victoire ! Votre travail, votre solidarité et votre engagement font la fierté de Boissy UJ. Continuez comme ça !'
 });
}
/** All four eligible squads must have a published win in the SAME Paris week.
 * A draw or defeat by any of them in that week blocks the collective banner.
 * Matches with uncertain / external provenance or future dates do not count.
 */
export function collectiveVictoryCongratulations(matches=[],teams=[],{
 now=Date.now(),maxAgeDays=14
}={}){
 if(!Array.isArray(matches)||!Array.isArray(teams)||!Number.isFinite(now))return null;
 const codeById=new Map(teams.map(t=>[t.id,t.code]));
 const valid=matches.filter(m=>{
  if(m?.published!==true||m.match_status!=='played'||!CONGRATULATED_TEAM_CODES.includes(codeById.get(m.team_id)))return false;
  const t=Date.parse(m.scheduled_at);
  return Number.isFinite(t)&&t<=now&&t>=now-maxAgeDays*86400000&&clubOutcome(m)!==null;
 });
 const weeks=new Map();
 for(const match of valid){
  const week=mondayOfParisWeek(match.scheduled_at);
  if(!week)continue;
  if(!weeks.has(week))weeks.set(week,new Map());
  const code=codeById.get(match.team_id),byTeam=weeks.get(week);
  if(!byTeam.has(code))byTeam.set(code,[]);
  byTeam.get(code).push(clubOutcome(match));
 }
 const winners=[...weeks.entries()]
  .filter(([_,w])=>CONGRATULATED_TEAM_CODES.every(code=>
   w.has(code)&&w.get(code).length>=1&&w.get(code).every(result=>result==='V')))
  .sort(([a],[b])=>b.localeCompare(a));
 if(!winners.length)return null;
 return Object.freeze({
  weekStart:winners[0][0],
  title:'Quelle semaine pour Boissy UJ !',
  message:'Félicitations aux joueurs et à tous les staffs des Seniors A, Seniors B, Vétérans et Senior futsal : quatre équipes victorieuses ! Merci pour votre engagement et cette belle réussite collective.'
 });
}
