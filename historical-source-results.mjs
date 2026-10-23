/** Historical 2025–2026 match scores extracted from attributed public sources.
 * These are THIRD-PARTY references, not validated club records or FFF publication.
 * Date-only precision: no kickoff hour has been inferred.
 */
const sourceB='https://thefootdata.com/clubs/boissy-uj?equipe=25504-SEM-2&saison=2025';
const sourceA='https://thefootdata.com/clubs/boissy-uj?equipe=25504-SEM-1&saison=2025';
const sourceAR='https://thefootdata.com/clubs/usjto-ukraine?equipe=204300-SEM-1&saison=2025';
const sourceF='https://thefootdata.com/clubs/boissy-uj?equipe=25504-SESM-1&saison=2025';
/** [day, opponent, home?, home-score, away-score, competition] */
const b=[
 ['2025-09-28','Bry FC',true,3,5,'Coupe Seniors Amitié'],
 ['2025-10-19','Marolles FC',true,3,5,'Seniors D4 · Poule B'],
 ['2025-11-09','Val de Fontenay AS',true,6,0,'Seniors D4 · Poule B'],
 ['2025-11-16','FC Hoverla',false,8,2,'Seniors D4 · Poule B'],
 ['2025-11-30','Créteil Football Académie',true,1,4,'Seniors D4 · Poule B'],
 ['2025-12-07','Valenton Foot Acad.',false,8,0,'Seniors D4 · Poule B'],
 ['2026-01-11','Arcueil Com',true,3,1,'Seniors D4 · Poule B'],
 ['2026-01-18','Villiers Globe Foot',false,2,2,'Seniors D4 · Poule B'],
 ['2026-01-25','Marolles FC',false,9,1,'Seniors D4 · Poule B'],
 ['2026-02-01','FC Hoverla',true,3,3,'Seniors D4 · Poule B'],
 ['2026-02-08','Val de Fontenay AS',false,6,1,'Seniors D4 · Poule B'],
 ['2026-03-22','Valenton Foot Acad.',true,2,9,'Seniors D4 · Poule B'],
 ['2026-04-19','Créteil Football Académie',false,4,4,'Seniors D4 · Poule B'],
 ['2026-05-10','Villiers Globe Foot',true,1,4,'Seniors D4 · Poule B'],
 ['2026-05-17','Arcueil Com',false,1,2,'Seniors D4 · Poule B']
];
const a=[
 ['2025-09-28','USJTO Ukraine',true,0,2,'Coupe VDM Seniors',sourceA],
 ['2025-12-07','USJTO Ukraine',true,1,1,'Seniors D4 · Poule A',sourceAR],
 ['2026-03-22','USJTO Ukraine',false,0,1,'Seniors D4 · Poule A',sourceAR]
];
const f=[
 ['2025-09-13','Noisiel FA',false,3,0,'Coupe nationale futsal'],
 ['2025-09-19','VSG Futsal 2',false,5,0,'Senior futsal D1'],
 ['2025-09-27','Chevilly-Larue Élan',false,6,2,'Senior futsal D1'],
 ['2025-10-18','Citoyen du Monde',true,1,5,'Senior futsal D1'],
 ['2025-10-25',"FC Vers l'Avant Vitry",true,4,7,'Senior futsal D1'],
 ['2025-11-08','B2M Futsal 2',false,1,7,'Senior futsal D1'],
 ['2025-11-22','Saint-Maurice AJ',true,5,8,'Senior futsal D1'],
 ['2025-12-06','Champigny CF 2',false,5,0,'Senior futsal D1'],
 ['2025-12-20','KB Futsal 2',false,7,7,'Senior futsal D1'],
 ['2026-01-17','Maisons-Alfort FC',true,5,8,'Coupe VDM Futsal'],
 ['2026-01-24','Rungis US',true,0,12,'Senior futsal D1'],
 ['2026-01-31','Chevilly-Larue Élan',true,3,4,'Senior futsal D1'],
 ['2026-02-07',"FC Vers l'Avant Vitry",false,9,5,'Senior futsal D1'],
 ['2026-02-21','B2M Futsal 2',true,6,6,'Senior futsal D1'],
 ['2026-03-21','Champigny CF 2',true,3,7,'Senior futsal D1'],
 ['2026-03-27','Citoyen du Monde',false,5,1,'Senior futsal D1'],
 ['2026-04-04','Saint-Maurice AJ',false,8,3,'Senior futsal D1'],
 ['2026-04-11','KB Futsal 2',true,5,10,'Senior futsal D1']
];
function adapt(items,team_code,source){
 return items.map(([date,opponent,is_home,home_score,away_score,competition,override])=>Object.freeze({
  team_code,date,opponent,is_home,home_score,away_score,competition,
  source:override||source,status:'played',season:'2025-2026',reviewed_at:'2026-10-23'
 }));
}
export const HISTORICAL_SOURCE_RESULTS=Object.freeze([
 ...adapt(a,'a',sourceA),
 ...adapt(b,'b',sourceB),
 ...adapt(f,'futsal',sourceF),
 Object.freeze({team_code:'futsal',date:'2026-05-08T21:15:00+02:00',opponent:'Rungis US',
  is_home:false,competition:'Senior futsal D1',season:'2025-2026',status:'administrative',
  administrative_outcome:'V',reviewed_at:'2026-10-23',
  result_label:'Gain administratif de Boissy · match non joué · aucun but attribué',
  source_label:'District du Val-de-Marne · PV d’appel du 28 mai 2026',
  source:'https://districtvaldemarne.fff.fr/wp-content/uploads/sites/99/bsk-pdf-manager/02bcc023ed917590686a59c85d3f424e.pdf'})
]);
