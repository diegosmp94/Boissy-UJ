import {supabaseConfig} from './auth-config.mjs';

const ROOT = supabaseConfig.url + '/rest/v1/';
const OPTIONS = Object.freeze([
  ['all','Tout voir'],['match','Matchs'],['event','Événements']
]);
const make = (tag,cls='',text=null) => {
  const e=document.createElement(tag);
  if(cls)e.className=cls;
  if(text!==null)e.textContent=String(text);
  return e;
};
export const normalizeAgendaSearch = value => String(value??'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-FR').trim();
const dateMs = value => value && Number.isFinite(Date.parse(value))?Date.parse(value):null;
export function combinePublishedAgenda(matches=[],events=[],teams=[],{
  now=Date.now(),kind='all',period='future',query=''
}={}){
  const clubTeams=new Map(teams.map(t=>[t.id,t.name]));
  const merged=[];
  for(const m of matches){
    const time=dateMs(m.scheduled_at);
    if(m.published!==true||m.match_status!=='scheduled'||time===null)continue;
    merged.push({kind:'match',id:m.id,time,title:'Boissy-UJ — '+(m.opponent_name||'Adversaire à confirmer'),
      subtitle:clubTeams.get(m.team_id)||'Équipe du club',place:m.venue||'Lieu à confirmer',
      info:m.is_home===true?'À domicile':'À l’extérieur',href:'#/matchs'});
  }
  for(const e of events){
    const time=dateMs(e.starts_at),end=dateMs(e.ends_at);
    if(e.published!==true||e.access_kind!=='public'||time===null)continue;
    merged.push({kind:'event',id:e.id,time,endsAt:end,title:e.title||'Événement',
      subtitle:'Événement du club',place:e.location_label||'Lieu à confirmer',
      info:'Réservations en ligne indisponibles',href:'#/evenements'});
  }
  const normalized=normalizeAgendaSearch(query);
  const weekEnd=now+7*24*60*60*1000;
  return merged.filter(x=>{
    const until=x.kind==='event'&&x.endsAt!==null?x.endsAt:x.time;
    if(period==='week'&&(until<now||x.time>weekEnd))return false;
    if(period==='future'&&until<now)return false;
    return (kind==='all'||x.kind===kind)
      &&(!normalized||[x.title,x.subtitle,x.place].some(v=>normalizeAgendaSearch(v).includes(normalized)));
  }).sort((a,b)=>a.time-b.time||String(a.id).localeCompare(String(b.id)));
}
export async function loadPublicAgenda(signal,fetcher=fetch){
  const entries=[
    ['matches',{select:'id,team_id,opponent_name,scheduled_at,venue,is_home,match_status,published',
      published:'eq.true',match_status:'eq.scheduled',order:'scheduled_at.asc',limit:'100'}],
    ['club_events',{select:'id,title,starts_at,ends_at,location_label,access_kind,published',
      published:'eq.true',access_kind:'eq.public',order:'starts_at.asc',limit:'100'}],
    ['club_teams',{select:'id,name',order:'sort_order.asc',limit:'4'}]
  ];
  const settled=await Promise.allSettled(entries.map(async([table,params])=>{
    const response=await fetcher(ROOT+table+'?'+new URLSearchParams(params),{
      method:'GET',signal,cache:'no-store',
      headers:{apikey:supabaseConfig.publishableKey,Accept:'application/json'}
    });
    if(!response.ok)throw new Error('Catalogue indisponible');
    const rows=await response.json();
    if(!Array.isArray(rows))throw new Error('Format invalide');
    return rows;
  }));
  if(signal?.aborted)throw new Error('Requête annulée');
  return {
    matches:settled[0].status==='fulfilled'?settled[0].value:[],
    events:settled[1].status==='fulfilled'?settled[1].value:[],
    teams:settled[2].status==='fulfilled'?settled[2].value:[],
    unavailable:entries.filter((_,i)=>settled[i].status==='rejected').map(([t])=>t)
  };
}
const formatDate=time=>new Intl.DateTimeFormat('fr-FR',{
  weekday:'long',day:'numeric',month:'long',year:'numeric',
  hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'
}).format(new Date(time));
let active=0;
let pending=null;
export function unmountAgenda(){active++;pending?.abort();pending=null;}
export async function mountAgenda(){
  unmountAgenda();
  const generation=active,root=document.getElementById('agenda-public-root');
  if(!root)return;
  const controller=new AbortController();pending=controller;
  const intro=make('p','agenda-note','Dates et lieux affichés uniquement après publication par le club. Les rencontres annulées ou reportées ne sont pas présentées comme à venir.');
  const form=make('div','agenda-filters');
  const kindLabel=make('label','agenda-field','Catégorie');
  const type=make('select','agenda-select');type.setAttribute('aria-label','Catégorie du calendrier');
  for(const [value,label] of OPTIONS){const o=make('option','',label);o.value=value;type.append(o);}
  kindLabel.append(type);
  const periodLabel=make('label','agenda-field','Période');
  const period=make('select','agenda-select');period.setAttribute('aria-label','Période du calendrier');
  for(const [value,label] of [['future','À venir'],['week','7 prochains jours'],['all','Toutes les dates']]){
    const o=make('option','',label);o.value=value;period.append(o);
  }
  periodLabel.append(period);
  const searchLabel=make('label','agenda-field','Rechercher');
  const search=make('input','agenda-input');search.type='search';search.maxLength=100;
  search.placeholder='Équipe, adversaire, lieu…';search.setAttribute('aria-label','Rechercher dans l’agenda');
  searchLabel.append(search);
  form.append(kindLabel,periodLabel,searchLabel);
  const status=make('p','agenda-status','Consultation des calendriers publiés…');
  status.setAttribute('role','status');
  const list=make('div','agenda-list');list.setAttribute('aria-live','polite');
  const links=make('nav','agenda-links');links.setAttribute('aria-label','Autres rubriques du club');
  for(const [href,label] of [['#/matchs','Match Center'],['#/evenements','Événements'],['#/infos-pratiques','Infos pratiques']]){
    const a=make('a','agenda-link',label+' ↗');a.href=href;links.append(a);
  }
  root.replaceChildren(intro,form,status,list,links);
  try{
    const rows=await loadPublicAgenda(controller.signal);
    if(controller.signal.aborted||generation!==active||!root.isConnected)return;
    const draw=()=>{
      const selected=combinePublishedAgenda(rows.matches,rows.events,rows.teams,{
        kind:type.value,period:period.value,query:search.value
      });
      list.replaceChildren();
      if(selected.length===0){
        list.append(make('p','agenda-empty','Aucune date officielle publiée pour ces critères.'));
      }
      for(const item of selected){
        const article=make('article','agenda-item');
        const date=make('time','agenda-date',formatDate(item.time));
        date.dateTime=new Date(item.time).toISOString();
        const detail=make('div','agenda-detail');
        detail.append(make('span','agenda-type',item.kind==='match'?'MATCH':'ÉVÉNEMENT'),
          make('h2','',item.title),make('p','',item.subtitle),
          make('p','agenda-place',item.place+' · '+item.info));
        const a=make('a','agenda-item-link','Détails ↗');a.href=item.href;
        article.append(date,detail,a);list.append(article);
      }
      if(rows.unavailable.length){
        status.textContent='Données partielles : un ou plusieurs catalogues sont momentanément indisponibles. Les éléments absents ne sont pas confirmés.';
      }else{
        status.textContent=selected.length+' rendez-vous publié(s) pour cette sélection.';
      }
    };
    type.addEventListener('change',draw);
    period.addEventListener('change',draw);
    search.addEventListener('input',draw);
    draw();
  }catch{
    if(controller.signal.aborted||generation!==active||!root.isConnected)return;
    status.textContent='Agenda temporairement indisponible : consulte directement les pages Match Center et Événements.';
    list.replaceChildren();
  }
}
