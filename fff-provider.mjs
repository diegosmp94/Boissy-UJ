/** Future official FFF partner feed: isolated, offline preview and strict schema checks.
 * No endpoint is contacted: FFF permission and data contract are prerequisites.
 * Do not identify source as official until its provenance is independently verified.
 */
export const FFF_CLUB_AFFILIATION='548423';
export const FFF_PUBLIC_PORTAL='https://epreuves.fff.fr/';
export const FFF_FEED_STATUS='access-not-granted';
export const FFF_ALLOWED_TEAMS=Object.freeze(['a','b','c','veterans','futsal']);
const STATUS=new Set(['scheduled','played','postponed','cancelled']);
const ALLOWED_ENTRY_KEYS=new Set(['match_id','team_code','opponent','start_at','venue','is_home','status','home_score','away_score','source_url']);
const bad=()=>{throw new Error('Flux FFF non conforme : contrôle du club, des équipes, des dates ou des droits requis.');};
function authorizedMatchUrl(value){
 if(typeof value!=='string'||value.length>280)return false;
 try{
  const url=new URL(value);
  return url.protocol==='https:'&&url.username===''&&url.password===''&&url.port===''&&
    ['fff.fr','www.fff.fr','epreuves.fff.fr'].includes(url.hostname)&&url.pathname.length>1;
 }catch{return false;}
}
/** The input is a future documented, licensed partner export, not today's unofficial
 * DOFA endpoint shape. A human must verify data provenance and matching before use.
 * Returns preview data ONLY: it never creates/updates public matches.
 */
export function previewAuthorizedFffFeed(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
    input.schema_version!==1||input.club_affiliation!==FFF_CLUB_AFFILIATION||
    !Array.isArray(input.matches)||input.matches.length>250)bad();
 const ids=new Set(),out=[];
 for(const item of input.matches){
  if(!item||typeof item!=='object'||Array.isArray(item)||
     Object.keys(item).some(k=>!ALLOWED_ENTRY_KEYS.has(k)))bad();
  const {match_id,team_code,opponent,start_at,venue,is_home,status,home_score,away_score,source_url}=item;
  if(typeof match_id!=='string'||!/^[A-Za-z0-9-]{1,80}$/.test(match_id)||ids.has(match_id))bad();
  ids.add(match_id);
  const ms=typeof start_at==='string'?Date.parse(start_at):NaN;
  if(!FFF_ALLOWED_TEAMS.includes(team_code)||typeof opponent!=='string'||
     opponent.trim().length<2||opponent.trim().length>120||
     !Number.isFinite(ms)||typeof is_home!=='boolean'||!STATUS.has(status)||
     !authorizedMatchUrl(source_url)||
     (venue!==undefined&&(typeof venue!=='string'||venue.length>160)))bad();
  const played=status==='played';
  if(played&&(!Number.isInteger(home_score)||home_score<0||home_score>99||
              !Number.isInteger(away_score)||away_score<0||away_score>99))bad();
  if(!played&&((home_score!==undefined&&home_score!==null)||
              (away_score!==undefined&&away_score!==null)))bad();
  out.push(Object.freeze({
    external_id:match_id,team_code,opponent_name:opponent.trim(),
    scheduled_at:new Date(ms).toISOString(),venue:venue?.trim()||'',
    is_home,match_status:status,
    home_score:played?home_score:null,away_score:played?away_score:null,
    source_kind:'fff',source_reference:source_url
  }));
 }
 return Object.freeze(out);
}
