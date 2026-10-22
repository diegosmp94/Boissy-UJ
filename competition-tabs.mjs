/** Competition categories are per-team and per-season.
 * Source dates acknowledged by the club are NOT approval of score or result.
 */
export const COMPETITION_KINDS=Object.freeze(['league','cup']);
export function competitionKind(item){
 const raw=item?.competition_kind;
 if(raw==='league'||raw==='cup')return raw;
 if(raw==='friendly')return 'friendly';
 if(raw==='unspecified')return 'unspecified';
 const label=String(item?.competition??item?.competition_label??'').trim();
 if(/\b(coupe|troph[eé]e|challenge)\b/i.test(label))return 'cup';
 if(/\b(championnat|poule|d[1-9]|ligue|crit[eé]rium)\b/i.test(label))return 'league';
 return 'unspecified';
}
export const SEASON_2026_COMPETITIONS=Object.freeze({
 a:Object.freeze({league:'Seniors D3 · Poule B',cup:'Coupe du Val-de-Marne Seniors',cupParticipation:'played'}),
 b:Object.freeze({league:'Seniors D4 · Poule C',cup:null,cupParticipation:'none'}),
 c:Object.freeze({league:'Rencontres amicales',cup:null,cupParticipation:'none'}),
 veterans:Object.freeze({league:'Anciens D3 · Poule C',cup:'Coupe du Val-de-Marne — Vétérans',cupParticipation:'reported'}),
 futsal:Object.freeze({league:'Senior futsal D2 · Poule B',cup:'Coupe nationale futsal',cupParticipation:'played'})
});
export function cupInformation(code,season='2026-2027',cupFixtures=[]){
 if(season!=='2026-2027'){
  const labels=[...new Set(cupFixtures.filter(x=>x.season===season&&competitionKind(x)==='cup')
    .map(x=>x.competition).filter(Boolean))];
  return {available:labels.length>0,headline:labels.join(' · '),
   detail:labels.length?'Archives des matchs de coupe retrouvés pour cette saison.':
    'Aucune participation à une coupe documentée pour cette saison.'};
 }
 const conf=SEASON_2026_COMPETITIONS[code];
 if(!conf?.cup)return {available:false,headline:'Aucune coupe pour cette équipe',
  detail:'Aucune participation en coupe annoncée pour 2026–2027. Les archives des saisons précédentes restent consultables.'};
 if(code==='veterans')return {available:true,headline:conf.cup,
  detail:'Participation en coupe confirmée par le club. Aucun adversaire, résultat ou date de coupe des Vétérans n’est encore renseigné ici ; l’intitulé exact reste à préciser.'};
 return {available:true,headline:conf.cup,
  detail:'Rencontres de coupe retrouvées pour cette équipe ; seules les dates ont été confirmées par le club, pas les scores externes.'};
}
export function buildCompetitionTabs(root,{onChange=()=>{},defaultKind='league'}={}){
 const tabs=document.createElement('div');tabs.className='competition-tabs';
 tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Type de compétition');
 let kind=COMPETITION_KINDS.includes(defaultKind)?defaultKind:'league';
 const controls=COMPETITION_KINDS.map((value)=>{
  const b=document.createElement('button');b.type='button';
  b.className='competition-tab';b.dataset.competition=value;
  b.textContent=value==='league'?'Championnat':'Coupe';
  tabs.append(b);return {value,b};
 });
 const update=()=>{
  for(const {value,b} of controls){
   const selected=value===kind;b.setAttribute('aria-pressed',String(selected));
   b.classList.toggle('is-active',selected);
  }
 };
 for(const {value,b} of controls)b.addEventListener('click',()=>{
  if(kind===value)return;kind=value;update();onChange(kind);
 });
 update();root.append(tabs);
 return {element:tabs,get value(){return kind;},set value(v){
   if(!COMPETITION_KINDS.includes(v))return;kind=v;update();onChange(v);
 }};
}
