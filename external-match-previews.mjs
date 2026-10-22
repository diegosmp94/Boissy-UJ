/** Public SportCorico fixtures and results; manually checked on 2026-10-22.
 * These facts are attributed third-party observations, NOT club approval or
 * an official FFF API. Never write them to Supabase automatically.
 */
export const EXTERNAL_FIXTURE_REVIEWED_AT='2026-10-22';
export const EXTERNAL_FIXTURE_PROVIDER='SportCorico';
const sourceA='https://www.sportcorico.com/clubs/boissy-uj/boissy-uj';
const sourceV='https://www.sportcorico.com/clubs/boissy-uj/boissy-uj-6?season=2026-2027';
const sourceF='https://www.sportcorico.com/clubs/boissy-uj/boissy-uj-1';
const sourceB='https://www.sportcorico.com/clubs/val-de-fontenay-as/val-de-fontenay-as-39';
/** Historical score entries have date-only precision. Never invent a kickoff time. */
const data=[
 {team_code:'a',opponent:"Bann'zanmi 2",date:'2026-09-20',is_home:true,source:sourceA,home_score:6,away_score:1,status:'played'},
 {team_code:'a',opponent:'Moldavie FC 1',date:'2026-10-04',is_home:false,source:sourceA,home_score:1,away_score:3,status:'played'},
 {team_code:'a',opponent:'Villejuif US 1',date:'2026-10-11',is_home:false,source:sourceA,home_score:6,away_score:0,status:'played'},
 {team_code:'a',opponent:'Villiers-sur-Marne ES 2',date:'2026-10-18',is_home:false,source:sourceA,home_score:1,away_score:0,status:'played'},
 {team_code:'futsal',opponent:'Petits Anges ES 1',date:'2026-10-03',is_home:true,source:sourceF,home_score:3,away_score:7,status:'played'},
 {team_code:'futsal',opponent:'Maisons-Alfort FC 1',date:'2026-10-17T11:30:00+02:00',is_home:true,source:sourceF,status:'unknown'},
 {team_code:'veterans',opponent:"Éléphant Côte d'Ivoire 11",date:'2026-10-04T09:30:00+02:00',is_home:false,source:sourceV,status:'unknown'},
 {team_code:'veterans',opponent:'Bois Abbé Outre-Mer 12',date:'2026-10-18T10:00:00+02:00',is_home:true,source:sourceV,status:'unknown'},
 {team_code:'futsal',opponent:'FC Chennevières 1',date:'2026-10-24T18:00:00+02:00',is_home:false,source:sourceF,status:'scheduled'},
 {team_code:'futsal',opponent:'Créteil Palais Futsal 2',date:'2026-10-31T11:30:00+01:00',is_home:true,source:sourceF,status:'scheduled'},
 {team_code:'b',opponent:'Val de Fontenay AS 2',date:'2026-11-01T15:00:00+01:00',is_home:false,source:sourceB,status:'scheduled'},
 {team_code:'a',opponent:'Nogent-sur-Marne FC 3',date:'2026-11-01T15:00:00+01:00',is_home:true,source:sourceA,status:'scheduled'},
 {team_code:'a',opponent:'FC Hoverla 1',date:'2026-11-08T13:00:00+01:00',is_home:false,source:sourceA,status:'scheduled'},
 {team_code:'futsal',opponent:'Av. Chouchous Vitry 1',date:'2026-11-09T20:30:00+01:00',is_home:false,source:sourceF,status:'scheduled'},
 {team_code:'futsal',opponent:'VEF 1',date:'2026-11-14T20:00:00+01:00',is_home:false,source:sourceF,status:'scheduled'},
 {team_code:'a',opponent:"Hay-les-Roses CA 2",date:'2026-11-15T15:00:00+01:00',is_home:false,source:sourceA,status:'scheduled'},
 {team_code:'veterans',opponent:'Villeneuve Ablon US 11',date:'2026-11-15T09:30:00+01:00',is_home:false,source:sourceV,status:'scheduled'},
 {team_code:'veterans',opponent:'Noiseau Sainte-S. 11',date:'2026-11-22T10:00:00+01:00',is_home:true,source:sourceV,status:'scheduled'},
 {team_code:'a',opponent:'Limeil-Brévannes AJ 2',date:'2026-11-22T15:00:00+01:00',is_home:true,source:sourceA,status:'scheduled'},
 {team_code:'futsal',opponent:'Vitry ASC 1',date:'2026-11-21T11:30:00+01:00',is_home:true,source:sourceF,status:'scheduled'},
 {team_code:'a',opponent:'US Choisy 1',date:'2026-11-29T17:00:00+01:00',is_home:false,source:sourceA,status:'scheduled'},
 {team_code:'veterans',opponent:'Villeneuve St G. Por 11',date:'2026-11-29T09:30:00+01:00',is_home:false,source:sourceV,status:'scheduled'},
 {team_code:'futsal',opponent:'Futsal Club Choisy 2',date:'2026-11-28T11:30:00+01:00',is_home:true,source:sourceF,status:'scheduled'},
 {team_code:'veterans',opponent:'Villejuif E. Benfica 11',date:'2026-12-06T10:00:00+01:00',is_home:true,source:sourceV,status:'scheduled'},
 {team_code:'futsal',opponent:'Rungis US 2',date:'2026-12-04T21:15:00+01:00',is_home:false,source:sourceF,status:'scheduled'}
];
const labels={a:'Seniors A',b:'Seniors B',veterans:'Vétérans',futsal:'Senior · Futsal'};
export function publicExternalFixtures({now=Date.now(),query='',team='all',discipline='all',period='future',includePast=false}={}){
 const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const search=normalize(String(query).trim());
 return data.filter(item=>{
   const time=Date.parse(item.date.length===10?item.date+'T12:00:00Z':item.date);
   if(!Number.isFinite(time))return false;
   if(!includePast&&time<now-24*3600000)return false;
   if(period==='future'&&time<now-24*3600000)return false;
   if(period==='week'&&(time<now-24*3600000||time>now+7*86400000))return false;
   if(team!=='all'&&team!==item.team_code)return false;
   if(discipline==='futsal'&&item.team_code!=='futsal')return false;
   if(discipline==='football'&&item.team_code==='futsal')return false;
   return !search||normalize(item.opponent+' '+labels[item.team_code]).includes(search);
 }).map(item=>Object.freeze({
   ...item,
   time:Date.parse(item.date.length===10?item.date+'T12:00:00Z':item.date),
   localDay:item.date.slice(0,10),
   dateOnly:item.date.length===10,
   team_name:labels[item.team_code],
   source_label:EXTERNAL_FIXTURE_PROVIDER,
   validated_by_club:false,
   result:item.status==='played'?item.home_score+' – '+item.away_score:null
 })).sort((a,b)=>a.time-b.time);
}
