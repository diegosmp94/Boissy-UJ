import {supabaseConfig} from './auth-config.mjs';
import {buildPublicCalendar} from './calendar-export.mjs';
import {publicExternalFixtures,EXTERNAL_FIXTURE_REVIEWED_AT} from './external-match-previews.mjs';
import {mergeCalendarPublicEntries,parisDateKey} from './calendar-month.mjs';
import {mountMonthCalendar} from './calendar-view.mjs';
import {clubOutcome} from './league-standings.mjs';

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
  const clubTeams=new Map(teams.map(t=>[t.id,{name:t.name,code:t.code,discipline:t.discipline}]));
  const merged=[];
  for(const m of matches){
    const time=dateMs(m.scheduled_at);
    if(m.published!==true||!['scheduled','played'].includes(m.match_status)||time===null)continue;
    merged.push({kind:'match',id:m.id,time,title:'Boissy-UJ — '+(m.opponent_name||'Adversaire à confirmer'),
      subtitle:(clubTeams.get(m.team_id)?.discipline==='futsal'?'Futsal · ':'Football · ')+(clubTeams.get(m.team_id)?.name||'Équipe du club'),place:m.venue||'Lieu à confirmer',
      info:m.match_status==='played'&&Number.isInteger(m.home_score)&&Number.isInteger(m.away_score)
        ?'Résultat : '+m.home_score+' – '+m.away_score
        :m.is_home===true?'À domicile':'À l’extérieur',
      href:'#/matchs',teamId:m.team_id,teamCode:clubTeams.get(m.team_id)?.code,
      opponent:m.opponent_name,status:m.match_status,localDay:parisDateKey(time),
      outcome:clubOutcome(m)});
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
    ['matches',{select:'id,team_id,opponent_name,scheduled_at,venue,is_home,match_status,published,home_score,away_score',
      published:'eq.true',order:'scheduled_at.asc',limit:'300'}],
    ['club_events',{select:'id,title,starts_at,ends_at,location_label,access_kind,published',
      published:'eq.true',access_kind:'eq.public',order:'starts_at.asc',limit:'100'}],
    ['club_teams',{select:'id,code,name,discipline',order:'sort_order.asc',limit:'5'}]
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
  const intro=make('p','agenda-note','Parcourez les mois passés et à venir. Les résultats et rencontres du club sont distingués des données d’un site tiers, qui restent à valider.');
  const form=make('div','agenda-filters');
  const kindLabel=make('label','agenda-field','Catégorie');
  const type=make('select','agenda-select');type.setAttribute('aria-label','Catégorie du calendrier');
  for(const [value,label] of OPTIONS){const o=make('option','',label);o.value=value;type.append(o);}
  kindLabel.append(type);
  const periodLabel=make('label','agenda-field','Période');
  const period=make('select','agenda-select');period.setAttribute('aria-label','Période du calendrier');
  for(const [value,label] of [['future','À venir'],['week','7 prochains jours'],['all','Toutes les dates (archives incluses)']]){
    const o=make('option','',label);o.value=value;period.append(o);
  }
  periodLabel.append(period);
  const searchLabel=make('label','agenda-field','Rechercher');
  const search=make('input','agenda-input');search.type='search';search.maxLength=100;
  search.placeholder='Équipe, adversaire, lieu…';search.setAttribute('aria-label','Rechercher dans l’agenda');
  searchLabel.append(search);
  form.append(kindLabel,periodLabel,searchLabel);
  const exportBtn=make('button','agenda-export','Exporter les dates sélectionnées (.ics)');
  exportBtn.type='button';
  exportBtn.disabled=true;
  exportBtn.setAttribute('aria-label','Exporter le calendrier public filtré au format iCalendar');
  const status=make('p','agenda-status','Consultation des calendriers publiés…');
  status.setAttribute('role','status');
  const list=make('div','agenda-list');list.setAttribute('aria-live','polite');
  const links=make('nav','agenda-links');links.setAttribute('aria-label','Autres rubriques du club');
  for(const [href,label] of [['#/matchs','Match Center'],['#/evenements','Événements'],['#/infos-pratiques','Infos pratiques']]){
    const a=make('a','agenda-link',label+' ↗');a.href=href;links.append(a);
  }
  const external=make('section','agenda-thirdparty');
  const monthRoot=make('div','agenda-month-root');
  root.replaceChildren(intro,form,monthRoot,exportBtn,status,list,external,links);
  const monthly=mountMonthCalendar(monthRoot);
  let exportedEntries=[];
  exportBtn.addEventListener('click',()=>{
    if(!exportedEntries.length||exportBtn.disabled)return;
    try{
      const content=buildPublicCalendar(exportedEntries);
      const blob=new Blob([content],{type:'text/calendar;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const anchor=make('a');anchor.href=url;
      anchor.download='boissy-uj-agenda.ics';
      anchor.hidden=true;root.append(anchor);
      anchor.click();anchor.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      status.textContent=exportedEntries.length+' rendez-vous public(s) exporté(s) au format iCalendar.';
    }catch{
      status.textContent='L’export du calendrier est indisponible. Aucun fichier n’a été créé.';
    }
  });
  try{
    const rows=await loadPublicAgenda(controller.signal);
    if(controller.signal.aborted||generation!==active||!root.isConnected)return;
    const draw=()=>{
      const selected=combinePublishedAgenda(rows.matches,rows.events,rows.teams,{
        kind:type.value,period:period.value,query:search.value
      });
      const allPublished=combinePublishedAgenda(rows.matches,rows.events,rows.teams,{
        kind:type.value,period:'all',query:search.value
      });
      const sourced=type.value==='event'?[]:publicExternalFixtures({
        includePast:true,period:'all',query:search.value
      });
      monthly.update(mergeCalendarPublicEntries(allPublished,sourced,rows.teams));
      exportedEntries=selected.filter(x=>x.kind!=='match'||x.status==='scheduled');
      exportBtn.disabled=exportedEntries.length===0;
      list.replaceChildren();
      external.replaceChildren();
      // Never represent third-party references as club-published matches. A club
      // fixture always takes precedence and is the only kind eligible for .ics.
      // Do not hide all sourced results when another team has one published match.
      // Published Boissy UJ fixtures take precedence only for the same team/day/opponent.
      const normalizeOpponent=name=>normalizeAgendaSearch(name).replace(/[^a-z0-9]/g,'');
      const codeById=new Map(rows.teams.map(team=>[team.id,team.code]));
      const publishedKeys=new Set(rows.matches.filter(m=>m.published===true).map(m=>
        (codeById.get(m.team_id)||'')+'|'+parisDateKey(m.scheduled_at)+'|'+
        normalizeOpponent(m.opponent_name)));
      const suggestions=type.value==='event'?[]:publicExternalFixtures({
        query:search.value,period:period.value
      }).filter(m=>!publishedKeys.has(m.team_code+'|'+m.localDay+'|'+normalizeOpponent(m.opponent)));
      if(suggestions.length){
        external.append(make('h2','','Calendrier externe — à confirmer par le club'));
        external.append(make('p','agenda-external-note',
          'Calendrier 2026–2027 complété jusqu’à mai 2027 avec des relevés sportifs '+
          'SportCorico / TheFootData du '+EXTERNAL_FIXTURE_REVIEWED_AT+
          '. Scores affichés ici, sans homologation du club lorsqu’elle n’est pas encore connue.'));
        const grid=make('div','agenda-external-grid');
        for(const match of suggestions){
          const card=make('article','agenda-external-card');
          const outcome=['played','administrative'].includes(match.status)?clubOutcome({...match,match_status:match.status}):null;
          if(outcome)card.classList.add('sport-result-'+outcome);
          const date=make('time','agenda-date',match.dateOnly
            ?new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeZone:'UTC'})
              .format(new Date(match.localDay+'T12:00:00Z'))
            :formatDate(match.time));
          date.dateTime=new Date(match.time).toISOString();
          const title=make('h3','',match.team_name+' — '+match.opponent);
          const detail=make('p','',match.is_home?'Domicile annoncé':'Extérieur annoncé');
          const attribution=make('small','agenda-source-attribution',
            'Source : '+match.source_label+' · score non homologué par le club');
          const score=make('p','agenda-referenced-score',
            ['played','administrative'].includes(match.status)?'Score relevé : '+match.result:
              match.status==='unknown'?'Résultat non renseigné':'Rencontre programmée');
          card.append(date,title,detail,score,attribution);
          if(match.venue)card.append(make('p','agenda-place',match.venue));
          if(outcome)card.append(make('span','sport-outcome sport-outcome-'+outcome,
            outcome==='V'?'Victoire':outcome==='N'?'Match nul':'Défaite'));
          grid.append(card);
        }
        external.append(grid);
      }
      if(selected.length===0){
        list.append(make('p','agenda-empty',suggestions.length?'Les rencontres référencées sont consultables ci-dessous, directement sur le site du club. Les scores non homologués sont signalés.':'Aucune date publiée par le club pour ces critères.'));
      }
      for(const item of selected){
        const article=make('article','agenda-item');
        if(item.outcome)article.classList.add('sport-result-'+item.outcome);
        const date=make('time','agenda-date',formatDate(item.time));
        date.dateTime=new Date(item.time).toISOString();
        const detail=make('div','agenda-detail');
        detail.append(make('span','agenda-type',item.kind==='match'?'MATCH':'ÉVÉNEMENT'),
          make('h2','',item.title),make('p','',item.subtitle),
          make('p','agenda-place',item.place+' · '+item.info));
        const a=make('a','agenda-item-link','Détails ↗');a.href=item.href;
        if(item.outcome)detail.append(make('span','sport-outcome sport-outcome-'+item.outcome,
          item.outcome==='V'?'Victoire':item.outcome==='N'?'Match nul':'Défaite'));
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
    exportedEntries=[];
    monthly.update(mergeCalendarPublicEntries([],
      publicExternalFixtures({includePast:true,period:'all'}),[]));
    exportBtn.disabled=true;
    list.replaceChildren();
  }
}
