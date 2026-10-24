/** Public homepage collective congratulations when all four squads win in
 * the same recent week. No secret token, identity, background polling or writes.
 */
import {supabaseConfig} from './auth-config.mjs';
import {collectiveVictoryCongratulations} from './victory-congratulations.mjs';
import {createVictoryNotice} from './victory-notice.mjs';
import {boundedPublicRequest} from './public-catalog-timeout.mjs';

const BASE=supabaseConfig.url+'/rest/v1/';
let sequence=0,request=null;
export function unmountHomeVictory(){
 sequence++;request?.abort();request=null;
}
export async function loadHomeVictory({signal,fetcher=fetch,now=Date.now()}={}){
 const since=new Date(now-14*86400000).toISOString();
 const sources=[
  ['club_teams',{select:'id,code',order:'sort_order.asc',limit:'5'}],
  ['matches',{select:'id,team_id,scheduled_at,is_home,home_score,away_score,match_status,published',
   published:'eq.true',match_status:'eq.played',
   scheduled_at:'gte.'+since,order:'scheduled_at.desc',limit:'100'}]
 ];
 const [teams,matches]=await Promise.all(sources.map(async([table,params])=>{
  const response=await fetcher(BASE+table+'?'+new URLSearchParams(params),{
   method:'GET',signal,cache:'no-store',
   headers:{apikey:supabaseConfig.publishableKey,Accept:'application/json'}
  });
  if(!response.ok)throw Error('Résumé des victoires indisponible');
  const value=await response.json();
  if(!Array.isArray(value))throw Error('Format du résumé invalide');
  return value;
 }));
 if(signal?.aborted)throw Error('Chargement annulé');
 return collectiveVictoryCongratulations(matches,teams,{now});
}
export async function mountHomeVictory(){
 unmountHomeVictory();
 const id=sequence,root=document.getElementById('home-victory-banner');
 if(!root)return;
 const controller=new AbortController();request=controller;
 const deadline=boundedPublicRequest(controller.signal);
 root.replaceChildren();
 try{
  const notice=await loadHomeVictory({signal:deadline.signal});
  if(controller.signal.aborted||sequence!==id||!root.isConnected)return;
  if(notice){
   const card=createVictoryNotice(notice,{collective:true});
   const link=document.createElement('a');
   link.href='#/matchs';
   link.className='victory-home-link';
   link.textContent='Voir les résultats des équipes ↗';
   card.append(link);
   root.append(card);
  }
 }catch{
  // Failure is safe and silent: never display unverified congratulation text.
  if(controller.signal.aborted||sequence!==id)return;
  root.replaceChildren();
 }finally{deadline.dispose();}
}
