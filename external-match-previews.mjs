/** Public third-party fixture references reviewed on 2026-10-22.
 * These are NOT published club matches, NOT FFF API results, and NOT approved
 * for automatic insertion into Supabase. Never mix with club-confirmed data.
 * Source: SportCorico public 2026-27 team pages.
 */
export const EXTERNAL_FIXTURE_REVIEWED_AT='2026-10-22';
export const EXTERNAL_FIXTURE_PROVIDER='SportCorico';
const sourceA='https://www.sportcorico.com/clubs/boissy-uj/boissy-uj';
const sourceV='https://www.sportcorico.com/clubs/boissy-uj/boissy-uj-6?season=2026-2027';
const sourceF='https://www.sportcorico.com/clubs/boissy-uj/boissy-uj-1';
const sourceB='https://www.sportcorico.com/clubs/sporting-football-club-de-chennevieres/sfcc-1';
const data=[
 {team_code:'futsal',opponent:'FC Chennevières 1',date:'2026-10-24T18:00:00+02:00',is_home:false,source:sourceF},
 {team_code:'futsal',opponent:'Créteil Palais Futsal 2',date:'2026-10-31T11:30:00+01:00',is_home:true,source:sourceF},
 {team_code:'a',opponent:'Nogent-sur-Marne FC 3',date:'2026-11-01T15:00:00+01:00',is_home:true,source:sourceA},
 {team_code:'futsal',opponent:'Av. Chouchous Vitry 1',date:'2026-11-09T20:30:00+01:00',is_home:false,source:sourceF},
 {team_code:'a',opponent:'FC Hoverla 1',date:'2026-11-08T13:00:00+01:00',is_home:false,source:sourceA},
 {team_code:'a',opponent:'Hay-les-Roses CA 2',date:'2026-11-15T15:00:00+01:00',is_home:false,source:sourceA},
 {team_code:'b',opponent:'SFC Canavérois 1',date:'2026-11-15T15:00:00+01:00',is_home:true,source:sourceB},
 {team_code:'veterans',opponent:'Villeneuve Ablon US 11',date:'2026-11-15T09:30:00+01:00',is_home:false,source:sourceV},
 {team_code:'veterans',opponent:'Noiseau Sainte-S. 11',date:'2026-11-22T10:00:00+01:00',is_home:true,source:sourceV},
 {team_code:'a',opponent:'Limeil-Brévannes AJ 2',date:'2026-11-22T15:00:00+01:00',is_home:true,source:sourceA},
 {team_code:'futsal',opponent:'Vitry ASC 1',date:'2026-11-21T11:30:00+01:00',is_home:true,source:sourceF}
];
const labels={a:'Seniors A',b:'Seniors B',veterans:'Vétérans',futsal:'Senior · Futsal'};
export function publicExternalFixtures({now=Date.now(),query='',team='all',discipline='all',period='future'}={}){
 const search=String(query).trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 return data.filter(item=>{
   const time=Date.parse(item.date);
   if(!Number.isFinite(time)||time<now-24*3600000)return false;
   if(period==='week'&&time>now+7*86400000)return false;
   if(team!=='all'&&team!==item.team_code)return false;
   if(discipline==='futsal'&&item.team_code!=='futsal')return false;
   if(discipline==='football'&&item.team_code==='futsal')return false;
   const searchable=(item.opponent+' '+labels[item.team_code]).normalize('NFD')
     .replace(/[\u0300-\u036f]/g,'').toLowerCase();
   return !search||searchable.includes(search);
 }).map(item=>Object.freeze({...item,time:Date.parse(item.date),team_name:labels[item.team_code],
   source_label:EXTERNAL_FIXTURE_PROVIDER,validated_by_club:false}))
 .sort((a,b)=>a.time-b.time);
}
