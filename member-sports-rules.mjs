/** Role workspaces are descriptive UI only; server auth/RLS/RPC remain authoritative. */
export const PLAYER_RESPONSES=Object.freeze([
 {value:'confirmed',label:'Présent'},
 {value:'declined',label:'Absent'},
 {value:'unsure',label:'Incertain'}
]);
export const CALLOUT_STATUS=Object.freeze({
 invited:'Réponse attendue',confirmed:'Présent',declined:'Absent',
 unsure:'Incertain',cancelled:'Annulée'
});
export function hasSportsRole(roles,role){
 return Array.isArray(roles)&&['player','coach'].includes(role)&&roles.includes(role);
}
export function canRespondToCallup(callup,roles,choice){
 return hasSportsRole(roles,'player')
  &&typeof callup?.match_id==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(callup.match_id)
  &&['invited','confirmed','declined','unsure'].includes(callup.response)
  &&PLAYER_RESPONSES.some(x=>x.value===choice);
}
export function normalizeCallupRows(rows){
 if(!Array.isArray(rows))throw new Error('Invalid callup list');
 return rows.filter(row=>row&&typeof row.match_id==='string'&&typeof row.opponent_name==='string'
  &&['invited','confirmed','declined','unsure'].includes(row.response))
  .slice(0,150).sort((a,b)=>Date.parse(a.scheduled_at||0)-Date.parse(b.scheduled_at||0));
}
export function scopedCoachTeams(rows,teams,userId){
 if(!Array.isArray(rows)||!Array.isArray(teams)||!userId)return [];
 const ids=new Set(rows.filter(a=>a.coach_user_id===userId&&a.active===true).map(a=>a.team_id));
 return teams.filter(t=>ids.has(t.id));
}
export function validateCoachMatchDraft(form,authorizedTeams){
 if(!Array.isArray(authorizedTeams)||!authorizedTeams.some(t=>t.id===form.team))
  return 'Choisis une équipe qui t’est attribuée.';
 const opponent=String(form.opponent??'').trim();
 if(opponent.length<2||opponent.length>120)return 'Adversaire : 2 à 120 caractères.';
 if(!form.date||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$/.test(form.date)
  ||!Number.isFinite(Date.parse(form.date)))return 'Indique une date et une heure valides.';
 if(String(form.venue||'').length>160)return 'Le lieu ne doit pas dépasser 160 caractères.';
 return null;
}
export function coachDraftRpcArgs(form,teams){
 const error=validateCoachMatchDraft(form,teams);
 if(error)throw new Error(error);
 return {
  p_match_id:null,p_team_id:form.team,p_season_id:null,
  p_opponent_name:String(form.opponent).trim(),p_scheduled_at:new Date(form.date).toISOString(),
  p_venue:String(form.venue||'').trim(),p_is_home:form.home===true,
  p_match_status:'scheduled',p_home_score:null,p_away_score:null,
  p_source_kind:'manual',p_source_reference:null,p_publish:false
 };
}
export function sportsSafeError(error){
 if(error?.code==='42501')return 'Le serveur refuse cette opération : droits ou équipe non autorisés.';
 if(error?.code==='28000'||error?.status===401)return 'La session a expiré. Reconnecte-toi.';
 if(error?.code==='22023')return 'Les données sont invalides ou la rencontre n’est plus disponible.';
 return 'Opération indisponible. Aucun changement confirmé.';
}
