/** Input validation for server-scoped invitations; never use client-supplied team rights. */
export const INVITATION_LABELS=Object.freeze({
 invited:'En attente',confirmed:'Présent',declined:'Absent',unsure:'Incertain',cancelled:'Annulée'
});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function normalizeCoachFixtures(rows){
 if(!Array.isArray(rows))throw new Error('Invalid fixtures');
 return rows.filter(m=>UUID.test(m?.match_id)&&typeof m?.opponent_name==='string'
   &&['scheduled','postponed'].includes(m.match_status)).slice(0,100);
}
export function normalizeCoachRoster(rows){
 if(!Array.isArray(rows))throw new Error('Invalid roster');
 return rows.filter(p=>UUID.test(p?.player_user_id)&&typeof p?.display_name==='string'
   &&p.display_name.length>=1&&p.display_name.length<=100
   &&(p.callup_response===null||p.callup_response===undefined
    ||Object.hasOwn(INVITATION_LABELS,p.callup_response)))
   .slice(0,150);
}
export function canChangeInvitation(player,invite){
 if(typeof invite!=='boolean'||!UUID.test(player?.player_user_id))return false;
 const response=player.callup_response??null;
 return invite?(response===null||response==='cancelled')
   :['invited','confirmed','declined','unsure'].includes(response);
}
export function invitationArgs(matchId,player,invite){
 if(!UUID.test(matchId)||!canChangeInvitation(player,invite))throw new Error('Invalid invitation');
 return {p_match_id:matchId,p_player_user_id:player.player_user_id,p_invite:invite};
}
