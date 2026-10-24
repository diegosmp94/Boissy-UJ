import {HISTORICAL_SOURCE_RESULTS} from './historical-source-results.mjs';
import {REMAINING_OFFICIAL_SEASON_FIXTURES} from './remaining-official-season-fixtures.mjs';
/** Public SportCorico fixtures and results; past 2026–2027 matches checked on 2026-10-23.
 * These facts are attributed third-party observations, NEVER club approval or
 * an official FFF API. Never write them to Supabase automatically.
 */
export const EXTERNAL_FIXTURE_REVIEWED_AT='2026-10-23';
export const EXTERNAL_FIXTURE_PROVIDER='SportCorico';
const sourceA='https://www.sportcorico.com/clubs/boissy-uj/boissy-uj';
const sourceV='https://www.sportcorico.com/clubs/boissy-uj/boissy-uj-6?season=2026-2027';
const sourceF='https://www.sportcorico.com/clubs/boissy-uj/boissy-uj-1';
const sourceB='https://www.sportcorico.com/clubs/val-de-fontenay-as/val-de-fontenay-as-39';
/** Kickoff times are retained only when documented on the match detail page. */
const data=[
 ...REMAINING_OFFICIAL_SEASON_FIXTURES,
 {"team_code":"a","opponent":"Bann'zanmi 2","date":"2026-09-20T15:00:00+02:00","is_home":true,"source":"https://www.sportcorico.com/match/boissy-uj-seniors-1-bannzanmi-seniors-2-cehaz","home_score":6,"away_score":1,"status":"played","date_confirmed_by_club":false,"reviewed_at":"2026-10-23","venue":"Stade Maurice Préault 1"},
 {"team_code":"a","opponent":"Moldavie FC 1","date":"2026-10-04T15:00:00+02:00","is_home":false,"source":"https://www.sportcorico.com/match/moldavie-fc-seniors-1-boissy-uj-seniors-1-g3wpv","home_score":1,"away_score":3,"status":"played","date_confirmed_by_club":false,"reviewed_at":"2026-10-23","venue":"Parc des sports du Tremblay n°09"},
 {"team_code":"a","opponent":"Villejuif US 1","date":"2026-10-11T15:00:00+02:00","is_home":false,"source":"https://www.sportcorico.com/match/villejuif-us-seniors-1-boissy-uj-seniors-1-tegol","home_score":6,"away_score":0,"status":"played","date_confirmed_by_club":false,"reviewed_at":"2026-10-23","venue":"Stade Louis Dolly"},
 {"team_code":"a","opponent":"Villiers-sur-Marne ES 2","date":"2026-10-18T15:30:00+02:00","is_home":false,"source":"https://www.sportcorico.com/match/villiers-s-m-es-seniors-2-boissy-uj-seniors-1-bgt3s","home_score":1,"away_score":0,"status":"played","date_confirmed_by_club":false,"reviewed_at":"2026-10-23","venue":"Stade Octave Lapize 2"},
 {"team_code":"b","opponent":"Saint-Maur Lusitanos 2","date":"2026-10-04T15:00:00+02:00","is_home":true,"source":"https://www.sportcorico.com/match/boissy-uj-seniors-2-st-maur-lusitanos-seniors-2-ui3r3","home_score":0,"away_score":9,"status":"played","date_confirmed_by_club":false,"reviewed_at":"2026-10-23","venue":"Stade Maurice Préault 1"},
 {"team_code":"b","opponent":"Mandres-Périgny 2","date":"2026-10-18T15:00:00+02:00","is_home":true,"source":"https://www.sportcorico.com/match/boissy-uj-seniors-2-mandres-perigny-seniors-2-hzlan","home_score":2,"away_score":2,"status":"played","date_confirmed_by_club":false,"reviewed_at":"2026-10-23","venue":"Stade Maurice Préault 1"},
 {"team_code":"futsal","opponent":"Petits Anges ES 1","date":"2026-10-03T11:30:00+02:00","is_home":true,"source":"https://www.sportcorico.com/match/boissy-uj-seniors-futsal-1-petits-anges-es-seniors-futsal-1-mry0g","home_score":3,"away_score":7,"status":"played","date_confirmed_by_club":false,"reviewed_at":"2026-10-23","venue":"Gymnase Maurice Préault"},
 {"team_code":"futsal","opponent":"Maisons-Alfort FC 1","date":"2026-10-17T11:30:00+02:00","is_home":true,"source":"https://www.sportcorico.com/match/boissy-uj-seniors-futsal-1-maisons-alfort-fc-seniors-futsal-1-huhan","home_score":3,"away_score":11,"status":"played","date_confirmed_by_club":false,"reviewed_at":"2026-10-23"},
 {"team_code":"veterans","opponent":"Éléphant Côte d'Ivoire 11","date":"2026-10-04T09:30:00+02:00","is_home":false,"source":"https://www.sportcorico.com/match/elephant-cot-divoir-seniors-11-boissy-uj-seniors-11-o0ho3","home_score":10,"away_score":2,"status":"played","date_confirmed_by_club":false,"reviewed_at":"2026-10-23","venue":"Parc des sports du Tremblay n°02"},
 {"team_code":"veterans","opponent":"Bois Abbé Outre-Mer 12","date":"2026-10-18T10:00:00+02:00","is_home":true,"source":"https://www.sportcorico.com/match/boissy-uj-seniors-11-bois-abbe-outre-mer-seniors-12-tattg","home_score":12,"away_score":1,"status":"played","date_confirmed_by_club":false,"reviewed_at":"2026-10-23","venue":"Stade Maurice Préault 1"},
 {team_code:'futsal',opponent:'FC Chennevières 1',date:'2026-10-24T18:00:00+02:00',is_home:false,source:sourceF,status:'scheduled',date_confirmed_by_club:false},
 {team_code:'futsal',opponent:'Créteil Palais Futsal 2',date:'2026-10-31T11:30:00+01:00',is_home:true,source:sourceF,status:'scheduled',date_confirmed_by_club:false},
 {team_code:'b',opponent:'Val de Fontenay AS 2',date:'2026-11-01T15:00:00+01:00',is_home:false,source:sourceB,status:'scheduled',date_confirmed_by_club:false},
 {team_code:'a',opponent:'Nogent-sur-Marne FC 3',date:'2026-11-01T15:00:00+01:00',is_home:true,source:sourceA,status:'scheduled',date_confirmed_by_club:false},
 {team_code:'a',opponent:'FC Hoverla 1',date:'2026-11-08T13:00:00+01:00',is_home:false,source:sourceA,status:'scheduled',date_confirmed_by_club:false},
 {team_code:'futsal',opponent:'Av. Chouchous Vitry 1',date:'2026-11-09T20:30:00+01:00',is_home:false,source:sourceF,status:'scheduled',date_confirmed_by_club:false},
 {team_code:'futsal',opponent:'VEF 1',date:'2026-11-14T20:00:00+01:00',is_home:false,source:sourceF,status:'scheduled',date_confirmed_by_club:false},
 {team_code:'a',opponent:"Hay-les-Roses CA 2",date:'2026-11-15T15:00:00+01:00',is_home:false,source:sourceA,status:'scheduled',date_confirmed_by_club:false},
 {team_code:'veterans',opponent:'Villeneuve Ablon US 11',date:'2026-11-15T09:30:00+01:00',is_home:false,source:sourceV,status:'scheduled',date_confirmed_by_club:false},
 {team_code:'veterans',opponent:'Noiseau Sainte-S. 11',date:'2026-11-22T10:00:00+01:00',is_home:true,source:sourceV,status:'scheduled',date_confirmed_by_club:false},
 {team_code:'a',opponent:'Limeil-Brévannes AJ 2',date:'2026-11-22T15:00:00+01:00',is_home:true,source:sourceA,status:'scheduled',date_confirmed_by_club:false},
 {team_code:'futsal',opponent:'Vitry ASC 1',date:'2026-11-21T11:30:00+01:00',is_home:true,source:sourceF,status:'scheduled',date_confirmed_by_club:false},
 {team_code:'a',opponent:'US Choisy 1',date:'2026-11-29T17:00:00+01:00',is_home:false,source:sourceA,status:'scheduled',date_confirmed_by_club:false},
 {team_code:'veterans',opponent:'Villeneuve St G. Por 11',date:'2026-11-29T09:30:00+01:00',is_home:false,source:sourceV,status:'scheduled',date_confirmed_by_club:false},
 {team_code:'futsal',opponent:'Futsal Club Choisy 2',date:'2026-11-28T11:30:00+01:00',is_home:true,source:sourceF,status:'scheduled',date_confirmed_by_club:false},
 {team_code:'veterans',opponent:'Villejuif E. Benfica 11',date:'2026-12-06T10:00:00+01:00',is_home:true,source:sourceV,status:'scheduled',date_confirmed_by_club:false},
 {team_code:'futsal',opponent:'Rungis US 2',date:'2026-12-04T21:15:00+01:00',is_home:false,source:sourceF,status:'scheduled',date_confirmed_by_club:false}
];
const labels={a:'Seniors A',b:'Seniors B',veterans:'Vétérans',futsal:'Senior · Futsal'};
export function publicExternalFixtures({now=Date.now(),query='',team='all',discipline='all',period='future',includePast=false,season='all'}={}){
 const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const search=normalize(String(query).trim());
 const enrichedCurrent=data.map(x=>({...x,season:'2026-2027',
   competition:x.team_code==='a'
     ?(x.opponent==='Villejuif US 1'?'Coupe VDM Seniors':'Seniors D3 · Poule B')
     :x.team_code==='b'?'Seniors D4 · Poule C'
     :x.team_code==='veterans'?'Anciens D3 · Poule C'
     :x.opponent==='Petits Anges ES 1'?'Coupe nationale futsal':'Senior futsal D2 · Poule B'}));
 return [...enrichedCurrent,...HISTORICAL_SOURCE_RESULTS].filter(item=>{
   const time=Date.parse(item.date.length===10?item.date+'T12:00:00Z':item.date);
   if(!Number.isFinite(time))return false;
   if(!includePast&&time<now-24*3600000)return false;
   if(period==='future'&&time<now-24*3600000)return false;
   if(period==='week'&&(time<now-24*3600000||time>now+7*86400000))return false;
   if(season!=='all'&&season!==item.season)return false;
   if(team!=='all'&&team!==item.team_code)return false;
   if(discipline==='futsal'&&item.team_code!=='futsal')return false;
   if(discipline==='football'&&item.team_code==='futsal')return false;
   return !search||normalize(item.opponent+' '+labels[item.team_code]+' '+item.competition+' '+item.season).includes(search);
 }).map(item=>Object.freeze({
   ...item,
   time:Date.parse(item.date.length===10?item.date+'T12:00:00Z':item.date),
   localDay:item.date.slice(0,10),
   dateOnly:item.date.length===10,
   team_name:labels[item.team_code],
   source_label:item.source_label||(item.source.includes('thefootdata.com')?'TheFootData':EXTERNAL_FIXTURE_PROVIDER),
   validated_by_club:false,
   date_confirmed_by_club:false, // External listings cannot certify a club decision.
   result:item.result_label||(item.status==='played'?item.home_score+' – '+item.away_score:null)
 })).sort((a,b)=>a.time-b.time);
}
