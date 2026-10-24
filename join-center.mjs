import {supabaseConfig} from './auth-config.mjs';
import {boundedPublicRequest} from './public-catalog-timeout.mjs';

export const JOIN_AUDIENCES=Object.freeze([
  {id:'player',label:'Joueur',heading:'Rejoindre un collectif',
    copy:'Découvre les équipes du club et consulte les besoins de recrutement officiellement annoncés.',
    steps:['Choisir l’équipe qui correspond à ta catégorie.',
      'Vérifier si une opportunité de recrutement est publiée.',
      'Utiliser uniquement un canal de contact confirmé par le club.']},
  {id:'coach',label:'Éducateur',heading:'Transmettre son envie d’encadrer',
    copy:'Les rôles d’éducateur et leurs affectations d’équipe sont soumis à validation administrative.',
    steps:['Découvrir les équipes et le projet sportif.',
      'Consulter les besoins d’encadrement publiés.',
      'Attendre la procédure sécurisée et l’approbation administrative.']},
  {id:'volunteer',label:'Bénévole',heading:'Contribuer à la vie associative',
    copy:'Les possibilités d’engagement seront annoncées par les responsables du club.',
    steps:['Identifier la mission qui t’intéresse.',
      'Lire les annonces de bénévolat disponibles.',
      'Contacter le club par un moyen officiel publié.']},
  {id:'partner',label:'Partenaire',heading:'Construire un partenariat',
    copy:'Les entreprises et structures intéressées pourront découvrir les projets du club.',
    steps:['Découvrir la vie du club et ses projets.',
      'Consulter les annonces de partenariat si disponibles.',
      'Prendre contact uniquement via les coordonnées confirmées.']}
]);
export const OPPORTUNITY_STAGES=Object.freeze({
  planned:'En préparation',open:'Annonce ouverte',closed:'Clôturée'
});
export const NOTICE_TOPICS=Object.freeze({
  faq:'Questions fréquentes',training:'Entraînements',matchday:'Jour de match',
  venue:'Accès et terrains',membership:'Adhésion',general:'Vie du club'
});
const el=(tag,cls='',value=null)=>{
  const n=document.createElement(tag);
  if(cls)n.className=cls;
  if(value!==null)n.textContent=String(value);
  return n;
};
const norm=value=>String(value||'').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-FR').trim();
export function filterJoinListings(listings,{audience='player',team='all',query=''}={}){
  const search=norm(query);
  return listings.filter(x=>x.published===true&&x.audience===audience
    &&(team==='all'||x.team_code===team||x.team_code===null)
    &&(!search||[x.title,x.description].some(value=>norm(value).includes(search))))
    .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||String(a.title).localeCompare(String(b.title),'fr'));
}
export function filterPublicNotices(notices,{topic='all',query=''}={}){
  const search=norm(query);
  return notices.filter(x=>x.published===true&&(topic==='all'||topic===x.topic)
    &&(!search||[x.heading,x.body].some(value=>norm(value).includes(search))))
    .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||String(a.heading).localeCompare(String(b.heading),'fr'));
}
export function verifiedContactHref(contact){
  if(!contact||contact.published!==true)return null;
  const value=String(contact.channel_value||'').trim();
  if(contact.channel_type==='email'&&/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(value))
    return 'mailto:'+value;
  if(contact.channel_type==='phone'&&/^\+[0-9]{8,15}$/.test(value))
    return 'tel:'+value;
  if(contact.channel_type==='website'){
    try{
      const url=new URL(value);
      if(url.protocol==='https:'&&url.hostname.includes('.')&& !url.username&&!url.password)
        return url.href;
    }catch{}
  }
  return null;
}
export function filterPublicContacts(contacts,audience='general'){
  return contacts.filter(c=>c.published===true&&verifiedContactHref(c)
    &&(c.audience==='general'||c.audience===audience))
    .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
}
async function publicRows(table,columns,signal,fetcher){
  const params=new URLSearchParams({
    select:columns,published:'eq.true',order:'sort_order.asc',limit:'150'
  });
  const result=await fetcher(supabaseConfig.url+'/rest/v1/'+table+'?'+params,{
    method:'GET',signal,cache:'no-store',
    headers:{apikey:supabaseConfig.publishableKey,Accept:'application/json'}
  });
  if(!result.ok)throw new Error('Informations du club indisponibles');
  const rows=await result.json();
  if(!Array.isArray(rows))throw new Error('Format incorrect');
  return rows;
}
export async function loadPublicClubInfo(signal,fetcher=fetch){
  // Three independent PUBLIC catalogues. Failure in one must not hide already
  // published information in the other two. Aborting navigation is different
  // from a partial provider outage and must still cancel rendering.
  const names=['listings','notices','contacts'];
  const results=await Promise.allSettled([
    publicRows('club_join_opportunities',
      'id,title,description,audience,team_code,stage,published,sort_order',signal,fetcher),
    publicRows('club_public_notices',
      'id,heading,body,topic,published,sort_order',signal,fetcher),
    publicRows('club_contact_channels',
      'id,label,channel_type,channel_value,audience,published,sort_order',signal,fetcher)
  ]);
  if(signal?.aborted)throw new Error('Requête annulée');
  const output={listings:[],notices:[],contacts:[],unavailable:[]};
  for(let i=0;i<results.length;i++){
    if(results[i].status==='fulfilled')output[names[i]]=results[i].value;
    else output.unavailable.push(names[i]);
  }
  return output;
}

const TEAM_NAMES={a:'Seniors A',b:'Seniors B',c:'Seniors C',veterans:'Vétérans'};
function noticeCard(notice){
  const item=el('details','join-faq-item');
  const title=el('summary','',notice.heading);
  item.append(title,el('p','',notice.body));
  return item;
}
function contactArea(contacts,audience,unavailable=false){
  const area=el('section','join-contacts');
  area.append(el('h3','','Contacter le club'),
    el('p','join-intro','Seuls les moyens de contact explicitement publiés par Boissy-UJ sont proposés.'));
  const found=filterPublicContacts(contacts,audience);
  const links=el('div','join-contact-links');
  if(unavailable){
    const warning=el('p','join-neutral',
      'Les contacts officiels sont momentanément indisponibles. Aucun contact non vérifié n’est affiché.');
    warning.setAttribute('role','status');
    area.append(warning);
  }else if(!found.length){
    area.append(el('p','join-neutral','Aucun moyen de contact officiel n’est encore publié pour cette rubrique.'));
  }else {
    for(const c of found){
      const a=el('a','join-contact-link',c.label);
      a.href=verifiedContactHref(c);
      if(c.channel_type==='website'){a.target='_blank';a.rel='noopener noreferrer';}
      a.append(el('span','', ' ↗'));
      links.append(a);
    }
    area.append(links);
  }
  area.append(el('p','join-privacy-note',
    'Ne communique pas de dossier de santé, de document d’identité ni de coordonnées d’un mineur via un formulaire non vérifié.'));
  return area;
}
function introSteps(audience){
  const info=JOIN_AUDIENCES.find(x=>x.id===audience)||JOIN_AUDIENCES[0];
  const section=el('section','join-journey');
  section.append(el('p','join-eyebrow','TON PARCOURS'),
    el('h2','',info.heading),
    el('p','join-intro',info.copy));
  const list=el('ol','join-step-grid');
  for(let i=0;i<info.steps.length;i++){
    const item=el('li','join-step');
    item.append(el('span','join-step-number',String(i+1).padStart(2,'0')),
      el('p','',info.steps[i]));
    list.append(item);
  }
  section.append(list);
  return section;
}
function listingSection(listings,role,unavailable=false){
  const section=el('section','join-listing-section');
  section.append(el('h2','','Annonces du club'));
  const helper=el('p','join-intro',
    'Ces annonces sont publiées par Boissy-UJ. Une annonce ouverte ne constitue pas une inscription en ligne.');
  section.append(helper);
  const tools=el('div','join-listing-tools');
  const search=el('input','join-search');
  search.type='search';search.maxLength=100;
  search.placeholder='Rechercher une annonce…';
  search.setAttribute('aria-label','Rechercher parmi les annonces publiées');
  tools.append(search);
  const teamLabel=el('label','join-select-label','Équipe');
  const team=el('select','join-select');
  team.setAttribute('aria-label','Filtrer les annonces par équipe');
  for(const [value,label] of [['all','Toutes les équipes'],...Object.entries(TEAM_NAMES)]){
    const option=el('option','',label);option.value=value;team.append(option);
  }
  teamLabel.append(team);
  if(role==='player'||role==='coach')tools.append(teamLabel);
  section.append(tools);
  const list=el('div','join-listings');
  list.setAttribute('aria-live','polite');
  section.append(list);
  function draw(){
    const rows=filterJoinListings(listings,{
      audience:role,team:team.value,query:search.value
    });
    list.replaceChildren();
    if(unavailable){
      const notice=el('p','join-neutral',
        'Les annonces officielles sont momentanément indisponibles. Aucune annonce non vérifiée n’est affichée.');
      notice.setAttribute('role','status');
      list.append(notice);
      return;
    }
    if(!rows.length){
      list.append(el('p','join-neutral',
        'Aucune annonce officielle publiée pour cette sélection actuellement. Cela ne signifie pas que le club recrute ou ne recrute pas.'));
      return;
    }
    for(const row of rows){
      const card=el('article','join-listing-card');
      const head=el('div','join-listing-meta');
      head.append(el('span','join-listing-stage',OPPORTUNITY_STAGES[row.stage]||'À vérifier'));
      if(row.team_code&&TEAM_NAMES[row.team_code])
        head.append(el('span','join-listing-team',TEAM_NAMES[row.team_code]));
      card.append(head,el('h3','',row.title),el('p','',row.description));
      list.append(card);
    }
  }
  search.addEventListener('input',draw);
  team.addEventListener('change',draw);
  draw();
  return section;
}
function topicIntro(){
  const wrapper=el('section','join-static-help');
  wrapper.append(el('h2','','Questions utiles avant de commencer'));
  const questions=[
    ['Quelles sont les équipes présentées ?', 'Le site présente Seniors A (D3), Seniors B (D4), Seniors C (matchs amicaux) et Vétérans (D3). Les effectifs et disponibilités ne sont pas encore publiés.'],
    ['Comment demander à devenir entraîneur ?', 'Un rôle entraîneur et chaque affectation à une équipe nécessitent une validation administrative. Le circuit de connexion et de demande sera ouvert après la recette de sécurité.'],
    ['Où voir les rencontres et les horaires ?', 'Le Match Center présente uniquement les rencontres effectivement publiées par le club. Les lieux et horaires absents restent à confirmer.'],
    ['Puis-je déjà m’inscrire ou envoyer des documents ?', 'Non, aucun formulaire nominatif de candidature n’est actif sur cette préversion. Attends une annonce et un moyen de contact officiellement confirmé.']
  ];
  for(const [q,a] of questions){
    wrapper.append(noticeCard({heading:q,body:a}));
  }
  return wrapper;
}
function buildJoin(root,data){
  root.replaceChildren();
  const choice=el('section','join-choose');
  choice.append(el('span','join-eyebrow','UN CLUB · PLUSIEURS FAÇONS DE S’ENGAGER'),
    el('h2','','Comment souhaites-tu participer ?'));
  const buttons=el('div','join-audience-tabs');
  buttons.setAttribute('role','group');
  buttons.setAttribute('aria-label','Choisir une façon de rejoindre le club');
  const dynamic=el('div','join-dynamic');
  let selected='player';
  const refresh=()=>{
    for(const b of buttons.children){
      const active=b.dataset.audience===selected;
      b.setAttribute('aria-pressed',String(active));
      b.classList.toggle('active',active);
    }
    dynamic.replaceChildren(
      introSteps(selected),
      listingSection(data.listings,selected,data.unavailable.includes('listings')),
      contactArea(data.contacts,selected,data.unavailable.includes('contacts'))
    );
  };
  for(const audience of JOIN_AUDIENCES){
    const b=el('button','join-audience-btn',audience.label);
    b.type='button';b.dataset.audience=audience.id;
    b.addEventListener('click',()=>{selected=audience.id;refresh();});
    buttons.append(b);
  }
  choice.append(buttons);
  root.append(choice,dynamic,topicIntro());
  if(data.unavailable.includes('notices')){
    const warning=el('p','join-neutral',
      'Les questions et informations officielles du club ne peuvent pas être chargées pour le moment.');
    warning.setAttribute('role','status');
    root.append(warning);
  }
  if(data.notices.some(n=>n.published&&n.topic==='faq')){
    const group=el('section','join-static-help');
    group.append(el('h2','','Informations publiées par le club'));
    for(const row of filterPublicNotices(data.notices,{topic:'faq'}))
      group.append(noticeCard(row));
    root.append(group);
  }
  const link=el('a','join-back-link','Découvrir les équipes ↗');
  link.href='#/equipes';root.append(link);
}
function buildPractical(root,data){
  root.replaceChildren();
  const intro=el('p','join-intro',
    'Retrouve uniquement les consignes, lieux et horaires vérifiés et publiés par Boissy-UJ. Une information absente n’est pas confirmée.');
  root.append(intro);
  const controls=el('div','join-listing-tools');
  const label=el('label','join-select-label','Thématique');
  const topic=el('select','join-select');
  for(const [value,title] of [['all','Toutes les informations'],...Object.entries(NOTICE_TOPICS)]){
    const option=el('option','',title);option.value=value;topic.append(option);
  }
  label.append(topic);
  const search=el('input','join-search');
  search.type='search';search.maxLength=100;
  search.placeholder='Rechercher une information…';
  search.setAttribute('aria-label','Rechercher dans les informations pratiques');
  controls.append(label,search);root.append(controls);
  const articles=el('div','join-practical-items');
  articles.setAttribute('aria-live','polite');
  root.append(articles);
  const redraw=()=>{
    const filtered=filterPublicNotices(data.notices,{topic:topic.value,query:search.value});
    articles.replaceChildren();
    if(data.unavailable.includes('notices')){
      const warning=el('p','join-neutral',
        'Les informations pratiques officielles sont momentanément indisponibles. Les horaires et lieux ne peuvent pas être confirmés.');
      warning.setAttribute('role','status');
      articles.append(warning);
    }else if(!filtered.length)articles.append(el('p','join-neutral',
      'Aucune information pratique vérifiée n’est encore publiée dans cette sélection.'));
    else filtered.forEach(row=>articles.append(noticeCard(row)));
  };
  topic.addEventListener('change',redraw);
  search.addEventListener('input',redraw);
  redraw();
  root.append(contactArea(data.contacts,'general',data.unavailable.includes('contacts')));
  const footer=el('a','join-back-link','Nous rejoindre ↗');
  footer.href='#/rejoindre';root.append(footer);
}
const active={join:{generation:0,controller:null},practical:{generation:0,controller:null}};
function stop(kind){
  const state=active[kind];
  state.generation++;
  state.controller?.abort();
  state.controller=null;
}
async function mount(kind,id,build){
  stop(kind);
  const state=active[kind],generation=state.generation;
  const root=document.getElementById(id);
  if(!root)return;
  const ctrl=new AbortController();state.controller=ctrl;
  const deadline=boundedPublicRequest(ctrl.signal);
  root.replaceChildren(el('p','join-loading','Chargement des informations vérifiées du club…'));
  try{
    const data=await loadPublicClubInfo(deadline.signal);
    if(ctrl.signal.aborted||generation!==state.generation||!root.isConnected)return;
    build(root,data);
  }catch{
    if(ctrl.signal.aborted||generation!==state.generation||!root.isConnected)return;
    root.replaceChildren(el('p','join-neutral',
      'Les informations officielles sont momentanément indisponibles. Aucun contact, horaire ou recrutement non vérifié ne sera affiché.'));
  }finally{deadline.dispose();}
}
export const mountJoin=()=>mount('join','join-public-hub',buildJoin);
export const unmountJoin=()=>stop('join');
export const mountPractical=()=>mount('practical','practical-public-hub',buildPractical);
export const unmountPractical=()=>stop('practical');
