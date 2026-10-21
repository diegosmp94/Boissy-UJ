import {CLUB_TEAMS} from './club-teams.mjs';
const codes=new Set(CLUB_TEAMS.map(t=>t.code));
/** Public, deterministic deep links; unknown codes are never used as API filters. */
export function teamDeepLink(section,teamCode){
 if(!['matchs','actualites'].includes(section)||!codes.has(teamCode))
  throw new Error('Lien équipe inconnu');
 return '#/'+section+'?equipe='+encodeURIComponent(teamCode);
}
export function parsePublicRoute(hash){
 const value=String(hash||'').replace(/^#/,'');
 const index=value.indexOf('?');
 const pathname=index===-1?value:value.slice(0,index);
 const query=index===-1?'':value.slice(index+1);
 let path='/';
 try{path=decodeURI(pathname||'/')||'/'}catch{}
 const code=new URLSearchParams(query).get('equipe');
 return {path,teamCode:code&&codes.has(code)?code:null};
}
