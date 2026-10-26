/** Pure season lifecycle rules mirrored by protected Supabase RPCs. */
export const SEASON_STATE_LABELS=Object.freeze({
 planned:'Prévue',active:'En cours',completed:'Terminée',archived:'Archivée'
});
export function seasonTransitionAllowed(previous,next){
 if(!(next in SEASON_STATE_LABELS))return false;
 if(previous==null)return next==='planned';
 const allowed={
  planned:['planned','active'],
  active:['active','completed'],
  completed:['completed','archived'],
  archived:['archived']
 };
 return Boolean(allowed[previous]?.includes(next));
}
/** Calendar shift clamps Feb 29 to Feb 28 as PostgreSQL interval '1 year' does. */
export function nextSeasonPlan(season){
 if(!season||!['completed','archived'].includes(season.state))return null;
 const m=/^(\d{4})\/(\d{4})$/.exec(String(season.label??''));
 if(!m||Number(m[2])!==Number(m[1])+1||Number(m[1])>=2100)return null;
 const shift=value=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value??'')))return null;
  const [year,month,day]=value.split('-').map(Number);
  const d=new Date(Date.UTC(year,month-1,day));
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)return null;
  const targetYear=year+1;
  const max=new Date(Date.UTC(targetYear,month,0)).getUTCDate();
  return [targetYear,String(month).padStart(2,'0'),String(Math.min(day,max)).padStart(2,'0')].join('-');
 };
 const start=shift(season.starts_on),end=shift(season.ends_on);
 const year=Number(m[1])+1;
 if(!start||!end||start>=end||Number(start.slice(0,4))!==year||Number(end.slice(0,4))!==year+1)return null;
 return {sourceId:season.id,label:year+'/'+(year+1),start,end,state:'planned'};
}
