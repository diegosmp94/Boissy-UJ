/** Private match sheet rendering boundary — no public identities or contacts. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MATCH_SHEET_STATES=Object.freeze({
 invited:'En attente',confirmed:'Présent',declined:'Absent',unsure:'Incertain'
});
const POSITIONS=Object.freeze({
 goalkeeper:'Gardien',defender:'Défenseur',midfielder:'Milieu',forward:'Attaquant'
});
export function normalizeMatchSheet(rows){
 if(!Array.isArray(rows))throw new Error('Invalid private match sheet');
 const seen=new Set();
 return rows.filter(row=>{
  if(!UUID.test(row?.player_user_id)||typeof row.display_name!=='string'
    ||row.display_name.trim().length<1||row.display_name.length>100
    ||!Object.hasOwn(MATCH_SHEET_STATES,row.callup_response)
    ||(row.position_group!==null&&row.position_group!==undefined
      &&!Object.hasOwn(POSITIONS,row.position_group))
    ||(row.shirt_number!==null&&row.shirt_number!==undefined
      &&(!Number.isInteger(row.shirt_number)||row.shirt_number<1||row.shirt_number>99))
    ||seen.has(row.player_user_id))return false;
  seen.add(row.player_user_id);return true;
 }).slice(0,150).map(row=>({
  playerId:row.player_user_id,
  name:row.display_name.trim(),
  shirt:row.shirt_number??null,
  position:POSITIONS[row.position_group]||'Poste non attribué',
  response:row.callup_response,
  responseLabel:MATCH_SHEET_STATES[row.callup_response]
 }));
}
export function sheetResponseCounts(rows){
 const counts={invited:0,confirmed:0,declined:0,unsure:0};
 for(const row of rows)if(Object.hasOwn(counts,row?.response))counts[row.response]++;
 return counts;
}
