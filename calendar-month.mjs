/** Pure calendar helpers. Month keys are Europe/Paris calendar days (no UTC drift). */
import {clubOutcome} from './league-standings.mjs';
const parisParts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'});
export function parisDateKey(value){
 const d=new Date(value);
 if(!Number.isFinite(d.valueOf()))return null;
 const parts=Object.fromEntries(parisParts.formatToParts(d).map(p=>[p.type,p.value]));
 return parts.year+'-'+parts.month+'-'+parts.day;
}
export function shiftCalendarMonth(year,month,offset){
 if(!Number.isInteger(year)||!Number.isInteger(month)||!Number.isInteger(offset)||Math.abs(offset)>24)throw Error('Mois invalide');
 const date=new Date(Date.UTC(year,month+offset,1));
 return {year:date.getUTCFullYear(),month:date.getUTCMonth()};
}
export function calendarMonthTitle(year,month){
 return new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'})
  .format(new Date(Date.UTC(year,month,1)));
}
export function monthGrid(year,month,entries=[]){
 if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(month)||month<0||month>11)throw Error('Mois invalide');
 const first=new Date(Date.UTC(year,month,1));
 const offset=(first.getUTCDay()+6)%7;
 const count=Math.ceil((offset+new Date(Date.UTC(year,month+1,0)).getUTCDate())/7)*7;
 const byDay=new Map();
 for(const entry of entries){
  const key=entry.localDay||parisDateKey(entry.time);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(key)))continue;
  if(!byDay.has(key))byDay.set(key,[]);
  byDay.get(key).push(entry);
 }
 return Array.from({length:count},(_,idx)=>{
  const date=new Date(Date.UTC(year,month,1-offset+idx));
  const key=date.toISOString().slice(0,10);
  return {key,day:date.getUTCDate(),inMonth:date.getUTCMonth()===month,entries:byDay.get(key)||[]};
 });
}
export function mergeCalendarPublicEntries(published,external,teams=[]){
 const codeById=new Map(teams.map(t=>[t.id,t.code]));
 const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
 const confirmed=new Set(published.filter(i=>i.kind==='match').map(i=>
  (i.teamCode||codeById.get(i.teamId)||'')+'|'+(i.localDay||parisDateKey(i.time))+'|'+norm(i.opponent)));
 const sourceEntries=external.filter(x=>!confirmed.has(x.team_code+'|'+x.localDay+'|'+norm(x.opponent)))
  .map((x,index)=>({
   id:'external-'+x.team_code+'-'+x.localDay+'-'+index,kind:'match',
   time:x.time,localDay:x.localDay,dateOnly:x.dateOnly,
   title:x.team_name+' — '+x.opponent,subtitle:x.status==='played'?'Résultat relevé sur '+x.source_label:
    x.status==='unknown'?'Match passé · score à confirmer':'Rencontre annoncée sur '+x.source_label,
   place:'',info:(x.status==='played'?x.result:x.is_home?'Domicile annoncé':'Extérieur annoncé')+
    ' · '+x.season+' · '+x.competition,
   // Provenance kept as readable metadata, never a visitor-facing external link.
   sourceLabel:x.source_label,external:true,status:x.status,teamCode:x.team_code,opponent:x.opponent,
   outcome:x.status==='played'?clubOutcome({...x,match_status:'played'}):null
  }));
 return [...published,...sourceEntries].sort((a,b)=>a.time-b.time);
}
