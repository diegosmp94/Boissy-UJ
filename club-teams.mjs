/** Référentiel des équipes confirmé par Boissy-UJ.
 * Aucune liste d'effectifs, rencontre ou statistique n'est inventée.
 * La base Supabase demeure la référence des identifiants (UUID).
 */
export const DISCIPLINES=Object.freeze([
  {id:'football',label:'Football à 11'},
  {id:'futsal',label:'Futsal'}
]);
export const CLUB_TEAMS=Object.freeze([
  {code:'a',slug:'seniors-a',name:'Seniors A',division:'Départemental 3',discipline:'football',tag:'D3',source:'FFF',description:'Le groupe fanion de Boissy-UJ.'},
  {code:'b',slug:'seniors-b',name:'Seniors B',division:'Départemental 4',discipline:'football',tag:'D4',source:'FFF',description:'La dynamique du collectif.'},
  {code:'c',slug:'seniors-c',name:'Seniors C',division:'Matchs amicaux',discipline:'football',tag:'AMICAL',source:'Manuelle',description:'Le football et le plaisir du jeu.'},
  {code:'veterans',slug:'veterans',name:'Vétérans',division:'Départemental 3',discipline:'football',tag:'D3',source:'FFF',description:'L’expérience au service du collectif.'},
  {code:'futsal',slug:'boissy-uj-futsal',name:'Senior',division:'Départemental 2',discipline:'futsal',tag:'D2',source:'Manuelle',description:'Notre équipe de futsal, engagée en Départemental 2.'}
]);
export function teamsByDiscipline(discipline='all',teams=CLUB_TEAMS){
  return teams.filter(team=>discipline==='all'||team.discipline===discipline);
}
export function disciplineLabel(id){
  return DISCIPLINES.find(d=>d.id===id)?.label||'Discipline à confirmer';
}

/** Chemins publics canoniques, sans identifiants internes Supabase. */
export const categoryRoute=discipline=>`#/equipes/${discipline}`;
export const teamRoute=team=>`#/equipes/${team.discipline}/${team.slug}`;
export function resolveTeamRoute(path){
  const value=String(path||'');
  for(const discipline of DISCIPLINES){
    if(value===`/equipes/${discipline.id}`)return {kind:'category',discipline:discipline.id,team:null};
  }
  for(const team of CLUB_TEAMS){
    if(value===teamRoute(team).slice(1))return {kind:'team',discipline:team.discipline,team};
  }
  return null;
}
