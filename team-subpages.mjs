import {CLUB_TEAMS,teamRoute} from './club-teams.mjs';

export const TEAM_SUBPAGE_SECTIONS=Object.freeze([
 Object.freeze({id:'joueurs',label:'Joueurs'}),
 Object.freeze({id:'matchs',label:'Matchs'}),
 Object.freeze({id:'actualites',label:'Actualités'})
]);

/** Canonical public paths; no untrusted team identifiers become URLs or SQL filters. */
export function teamSubpageRoute(team,section){
 const known=CLUB_TEAMS.find(t=>t.code===team?.code&&
  t.discipline===team?.discipline&&t.slug===team?.slug);
 if(!known||!TEAM_SUBPAGE_SECTIONS.some(s=>s.id===section))
  throw new Error('Sous-page équipe inconnue');
 return teamRoute(known)+'/'+section;
}
export function resolveTeamSubpageRoute(path){
 for(const team of CLUB_TEAMS){
  for(const section of TEAM_SUBPAGE_SECTIONS){
   if(path===teamSubpageRoute(team,section.id).slice(1))
    return {team,section:section.id};
  }
 }
 return null;
}
/** Interpolations are strictly the hardcoded CLUB_TEAMS whitelist. */
export function teamSubpageNavigation(team,active='presentation'){
 const known=CLUB_TEAMS.find(t=>t.code===team?.code&&
  t.discipline===team?.discipline&&t.slug===team?.slug);
 if(!known)throw new Error('Équipe inconnue');
 const items=[{id:'presentation',label:'Présentation',href:teamRoute(known)},
  ...TEAM_SUBPAGE_SECTIONS.map(s=>({...s,href:teamSubpageRoute(known,s.id)}))];
 return '<nav class="team-subpage-navigation" aria-label="Rubriques '+known.name+'">'+
  items.map(item=>'<a href="'+item.href+'"'+
    (item.id===active?' aria-current="page"':'')+'>'+item.label+'</a>').join('')+
  '</nav>';
}
