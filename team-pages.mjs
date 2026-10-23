import {supabaseConfig} from './auth-config.mjs';
import {CLUB_TEAMS} from './club-teams.mjs';
import {publicExternalFixtures,EXTERNAL_FIXTURE_REVIEWED_AT} from './external-match-previews.mjs';
import {clubOutcome} from './league-standings.mjs';
import {victoryCongratulations} from './victory-congratulations.mjs';
import {createVictoryNotice} from './victory-notice.mjs';
import {buildCompetitionTabs,competitionKind,cupInformation} from './competition-tabs.mjs';

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
    select:'id,team_id,opponent_name,scheduled_at,venue,is_home,match_status,home_score,away_score,published,competition_kind,competition_label',
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
    const legend=node('div','sport-result-legend');
    legend.setAttribute('aria-label','Légende des résultats');
    for(const [result,label] of [['V','Victoire'],['N','Match nul'],['D','Défaite']]){
      legend.append(node('span','sport-outcome sport-outcome-'+result,label));
    }
    root.append(legend);
    const notices=[],cards=[],sections=[];
    let activeCompetition='league',activeSeason='2026-2027';
    const renderCategory=()=>{
      for(const item of cards){
        const category=item.kind;
        const allowFriendly=code==='c'&&activeCompetition==='league'&&category==='friendly';
        item.node.hidden=(!allowFriendly&&category!==activeCompetition)||
          (item.season!=='all'&&activeSeason!=='all'&&activeSeason!==item.season);
      }
      for(const sec of sections){
        sec.hidden=!cards.some(item=>item.section===sec&&!item.node.hidden);
      }
      for(const notice of notices)notice.hidden=activeCompetition!=='cup';
    };
    buildCompetitionTabs(root,{onChange:value=>{
      activeCompetition=value;renderCategory();
    }});
    const competitionNote=node('p','team-competition-help',
      code==='c'
        ?'Seniors C : rencontres amicales, sans championnat officiel. Aucun match de coupe annoncé en 2026–2027.'
        :'Championnat et coupe sont séparés par équipe. Les résultats externes ne sont pas homologués ; les nouvelles dates ajoutées jusqu’à mai 2027 restent à revalider par le club.');
    root.append(competitionNote);
    const cupDetails=cupInformation(code,'2026-2027');
    const cupNotice=node('aside','team-cup-participation');
    cupNotice.append(node('strong','',cupDetails.headline),node('p','',cupDetails.detail));
    cupNotice.hidden=true;notices.push(cupNotice);root.append(cupNotice);
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
          node('small','',(match.competition_label||'Compétition non précisée')+' · '+(match.venue||'Lieu non communiqué'))
        );
        const outcome=clubOutcome(match);
        if(outcome){
          card.classList.add('sport-result-'+outcome);
          card.append(node('span','sport-outcome sport-outcome-'+outcome,
            outcome==='V'?'Victoire':outcome==='D'?'Défaite':'Match nul'));
        }
        const celebration=victoryCongratulations(match,code);
        if(celebration)card.append(createVictoryNotice(celebration));
        card.hidden=competitionKind(match)!=='league'&&competitionKind(match)!=='unspecified';
        cards.push({node:card,kind:competitionKind(match),season:'all',section});
        list.append(card);
      }
      section.append(list);root.append(section);sections.push(section);
    }
    {
      // Retain attributed historical seasons even when the club has published a few current fixtures.
      const sourced=publicExternalFixtures({team:code,includePast:true,period:'all'});
      if(sourced.length){
        const section=node('section','team-profile-group team-profile-external');
        section.append(node('h2','','Résultats précédents et archives sourcées'),
          node('p','team-profile-disclaimer',
            'Sources SportCorico et TheFootData · saisons 2025–2026 et 2026–2027 · dernier contrôle du calendrier '+
            EXTERNAL_FIXTURE_REVIEWED_AT+'. Non homologuées par le club ; les scores peuvent être corrigés.'));
        const filter=node('label','team-archive-season-label','Afficher les résultats de : ');
        const select=node('select','sport-team-select');
        select.setAttribute('aria-label','Saison des rencontres archivées de cette équipe');
        for(const [value,label] of [['all','Toutes les saisons'],['2026-2027','2026–2027'],['2025-2026','2025–2026']]){
          const option=node('option','',label);option.value=value;select.append(option);
        }
        select.value=activeSeason;
        filter.append(select);section.append(filter);
        const list=node('div','team-profile-matches');
        select.addEventListener('change',()=>{
          activeSeason=select.value;renderCategory();
        });
        for(const m of sourced.slice().sort((a,b)=>b.time-a.time)){
          const item=node('article','team-profile-match');
          item.append(node('span','team-profile-match-kind',
            m.season+' · '+(m.status==='played'?'Résultat sourcé':
              m.status==='unknown'?'Score non communiqué':'Rencontre annoncée')),
            node('p','team-profile-match-date',m.dateOnly
              ?new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeZone:'UTC'})
                .format(new Date(m.localDay+'T12:00:00Z'))
              :dateText(m.time)),
            node('strong','',m.is_home?'Boissy-UJ — '+m.opponent:m.opponent+' — Boissy-UJ'),
            node('p','team-profile-score',m.result||'Score non confirmé'),
            node('small','',m.competition||'Compétition non précisée'));
          if(m.status==='played'){
            const outcome=clubOutcome({...m,match_status:'played'});
            if(outcome){
              item.classList.add('sport-result-'+outcome);
              item.append(node('span','sport-outcome sport-outcome-'+outcome,
                outcome==='V'?'Victoire':outcome==='D'?'Défaite':'Match nul'));
            }
          }
          item.append(node('small','team-source-attribution',
            'Source du relevé : '+m.source_label+' · '+(m.validated_by_club?'Confirmé par le club':'Score non homologué par le club')));
          cards.push({node:item,season:m.season,kind:competitionKind(m),section});
          list.append(item);
        }
        section.append(list);root.append(section);sections.push(section);
      }
    }
    renderCategory();
    const unclassifiedCount=cards.filter(x=>x.kind==='unspecified').length;
    if(unclassifiedCount)root.append(node('p','team-competition-unclassified',
      unclassifiedCount+' rencontre(s) publiées ne sont pas encore classées. Un administrateur doit indiquer Championnat ou Coupe pour les afficher dans le bon onglet.'));
    root.append(node('p','team-profile-disclaimer',
      'Les résultats publiés par le club et les références de sources externes ne sont pas équivalents. Aucun classement officiel FFF ne peut être déduit du seul bilan de notre équipe.'));
  }catch{
    if(controller.signal.aborted||current!==generation||!root.isConnected)return;
    root.replaceChildren(node('p','team-profile-state','Données sportives temporairement indisponibles. Aucun résultat non vérifié ne sera présenté.'));
  }
}
