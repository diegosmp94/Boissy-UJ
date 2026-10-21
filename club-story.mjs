import {supabaseConfig} from './auth-config.mjs';

export const STORY_THEMES=Object.freeze([
  {id:'history',label:'Notre histoire',short:'Parcours et moments clés'},
  {id:'values',label:'Nos valeurs',short:'Ce qui nous rassemble'},
  {id:'organization',label:'Organisation',short:'La vie du club'},
  {id:'projects',label:'Nos projets',short:'La suite de l’aventure'}
]);
export const CLUB_GROUPS=Object.freeze([
  {name:'Seniors A',division:'Départemental 3',caption:'Groupe senior A'},
  {name:'Seniors B',division:'Départemental 4',caption:'Groupe senior B'},
  {name:'Seniors C',division:'Matchs amicaux',caption:'Rencontres amicales'},
  {name:'Vétérans',division:'Départemental 3',caption:'Groupe vétérans'}
]);
const el=(tag,cls='',value=null)=>{
  const n=document.createElement(tag);
  if(cls)n.className=cls;
  if(value!==null)n.textContent=String(value);
  return n;
};
const themeSet=new Set(STORY_THEMES.map(t=>t.id));
export function filterPublishedStory(rows,kind){
  return rows.filter(x=>x.published===true&&(kind==='all'||x.kind===kind)
    &&themeSet.has(x.kind))
    .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)
      ||String(a.heading).localeCompare(String(b.heading),'fr'));
}
export function publishedPublicPositions(rows){
  return rows.filter(x=>x.published===true
    &&(!x.display_name||x.consent_reviewed===true))
    .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)
      ||String(a.role_title).localeCompare(String(b.role_title),'fr'));
}
export function publishedMilestones(rows){
  return rows.filter(x=>x.published===true)
    .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)
      ||String(a.period_label).localeCompare(String(b.period_label),'fr'));
}
async function rows(table,columns,signal,fetcher=fetch){
  const query=new URLSearchParams({
    select:columns,published:'eq.true',order:'sort_order.asc',limit:'120'
  });
  const resp=await fetcher(supabaseConfig.url+'/rest/v1/'+table+'?'+query,{
    method:'GET',signal,cache:'no-store',
    headers:{apikey:supabaseConfig.publishableKey,Accept:'application/json'}
  });
  if(!resp.ok)throw new Error('Catalogue du club indisponible');
  const result=await resp.json();
  if(!Array.isArray(result))throw new Error('Format de réponse inattendu');
  return result;
}
export async function loadClubStory(signal,fetcher=fetch){
  const [sections,milestones,positions]=await Promise.all([
    rows('club_story_sections','id,kind,heading,body,published,sort_order',signal,fetcher),
    rows('club_story_milestones','id,period_label,heading,description,published,sort_order',signal,fetcher),
    rows('club_public_positions',
      'id,role_title,role_description,display_name,consent_reviewed,published,sort_order',
      signal,fetcher)
  ]);
  return {sections,milestones,positions};
}
function heading(label,title,subtitle){
  const header=el('div','club-block-heading');
  header.append(el('span','club-eyebrow',label),el('h2','',title));
  if(subtitle)header.append(el('p','',subtitle));
  return header;
}
function teamCards(){
  const section=el('section','club-teams-section');
  section.append(heading('04 ÉQUIPES · 01 IDENTITÉ','Le football au cœur du club',
    'Quatre collectifs présentés sur le site. Les effectifs, classements et résultats sont publiés séparément dans le Match Center.'));
  const cards=el('div','club-teams-grid');
  CLUB_GROUPS.forEach((team,index)=>{
    const card=el('article','club-mini-team');
    card.append(el('span','club-team-index',String(index+1).padStart(2,'0')+' / 04'),
      el('h3','',team.name),el('p','',team.division),
      el('small','',team.caption));
    cards.append(card);
  });
  section.append(cards);
  const link=el('a','club-story-link','Découvrir les équipes ↗');
  link.href='#/equipes';section.append(link);
  return section;
}
function visionSection(){
  const section=el('section','club-vision');
  section.append(heading('NOTRE DÉMARCHE','Une histoire à raconter ensemble',
    'Cette page rassemblera les informations vérifiées sur le parcours, les responsables et les projets du club.'));
  const grid=el('div','club-vision-grid');
  for(const [num,title,caption] of [
    ['01','Faire équipe','Le collectif est au centre de la présentation sportive de Boissy-UJ.'],
    ['02','Partager le football','La rubrique relie les équipes, les rencontres et la vie associative.'],
    ['03','Faire vivre le club','Les projets et événements seront décrits lorsqu’ils seront annoncés officiellement.']
  ]){
    const item=el('article','club-vision-card');
    item.append(el('span','club-vision-index',num),el('h3','',title),el('p','',caption));
    grid.append(item);
  }
  section.append(grid);
  return section;
}
function renderThemes(parent,data){
  const section=el('section','club-story-archive');
  section.append(heading('ARCHIVES & PROJETS','Découvrez le club',
    'Les récits, décisions et projets ci-dessous sont publiés uniquement après vérification par Boissy-UJ.'));
  const controls=el('div','club-theme-selectors');
  controls.setAttribute('role','group');
  controls.setAttribute('aria-label','Choisir une rubrique du club');
  const output=el('div','club-story-results');
  output.setAttribute('aria-live','polite');
  let selected='history';
  function paint(){
    controls.querySelectorAll('button').forEach(btn=>{
      const active=btn.dataset.kind===selected;
      btn.setAttribute('aria-pressed',String(active));
    });
    output.replaceChildren();
    const visible=filterPublishedStory(data.sections,selected);
    if(!visible.length){
      output.append(el('p','club-story-empty',
        'Le club n’a pas encore publié de contenu vérifié pour cette rubrique.'));
      return;
    }
    for(const item of visible){
      const card=el('article','club-story-card');
      card.append(el('h3','',item.heading),el('p','',item.body));
      output.append(card);
    }
  }
  STORY_THEMES.forEach(t=>{
    const b=el('button','club-theme-button',t.label);
    b.type='button';b.dataset.kind=t.id;
    b.title=t.short;
    b.addEventListener('click',()=>{selected=t.id;paint();});
    controls.append(b);
  });
  section.append(controls,output);paint();
  parent.append(section);
}
function renderChronology(parent,data){
  const section=el('section','club-chronology');
  section.append(heading('CHRONOLOGIE','Les étapes du club',
    'Les dates et les faits n’apparaissent qu’après publication de documents vérifiés.'));
  const milestones=publishedMilestones(data.milestones);
  if(!milestones.length){
    section.append(el('p','club-story-empty',
      'Chronologie en cours de constitution : aucune date historique n’est supposée.'));
  }else{
    const timeline=el('ol','club-timeline');
    milestones.forEach(item=>{
      const li=el('li','club-timeline-entry');
      li.append(el('span','club-timeline-period',item.period_label),
        el('h3','',item.heading),el('p','',item.description));
      timeline.append(li);
    });
    section.append(timeline);
  }
  parent.append(section);
}
function renderGovernance(parent,data){
  const section=el('section','club-governance');
  section.append(heading('ORGANISATION','Les personnes derrière le projet',
    'Les fonctions et éventuels noms des responsables ne sont présentés qu’après autorisation de publication.'));
  const positions=publishedPublicPositions(data.positions);
  if(!positions.length){
    section.append(el('p','club-story-empty',
      'La présentation officielle des fonctions et responsables n’a pas encore été publiée.'));
  }else{
    const grid=el('div','club-position-grid');
    for(const role of positions){
      const card=el('article','club-position-card');
      card.append(el('span','club-position-label','FONCTION AU CLUB'),el('h3','',role.role_title));
      if(role.display_name)card.append(el('strong','',role.display_name));
      if(role.role_description)card.append(el('p','',role.role_description));
      grid.append(card);
    }
    section.append(grid);
  }
  parent.append(section);
}
function renderCallToAction(){
  const section=el('section','club-story-footer');
  section.append(el('span','club-eyebrow','L’AVENTURE CONTINUE'),
    el('h2','','Découvrir, suivre, participer'),
    el('p','',
      'Explore les équipes, le programme public et les opportunités publiées par le club.'));
  const links=el('div','club-story-actions');
  for(const [label,path] of [
    ['Nos équipes ↗','#/equipes'],['Nous rejoindre ↗','#/rejoindre'],
    ['Infos pratiques ↗','#/infos-pratiques']
  ]){
    const a=el('a','club-story-link',label);
    a.href=path;links.append(a);
  }
  section.append(links);
  return section;
}
function skeleton(root){
  root.replaceChildren(teamCards(),visionSection());
  const loading=el('p','club-story-loading','Chargement des informations officielles…');
  loading.id='club-story-data';
  root.append(loading,renderCallToAction());
  return loading;
}
let generation=0;
let currentController=null;
export function unmountClubStory(){
  generation++;
  currentController?.abort();
  currentController=null;
}
export async function mountClubStory(){
  unmountClubStory();
  const root=document.getElementById('club-story-hub');
  if(!root)return;
  const current=generation,ctrl=new AbortController();
  currentController=ctrl;
  const placeholder=skeleton(root);
  try{
    const data=await loadClubStory(ctrl.signal);
    if(ctrl.signal.aborted||generation!==current||!root.isConnected)return;
    const content=el('div','club-data-sections');
    renderThemes(content,data);
    renderChronology(content,data);
    renderGovernance(content,data);
    placeholder.replaceWith(content);
  }catch{
    if(ctrl.signal.aborted||generation!==current||!root.isConnected)return;
    placeholder.replaceWith(el('p','club-story-empty',
      'Les archives officielles ne sont pas disponibles actuellement. Aucune histoire, personne ou date non vérifiée n’est affichée.'));
  }
}
