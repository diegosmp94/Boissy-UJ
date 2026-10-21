import {supabaseConfig} from './auth-config.mjs';

/** Information already confirmed in the project's functional brief. */
export const CONFIRMED_TEAMS=Object.freeze([
  {name:'Seniors A',division:'Départemental 3',source:'Compétition FFF'},
  {name:'Seniors B',division:'Départemental 4',source:'Compétition FFF'},
  {name:'Seniors C',division:'Matchs amicaux',source:'Calendrier géré par le club'},
  {name:'Vétérans',division:'Départemental 3',source:'Compétition FFF'}
]);
export const STORY_CATEGORIES=Object.freeze([
  {key:'history',title:'Notre histoire',intro:'Les origines et les étapes du club, une fois vérifiées et publiées.'},
  {key:'identity',title:'Notre identité',intro:'Les éléments officiels qui définissent Boissy-UJ.'},
  {key:'values',title:'Nos engagements',intro:'La charte et les valeurs du club lorsqu’elles auront été validées.'},
  {key:'governance',title:'Notre organisation',intro:'L’organisation associative et sportive telle que publiée par le club.'},
  {key:'projects',title:'Nos projets',intro:'Les prochains objectifs après validation par les responsables.'}
]);
export const normalizedStorySearch=value=>String(value||'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLocaleLowerCase('fr-FR').trim();

export function filterPublicStory(sections,{category='all',query=''}={}){
  const q=normalizedStorySearch(query);
  return sections.filter(x=>x.published===true&&Boolean(x.reviewed_at)
    &&(category==='all'||x.category===category)
    &&(!q||[x.heading,x.body].some(y=>normalizedStorySearch(y).includes(q))))
    .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)
      ||String(a.heading).localeCompare(String(b.heading),'fr'));
}
export function filterVerifiedMilestones(items){
  return items.filter(x=>x.published===true&&Boolean(x.reviewed_at)
    &&['day','month','year'].includes(x.date_precision)
    &&/^\d{4}-\d{2}-\d{2}$/.test(String(x.occurred_on||''))
    &&!Number.isNaN(Date.parse(x.occurred_on)))
    .sort((a,b)=>Date.parse(a.occurred_on)-Date.parse(b.occurred_on)
      ||(a.sort_order||0)-(b.sort_order||0));
}
export function milestoneDate(item){
  if(!item?.occurred_on)return 'Date non publiée';
  const [year,month]=item.occurred_on.split('-');
  if(item.date_precision==='year')return year;
  if(item.date_precision==='month')
    return new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'})
      .format(new Date(item.occurred_on+'T12:00:00Z'));
  return new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeZone:'UTC'})
    .format(new Date(item.occurred_on+'T12:00:00Z'));
}
const create=(tag,className='',value=null)=>{
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(value!==null)el.textContent=String(value);
  return el;
};
async function getRows(table,columns,signal,fetcher){
  const query=new URLSearchParams({
    select:columns,published:'eq.true',order:'sort_order.asc',limit:'100'
  });
  const response=await fetcher(
    supabaseConfig.url+'/rest/v1/'+table+'?'+query,
    {method:'GET',signal,cache:'no-store',
     headers:{apikey:supabaseConfig.publishableKey,Accept:'application/json'}}
  );
  if(!response.ok)throw new Error('Portrait officiel indisponible');
  const body=await response.json();
  if(!Array.isArray(body))throw new Error('Catalogue invalide');
  return body;
}
export async function loadClubPortrait(signal,fetcher=fetch){
  const [sections,milestones]=await Promise.all([
    getRows('club_story_sections',
      'id,category,heading,body,published,reviewed_at,sort_order',signal,fetcher),
    getRows('club_story_milestones',
      'id,title,description,occurred_on,date_precision,published,reviewed_at,sort_order',
      signal,fetcher)
  ]);
  return {sections,milestones};
}
function routeLink(label,to){
  const a=create('a','club-portrait-link',label);
  a.href=to;
  return a;
}
function confirmedIdentity(){
  const hero=create('section','club-portrait-identity');
  const emblem=create('div','club-portrait-emblem');
  const img=create('img');
  img.src='./assets/ecusson-boissy-uj.webp';
  img.alt='Écusson Boissy-UJ';
  img.loading='lazy';img.width=110;img.height=110;
  emblem.append(img);
  const body=create('div','club-portrait-identity-copy');
  body.append(create('span','club-portrait-kicker','L’IDENTITÉ BOISSY-UJ'),
    create('h2','','Quatre équipes. Un même club.'),
    create('p','',
      'Boissy-UJ réunit quatre collectifs seniors. Le site donne accès à leurs présentations, leurs rencontres publiées et aux actualités validées par le club.'));
  const links=create('div','club-portrait-links');
  links.append(routeLink('Nos équipes ↗','#/equipes'),
    routeLink('Match Center ↗','#/matchs'));
  body.append(links);
  hero.append(emblem,body);
  const teams=create('div','club-portrait-team-grid');
  for(const team of CONFIRMED_TEAMS){
    const card=create('article','club-portrait-team');
    card.append(create('span','club-portrait-team-category',team.source),
      create('h3','',team.name),create('strong','',team.division));
    teams.append(card);
  }
  const section=create('section','club-portrait-confirmed');
  section.append(hero,teams);
  return section;
}
function storyList(sections){
  const wrapper=create('section','club-portrait-stories');
  wrapper.append(create('span','club-portrait-kicker','LE CLUB EN DÉTAIL'),
    create('h2','','Son histoire, ses engagements, son avenir'),
    create('p','club-portrait-lead',
      'Les textes institutionnels apparaissent uniquement après vérification et publication par Boissy-UJ.'));
  const filter=create('div','club-portrait-filter');
  const selectLabel=create('label','club-portrait-label','Thématique');
  const select=create('select','club-portrait-select');
  select.setAttribute('aria-label','Filtrer les thèmes de présentation');
  for(const [value,label] of [['all','Toutes les thématiques'],
    ...STORY_CATEGORIES.map(c=>[c.key,c.title])]){
    const option=create('option','',label);option.value=value;select.append(option);
  }
  selectLabel.append(select);
  const search=create('input','club-portrait-search');
  search.type='search';search.maxLength=100;
  search.placeholder='Rechercher dans la présentation…';
  search.setAttribute('aria-label','Rechercher dans la présentation du club');
  filter.append(selectLabel,search);
  const cards=create('div','club-portrait-story-grid');
  cards.setAttribute('aria-live','polite');
  const redraw=()=>{
    cards.replaceChildren();
    const rows=filterPublicStory(sections,{category:select.value,query:search.value});
    if(!rows.length){
      cards.append(create('p','club-portrait-empty',
        'Aucun texte institutionnel vérifié n’est encore publié pour cette sélection.'));
      return;
    }
    for(const x of rows){
      const card=create('article','club-portrait-story-card');
      const group=STORY_CATEGORIES.find(c=>c.key===x.category);
      card.append(create('span','club-portrait-kicker',group?.title||'Le club'),
        create('h3','',x.heading),create('p','',x.body));
      cards.append(card);
    }
  };
  select.addEventListener('change',redraw);
  search.addEventListener('input',redraw);
  wrapper.append(filter,cards);
  redraw();
  return wrapper;
}
function chronologicalMilestones(milestones){
  const section=create('section','club-portrait-history');
  section.append(create('span','club-portrait-kicker','REPÈRES VÉRIFIÉS'),
    create('h2','','La chronologie du club'),
    create('p','club-portrait-lead',
      'Aucune date de fondation ou étape historique n’est affichée sans validation du club.'));
  const items=filterVerifiedMilestones(milestones);
  if(!items.length){
    section.append(create('p','club-portrait-empty',
      'La chronologie officielle est en cours de constitution. Aucun événement historique n’est supposé.'));
  }else{
    const list=create('ol','club-portrait-timeline');
    for(const item of items){
      const li=create('li','club-portrait-milestone');
      li.append(create('time','club-portrait-milestone-date',milestoneDate(item)),
        create('h3','',item.title),create('p','',item.description));
      li.querySelector('time').dateTime=item.occurred_on;
      list.append(li);
    }
    section.append(list);
  }
  return section;
}
function appendResources(root){
  const links=create('section','club-portrait-more');
  links.append(create('span','club-portrait-kicker','PARTICIPER À LA VIE DU CLUB'),
    create('h2','','Découvrir la suite'));
  const grid=create('div','club-portrait-more-grid');
  for(const [title,copy,href] of [
    ['Nous rejoindre','Joueurs, entraîneurs, bénévoles ou partenaires.','#/rejoindre'],
    ['Infos pratiques','Les annonces, horaires et accès vérifiés.','#/infos-pratiques'],
    ['Actualités','Les publications et temps forts du club.','#/actualites'],
    ['Soutenir','Découvrez les projets et les moyens de soutenir le club.','#/soutenir']
  ]){
    const card=create('article','club-portrait-more-card');
    card.append(create('h3','',title),create('p','',copy),
      routeLink('En savoir plus ↗',href));
    grid.append(card);
  }
  links.append(grid);
  root.append(links);
}
let activeRequest=null;
let version=0;
export function unmountClubPortrait(){
  version++;
  activeRequest?.abort();
  activeRequest=null;
}
export async function mountClubPortrait(){
  unmountClubPortrait();
  const myVersion=version;
  const root=document.getElementById('club-portrait-public');
  if(!root)return;
  root.replaceChildren(confirmedIdentity());
  const loading=create('p','club-portrait-loading','Chargement des contenus institutionnels publiés…');
  root.append(loading);
  const abort=new AbortController();activeRequest=abort;
  try{
    const data=await loadClubPortrait(abort.signal);
    if(abort.signal.aborted||myVersion!==version||!root.isConnected)return;
    loading.remove();
    root.append(storyList(data.sections),chronologicalMilestones(data.milestones));
    appendResources(root);
  }catch{
    if(abort.signal.aborted||myVersion!==version||!root.isConnected)return;
    loading.replaceWith(create('p','club-portrait-empty',
      'La présentation détaillée est temporairement indisponible. Les quatre équipes confirmées restent consultables.'));
    appendResources(root);
  }
}
