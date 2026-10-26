import {supabaseConfig} from './auth-config.mjs';

/** Club totals computed from published completed matches only; no player data. */
export function validateTeamFormRows(rows){
  if(!Array.isArray(rows))throw new Error('Invalid statistics');
  const expected=new Set(['a','b','c','veterans','futsal']);
  if(rows.length!==5||new Set(rows.map(x=>x.code)).size!==5
    ||!rows.every(x=>expected.has(x.code)))throw new Error('Incomplete team summary');
  return rows.map(row=>{
    for(const key of ['played','wins','draws','losses','goals_for','goals_against']){
      if(!Number.isSafeInteger(row[key])||row[key]<0)
        throw new Error('Invalid statistic '+key);
    }
    if(row.played!==row.wins+row.draws+row.losses)
      throw new Error('Inconsistent results');
    return {...row};
  });
}
export async function getTeamSummary({signal,fetcher=fetch}={}){
  const query=new URLSearchParams({
    select:'team_id,code,name,division,played,wins,draws,losses,goals_for,goals_against',
    order:'code.asc'
  });
  const res=await fetcher(supabaseConfig.url+'/rest/v1/team_form_summary?'+query,{
    method:'GET',signal,cache:'no-store',
    headers:{apikey:supabaseConfig.publishableKey,Accept:'application/json'}
  });
  if(!res.ok)throw new Error('Bilan sportif momentanément indisponible');
  return validateTeamFormRows(await res.json());
}
/** Per-season, per-competition *club* results. Never a full-league rank. */
export function validateCompetitionFormRows(rows){
 if(!Array.isArray(rows))throw new Error('Invalid competition summaries');
 const teams=new Set(['a','b','c','veterans','futsal']);
 const seen=new Set();
 return rows.map(row=>{
  if(!row||!teams.has(row.code)||typeof row.team_id!=='string'||!row.team_id||
     !['league','cup','friendly'].includes(row.competition_kind)||
     (row.season_id!==null&&typeof row.season_id!=='string')||
     (row.season_label!==null&&
       (typeof row.season_label!=='string'||!/^[0-9]{4}\/[0-9]{4}$/.test(row.season_label))))
   throw new Error('Invalid competition classification');
  const id=[row.team_id,row.season_id??'no-season',row.competition_kind].join('|');
  if(seen.has(id))throw new Error('Duplicate competition summary');
  seen.add(id);
  for(const key of ['played','wins','draws','losses','goals_for','goals_against']){
   if(!Number.isSafeInteger(row[key])||row[key]<0)
    throw new Error('Invalid competition statistic');
  }
  if(row.played<1||row.played!==row.wins+row.draws+row.losses)
   throw new Error('Inconsistent competition results');
  return {...row};
 });
}
export async function getTeamCompetitionSummary({signal,fetcher=fetch}={}){
 const query=new URLSearchParams({
  select:'team_id,code,name,division,season_id,season_label,competition_kind,played,wins,draws,losses,goals_for,goals_against',
  order:'code.asc,season_label.desc,competition_kind.asc',
  limit:'200'
 });
 const response=await fetcher(supabaseConfig.url+'/rest/v1/team_competition_form_summary?'+query,{
  method:'GET',signal,cache:'no-store',
  headers:{apikey:supabaseConfig.publishableKey,Accept:'application/json'}
 });
 if(!response.ok)throw new Error('Bilans des compétitions indisponibles');
 return validateCompetitionFormRows(await response.json());
}
const competitionNames=Object.freeze({league:'Championnat',cup:'Coupe',friendly:'Amical'});
const el=(tag,cls='',value=null)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(value!==null)node.textContent=String(value);
  return node;
};
let request=null;
let generation=0;
export function unmountTeamStats(){
  generation++;
  request?.abort();
  request=null;
}
export async function mountTeamStats(){
  unmountTeamStats();
  const root=document.getElementById('team-form-public');
  if(!root)return;
  const current=generation;
  const ctrl=new AbortController();
  request=ctrl;
  root.replaceChildren(el('p','sport-loading','Chargement des bilans d’équipes…'));
  try{
    const [totalsResult,competitionResult]=await Promise.allSettled([
      getTeamSummary({signal:ctrl.signal}),
      getTeamCompetitionSummary({signal:ctrl.signal})
    ]);
    if(ctrl.signal.aborted||current!==generation||!root.isConnected)return;
    if(totalsResult.status!=='fulfilled')throw new Error('Team totals unavailable');
    const rows=totalsResult.value;
    const breakdown=competitionResult.status==='fulfilled'?competitionResult.value:null;
    root.replaceChildren();
    const cards=el('div','sport-form-grid');
    for(const row of rows){
      const card=el('article','sport-form-card');
      card.append(el('span','sport-pill',row.code==='futsal'?'Futsal · '+row.division:'Football · '+row.division),el('h3','',row.name));
      if(!row.played){
        card.append(el('p','sport-form-empty','Aucun résultat terminé publié.'));
      }else{
        card.append(el('strong','sport-form-record',
          row.wins+' V · '+row.draws+' N · '+row.losses+' D'));
        const body=el('dl','sport-form-details');
        for(const [name,count] of [
          ['Matchs joués',row.played],['Buts marqués',row.goals_for],
          ['Buts encaissés',row.goals_against]
        ])body.append(el('dt','',name),el('dd','',count));
        card.append(body);
      }
      const scoped=breakdown?.filter(x=>x.team_id===row.team_id)||[];
      const overview=el('p','sport-form-disclaimer','Total : toutes saisons et compétitions publiées.');
      card.append(overview);
      if(scoped.length){
       const heading=el('h4','sport-form-subtitle','Résultats par saison et compétition');
       const items=el('ul','sport-form-competition-list');
       for(const x of scoped){
        const name=competitionNames[x.competition_kind];
        const season=x.season_label||'Saison non renseignée';
        items.append(el('li','',season+' · '+name+' · '+x.played+' match(s) · '+
          x.wins+' V / '+x.draws+' N / '+x.losses+' D · '+
          x.goals_for+' BP / '+x.goals_against+' BC'));
       }
       card.append(heading,items);
      }else if(breakdown===null){
       card.append(el('p','sport-form-empty','Détail Championnat/Coupe temporairement indisponible.'));
      }else{
       card.append(el('p','sport-form-empty','Aucun résultat détaillé validé pour le moment.'));
      }
      cards.append(card);
    }
    root.append(cards,el('p','sport-form-disclaimer',
      'Bilan calculé uniquement à partir des résultats publiés par Boissy-UJ. Ne constitue pas un classement officiel FFF.'));
  }catch{
    if(ctrl.signal.aborted||current!==generation||!root.isConnected)return;
    root.replaceChildren(el('p','sport-error',
      'Le bilan collectif est temporairement indisponible ; aucun chiffre non vérifié n’est affiché.'));
  }
}
