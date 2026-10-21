import {supabaseConfig} from './auth-config.mjs';

const TEAM_LABELS=Object.freeze({
  a:'Seniors A',b:'Seniors B',c:'Seniors C'
});
const STATUS_LABELS=Object.freeze({
  coming:'À venir',open:'Période de vote annoncée',
  closed:'Votes clôturés',finished:'Édition terminée'
});
const make=(tag,cls='',text=null)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!==null)node.textContent=String(text);
  return node;
};

export function normalizeAwardText(value){
  return String(value||'').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-FR');
}
export function filterAwards(awards,{team='all',status='all',query=''}={}){
  const text=normalizeAwardText(query.trim());
  return awards.filter(a=>(team==='all'||a.team_code===team)
    && (status==='all'||a.voting_status===status)
    && (!text||[a.title,a.description,a.season_label,TEAM_LABELS[a.team_code]]
      .some(x=>normalizeAwardText(x).includes(text))))
    .sort((a,b)=>(a.team_code||'').localeCompare(b.team_code||'')
      ||(a.title||'').localeCompare(b.title||'','fr'));
}
export function publishedWinner(award,results,nominees){
  if(!award?.results_published||award.voting_status!=='finished')return null;
  const result=results.find(r=>r.award_id===award.id);
  if(!result)return null;
  return nominees.find(n=>n.id===result.nominee_id && n.award_id===award.id
    && n.consent_reviewed===true&&n.published===true)||null;
}

async function getRows(table,columns,query,signal,fetcher=fetch){
  const args=new URLSearchParams({select:columns,...query});
  const url=supabaseConfig.url+'/rest/v1/'+table+'?'+args;
  const response=await fetcher(url,{method:'GET',signal,cache:'no-store',
    headers:{apikey:supabaseConfig.publishableKey,Accept:'application/json'}});
  if(!response.ok)throw new Error('Catalogue Awards indisponible');
  const body=await response.json();
  if(!Array.isArray(body))throw new Error('Résultat du catalogue inattendu');
  return body;
}
export async function fetchPublishedAwards(signal,fetcher=fetch){
  const [awards,nominees,results]=await Promise.all([
    getRows('club_awards',
      'id,title,description,team_code,season_label,voting_status,opens_at,closes_at,results_published',
      {published:'eq.true',order:'team_code.asc,title.asc',limit:'90'},signal,fetcher),
    getRows('club_award_nominees','id,award_id,display_label,published,consent_reviewed,sort_order',
      {published:'eq.true',consent_reviewed:'eq.true',order:'sort_order.asc',limit:'300'},signal,fetcher),
    getRows('club_award_results','award_id,nominee_id',
      {order:'award_id.asc',limit:'90'},signal,fetcher)
  ]);
  return {awards,nominees,results};
}
function dateFr(s){
  if(!s||Number.isNaN(Date.parse(s)))return null;
  return new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',
    timeStyle:'short',timeZone:'Europe/Paris'}).format(new Date(s));
}
function awardCard(award,nominees,results){
  const card=make('article','award-card');
  const meta=make('div','award-card-meta');
  meta.append(make('span','award-team',TEAM_LABELS[award.team_code]||'Équipe'),
    make('span','award-status',STATUS_LABELS[award.voting_status]||'Édition à confirmer'));
  card.append(meta,make('h3','',award.title));
  if(award.description)card.append(make('p','award-desc',award.description));
  if(award.season_label)card.append(make('p','award-season','Saison : '+award.season_label));
  const start=dateFr(award.opens_at),end=dateFr(award.closes_at);
  if(start&&end){
    const dates=make('p','award-dates','Période annoncée : du '+start+' au '+end);
    card.append(dates);
  }
  const allowed=nominees.filter(x=>x.award_id===award.id&&x.published===true
    &&x.consent_reviewed===true).sort((a,b)=>a.sort_order-b.sort_order);
  const heading=make('h4','','Nominations publiées');
  card.append(heading);
  if(!allowed.length){
    card.append(make('p','award-empty-nominees','Aucun nominé officiellement publié pour le moment.'));
  }else {
    const list=make('ul','award-nominees');
    for(const person of allowed){
      list.append(make('li','',person.display_label));
    }
    card.append(list);
  }
  const winner=publishedWinner(award,results,allowed);
  if(winner){
    const result=make('div','award-winner');
    result.append(make('span','award-winner-label','RÉSULTAT PUBLIÉ'),
      make('strong','',winner.display_label));
    card.append(result);
  } else {
    card.append(make('p','award-vote-note',
      'Aucun vote en ligne actif dans cette préversion. Résultats publiés uniquement après vérification du club.'));
  }
  return card;
}
function build(root,data){
  root.replaceChildren();
  const controls=make('div','award-controls');
  const mkSelect=(title,options)=>{
    const label=make('label','award-label',title);
    const select=make('select','award-select');
    select.setAttribute('aria-label',title);
    for(const [value,display] of options){
      const option=make('option','',display);
      option.value=value;select.append(option);
    }
    label.append(select);
    return {label,select};
  };
  const team=mkSelect('Équipe',[['all','Toutes les équipes'],
    ['a','Seniors A'],['b','Seniors B'],['c','Seniors C']]);
  const status=mkSelect('Édition',[['all','Toutes les éditions'],
    ['coming','À venir'],['open','Période de vote annoncée'],
    ['closed','Clôturée'],['finished','Terminée']]);
  const searchLabel=make('label','award-label','Rechercher');
  const search=make('input','award-search');
  search.type='search';search.maxLength=100;
  search.placeholder='Une catégorie, une saison…';
  search.setAttribute('aria-label','Rechercher une catégorie Awards');
  searchLabel.append(search);
  controls.append(team.label,status.label,searchLabel);
  const count=make('p','award-count');
  const cards=make('div','award-grid');
  root.append(controls,count,cards);
  function paint(){
    const filtered=filterAwards(data.awards,{
      team:team.select.value,status:status.select.value,query:search.value
    });
    cards.replaceChildren();
    count.textContent=filtered.length+' catégorie(s) publiée(s)';
    if(!filtered.length){
      cards.append(make('div','award-no-content',data.awards.length
        ?'Aucune catégorie ne correspond à ces filtres.'
        :'Le club n’a pas encore publié de catégorie Awards. Aucune nomination fictive n’est affichée.'));
    }else filtered.forEach(a=>cards.append(awardCard(a,data.nominees,data.results)));
  }
  for(const select of [team.select,status.select])
    select.addEventListener('change',paint);
  search.addEventListener('input',paint);
  paint();
}
let generation=0;
let controller=null;
export function unmountAwards(){
  generation+=1;
  controller?.abort();
  controller=null;
}
export async function mountAwards(){
  unmountAwards();
  const current=generation;
  const root=document.getElementById('awards-public-catalog');
  if(!root)return;
  const ctrl=new AbortController();
  controller=ctrl;
  root.replaceChildren(make('p','awards-loading','Chargement des catégories publiées…'));
  try{
    const data=await fetchPublishedAwards(ctrl.signal);
    if(ctrl.signal.aborted||current!==generation||!root.isConnected)return;
    build(root,data);
  }catch{
    if(ctrl.signal.aborted||current!==generation||!root.isConnected)return;
    root.replaceChildren(make('div','award-no-content',
      'Le catalogue Awards est momentanément indisponible. Aucune nomination ou résultat non vérifié ne sera affiché.'));
  }
}
