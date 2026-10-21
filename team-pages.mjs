import {supabaseConfig} from './auth-config.mjs';
import {CLUB_TEAMS} from './club-teams.mjs';

const ROOT=supabaseConfig.url+'/rest/v1/';
const node=(tag,cls='',value=null)=>{
  const item=document.createElement(tag);
  if(cls)item.className=cls;
  if(value!==null)item.textContent=String(value);
  return item;
};
const dateText=value=>value&&Number.isFinite(Date.parse(value))
  ?new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Paris'}).format(new Date(value))
  :'Date non confirmée';
const scoreText=match=>match.match_status==='played'
  &&Number.isInteger(match.home_score)&&Number.isInteger(match.away_score)
  ?String(match.home_score)+' – '+String(match.away_score):'VS';
const request=async(table,params,signal,fetcher)=>{
  const res=await fetcher(ROOT+table+'?'+new URLSearchParams(params),{
    method:'GET',signal,cache:'no-store',headers:{
      apikey:supabaseConfig.publishableKey,Accept:'application/json'
    }
  });
  if(!res.ok)throw new Error('Données officielles momentanément indisponibles');
  const rows=await res.json();
  if(!Array.isArray(rows))throw new Error('Format de données inattendu');
  return rows;
};
/** Affiche uniquement les rencontres publiées de l'équipe connue, sans données privées. */
export async function loadTeamPublishedMatches(code,{signal,fetcher=fetch}={}){
  if(!CLUB_TEAMS.some(t=>t.code===code))throw new Error('Équipe inconnue');
  const teams=await request('club_teams',{
    select:'id,code,discipline',code:'eq.'+code,limit:'1'
  },signal,fetcher);
  const team=CLUB_TEAMS.find(t=>t.code===code);
  const remote=teams.find(t=>t.code===code&&t.discipline===team.discipline);
  if(!remote)return {configured:false,matches:[]};
  const rows=await request('matches',{
    select:'id,team_id,opponent_name,scheduled_at,venue,is_home,match_status,home_score,away_score',
    team_id:'eq.'+remote.id,published:'eq.true',order:'scheduled_at.desc',limit:'80'
  },signal,fetcher);
  return {configured:true,matches:rows.filter(m=>m.team_id===remote.id
    &&['scheduled','postponed','played'].includes(m.match_status))};
}
export function groupTeamResults(matches=[]){
  return {
    upcoming:matches.filter(m=>m.match_status==='scheduled'||m.match_status==='postponed')
      .sort((a,b)=>Date.parse(a.scheduled_at)-Date.parse(b.scheduled_at)).slice(0,8),
    played:matches.filter(m=>m.match_status==='played')
      .sort((a,b)=>Date.parse(b.scheduled_at)-Date.parse(a.scheduled_at)).slice(0,8)
  };
}
let requestController=null,generation=0;
export function unmountTeamProfile(){
  generation++;requestController?.abort();requestController=null;
}
export async function mountTeamProfile(code){
  unmountTeamProfile();
  const current=generation;
  const root=document.getElementById('team-profile-live');
  if(!root||!CLUB_TEAMS.some(t=>t.code===code))return;
  const controller=new AbortController();requestController=controller;
  root.replaceChildren(node('p','team-profile-state','Chargement des rencontres publiées…'));
  try{
    const result=await loadTeamPublishedMatches(code,{signal:controller.signal});
    if(controller.signal.aborted||current!==generation||!root.isConnected)return;
    root.replaceChildren();
    if(!result.configured){
      root.append(node('p','team-profile-state','L’équipe est en cours de configuration. Aucun calendrier officiel disponible.'));return;
    }
    const groups=groupTeamResults(result.matches);
    for(const [heading,items,empty] of [
      ['Prochaines rencontres',groups.upcoming,'Aucune rencontre à venir publiée.'],
      ['Derniers résultats',groups.played,'Aucun résultat publié pour le moment.']
    ]){
      const section=node('section','team-profile-group');
      section.append(node('h2','',heading));
      const list=node('div','team-profile-matches');
      if(!items.length)list.append(node('p','team-profile-empty',empty));
      for(const match of items){
        const card=node('article','team-profile-match');
        const caption=match.match_status==='played'?'Terminé':match.match_status==='postponed'?'Reporté':'À venir';
        const opponent=match.opponent_name||'Adversaire à confirmer';
        card.append(
          node('span','team-profile-match-kind',caption),
          node('p','team-profile-match-date',dateText(match.scheduled_at)),
          node('strong','',match.is_home?'Boissy-UJ — '+opponent:opponent+' — Boissy-UJ'),
          node('p','team-profile-score',scoreText(match)),
          node('small','',match.venue||'Lieu non communiqué')
        );
        list.append(card);
      }
      section.append(list);root.append(section);
    }
    root.append(node('p','team-profile-disclaimer','Seules les rencontres publiées par le club sont affichées. Aucun classement officiel n’est déduit. Les effectifs ne figurent que dans l’annuaire public validé.'));
  }catch{
    if(controller.signal.aborted||current!==generation||!root.isConnected)return;
    root.replaceChildren(node('p','team-profile-state','Données sportives temporairement indisponibles. Aucun résultat non vérifié ne sera présenté.'));
  }
}
