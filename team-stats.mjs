import {supabaseConfig} from './auth-config.mjs';

/** Club totals computed from published completed matches only; no player data. */
export function validateTeamFormRows(rows){
  if(!Array.isArray(rows))throw new Error('Invalid statistics');
  const expected=new Set(['a','b','c','veterans']);
  if(rows.length!==4||new Set(rows.map(x=>x.code)).size!==4
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
    const rows=await getTeamSummary({signal:ctrl.signal});
    if(ctrl.signal.aborted||current!==generation||!root.isConnected)return;
    root.replaceChildren();
    const cards=el('div','sport-form-grid');
    for(const row of rows){
      const card=el('article','sport-form-card');
      card.append(el('span','sport-pill',row.division),el('h3','',row.name));
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
