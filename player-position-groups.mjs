/** Four positions shared by public grouping and scoped team roster editing. */
export const PLAYER_POSITION_GROUPS=Object.freeze([
 Object.freeze({id:'goalkeeper',label:'Gardiens',singular:'Gardien'}),
 Object.freeze({id:'defender',label:'Défenseurs',singular:'Défenseur'}),
 Object.freeze({id:'midfielder',label:'Milieux',singular:'Milieu'}),
 Object.freeze({id:'forward',label:'Attaquants',singular:'Attaquant'})
]);
export function positionFromPublicRole(role){
 const text=String(role||'').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('fr-FR');
 if(/^(gardien|goalkeeper|gb)(\b|\s|$)/.test(text))return 'goalkeeper';
 if(/^(defenseur|defense|defender|arriere|lateral)(\b|\s|$)/.test(text))return 'defender';
 if(/^(milieu|midfielder)(\b|\s|$)/.test(text))return 'midfielder';
 if(/^(attaquant|avant|ailier|buteur|forward)(\b|\s|$)/.test(text))return 'forward';
 return null;
}
export function groupPublishedPlayers(people){
 const groups=Object.fromEntries(PLAYER_POSITION_GROUPS.map(p=>[p.id,[]]));
 const unclassified=[];
 for(const p of people){
  if(p?.person_kind!=='player'||p.published!==true||p.consent_confirmed!==true)continue;
  const key=positionFromPublicRole(p.role_label);
  if(key)groups[key].push(p);
  else unclassified.push(p);
 }
 return {groups,unclassified};
}
export function validPrivatePosition(id){
 return PLAYER_POSITION_GROUPS.some(p=>p.id===id);
}
export function safeShirtNumber(value){
 const str=String(value??'').trim();
 return /^(?:[1-9]|[1-9][0-9])$/.test(str)?Number(str):null;
}
