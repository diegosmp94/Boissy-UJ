/** Manually sourced remaining 2026–2027 official league fixtures for Boissy U.J.
 * Date/time and opponent are third-party SPORTING SOURCE references, not FFF API,
 * and have NOT been separately approved by the club. Never invent results.
 * No "exempt" rest weekends, no forfeits, no cup rounds without an actual draw.
 * Do not confuse Boissy U.J. with Boissy FC or FC de Boissy 91.
 */
const source={
 a:'https://www.sportcorico.com/clubs/boissy-uj/boissy-uj',
 veterans:'https://www.sportcorico.com/clubs/boissy-uj/boissy-uj-6?season=2026-2027',
 futsal:'https://www.sportcorico.com/clubs/boissy-uj/boissy-uj-1',
 b_zenaga:'https://www.sportcorico.com/clubs/association-zenaga-de-figuig/as-zenaga-1',
 b_sfc:'https://www.sportcorico.com/clubs/sporting-football-club-de-chennevieres/sfcc-1',
 b_mimosa:'https://www.sportcorico.com/clubs/a-mimosa-mada-sport/mimosa-mada-sport',
 b_creteil:'https://www.sportcorico.com/clubs/creteil-football-academie/creteil-football-aca-1',
 b_noiseau:'https://www.sportcorico.com/clubs/noiseau-ste-s/noiseau-ste-s',
 b_lusitanos:'https://www.sportcorico.com/clubs/lusitanos-st-maur-us/st-maur-lusitanos-6'
};
/** [local day, local kickoff, opponent, Boissy is at home?, source key] */
const schedules={
 a:[
 ['2026-12-13','15:00','Phare S. Zarzissien 1',false,'a'],
 ['2027-01-24','15:00','Villiers-sur-Marne ES 2',true,'a'],
 ['2027-01-31','15:00','Nogent-sur-Marne FC 3',false,'a'],
 ['2027-02-28','15:00','FC Hoverla 1',true,'a'],
 ['2027-03-07','15:00','Limeil-Brévannes AJ 2',false,'a'],
 ['2027-03-14','15:00','US Choisy 1',true,'a'],
 ['2027-04-04','15:00',"Hay-les-Roses CA 2",true,'a'],
 ['2027-04-25','15:00','Phare S. Zarzissien 1',true,'a'],
 ['2027-05-09','15:00',"Bann'zanmi 2",false,'a'],
 ['2027-05-30','15:00','Moldavie FC 1',true,'a']
 ],
 b:[
 ['2026-11-15','15:00','SFC Canavérois 1',true,'b_sfc'],
 ['2026-11-29','15:00','Mimosa Mada-sport 1',true,'b_mimosa'],
 ['2026-12-06','15:00','Créteil Football Académie 1',false,'b_creteil'],
 ['2026-12-13','15:00','Noiseau Sainte-S. 1',true,'b_noiseau'],
 ['2027-01-17','15:00','AS Zenaga 2',false,'b_zenaga'],
 ['2027-02-28','16:00','SFC Canavérois 1',false,'b_sfc'],
 ['2027-03-14','17:00','Mimosa Mada-sport 1',false,'b_mimosa'],
 ['2027-03-21','15:00','Créteil Football Académie 1',true,'b_creteil'],
 ['2027-04-25','15:30','Noiseau Sainte-S. 1',false,'b_noiseau'],
 ['2027-05-23','15:00','AS Zenaga 2',true,'b_zenaga'],
 ['2027-05-30','15:00','St-Maur Lusitanos 2',false,'b_lusitanos']
 ],
 veterans:[
 ['2026-12-13','09:30','APSAP Médiballes 11',false,'veterans'],
 ['2027-01-17','10:00','Santeny SL 11',true,'veterans'],
 ['2027-01-24','09:30','Bois Abbé Outre-Mer 12',false,'veterans'],
 ['2027-02-28','10:00','Villeneuve Ablon US 11',true,'veterans'],
 ['2027-03-07','09:30','Noiseau Sainte-S. 11',false,'veterans'],
 ['2027-03-14','10:00','Villeneuve St G. Por 11',true,'veterans'],
 ['2027-03-21','09:30','Villejuif E. Benfica 11',false,'veterans'],
 ['2027-04-04','09:30','Santeny SL 11',false,'veterans'],
 ['2027-04-25','10:00','APSAP Médiballes 11',true,'veterans'],
 ['2027-05-23','10:00',"Éléphant Côte d'Ivoire 11",true,'veterans']
 ],
 futsal:[
 ['2026-12-19','20:00','FC Stay Strong 1',false,'futsal'],
 ['2027-01-21','20:30','Vitry CA 1',false,'futsal'],
 ['2027-01-30','11:30','VEF 1',true,'futsal'],
 // Public sources include an anomalous 2–12 score dated 2027-02-20:
 // retain ONLY the opponent/fixture, never claim a future result.
 ['2027-02-20',null,'FC Chennevières 1',true,'futsal'],
 ['2027-02-27','11:30','Av. Chouchous Vitry 1',true,'futsal'],
 ['2027-03-05','20:30','Vitry ASC 1',false,'futsal'],
 ['2027-03-13','11:30','Rungis US 2',true,'futsal'],
 ['2027-03-27','19:00','Futsal Club Choisy 2',false,'futsal'],
 ['2027-04-05','21:15','Créteil Palais Futsal 2',false,'futsal'],
 ['2027-04-24','11:30','FC Stay Strong 1',true,'futsal'],
 ['2027-05-08','11:30','Vitry CA 1',true,'futsal'],
 ['2027-05-17','20:30','Maisons-Alfort FC 1',false,'futsal']
 ]
};
function toDate(day,clock){
 if(!clock)return day; // Unknown kickoff: date only; never manufacture an hour.
 const parisSummer=day<'2026-10-25'||day>='2027-03-28';
 return day+'T'+clock+':00'+(parisSummer?'+02:00':'+01:00');
}
export const REMAINING_OFFICIAL_SEASON_FIXTURES=Object.freeze(Object.entries(schedules)
 .flatMap(([team_code,rows])=>rows.map(([day,clock,opponent,is_home,ref])=>Object.freeze({
  team_code,opponent,date:toDate(day,clock),is_home,source:source[ref],
  status:'scheduled',date_confirmed_by_club:false,
  competition:team_code==='a'?'Seniors D3 · Poule B':
   team_code==='b'?'Seniors D4 · Poule C':
   team_code==='veterans'?'Anciens D3 · Poule C':'Senior futsal D2 · Poule B'
 }))));
