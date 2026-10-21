import {supabaseConfig} from './auth-config.mjs';
import {mountMatchWorkspace} from './match-workspace.mjs';
import {mountMediaWorkspace} from './staff-workflows.mjs';
import {mountCallupsPreview} from './callups-preview.mjs';
import {mountSeasonPreview} from './season-workspace.mjs';

export const SHOWCASE_MODULES=Object.freeze([
  {label:'Équipes',href:'#/equipes',state:'public',detail:'Cinq équipes : quatre de football à 11 et une de futsal D2, avec pages consultables.'},
  {label:'Match Center',href:'#/matchs',state:'public',detail:'Rencontres et bilans réellement publiés.'},
  {label:'Actualités',href:'#/actualites',state:'public',detail:'Articles visibles après contrôle de publication.'},
  {label:'Événements',href:'#/evenements',state:'public',detail:'Catalogue et informations d’événements en lecture.'},
  {label:'Awards',href:'#/awards',state:'public',detail:'Nominations et résultats soumis à publication.'},
  {label:'Nous rejoindre',href:'#/rejoindre',state:'public',detail:'Parcours, annonces et contacts confirmés.'},
  {label:'Infos pratiques',href:'#/infos-pratiques',state:'public',detail:'Recherche des consignes publiées par le club.'},
  {label:'Administration',href:'#/control-center',state:'preview',detail:'Prévisualisation locale ; écritures réelles bloquées.'}
]);
export const SHOWCASE_EXERCISES=Object.freeze([
  {id:'match',label:'Match',description:'Préparer une fiche, vérifier score et statut.'},
  {id:'article',label:'Actualité',description:'Rédiger un brouillon et prévisualiser la publication.'},
  {id:'callup',label:'Convocation',description:'Simuler les réponses sans accéder à des joueurs.'},
  {id:'season',label:'Saison',description:'Vérifier les dates et visualiser les saisons publiques.'}
]);
export const PUBLIC_CATALOGUES=Object.freeze([
  {name:'Équipes',table:'club_teams',href:'#/equipes'},
  {name:'Matchs publiés',table:'matches',href:'#/matchs'},
  {name:'Actualités publiées',table:'news_posts',href:'#/actualites'},
  {name:'Événements publiés',table:'club_events',href:'#/evenements'},
  {name:'Awards publiés',table:'club_awards',href:'#/awards'},
  {name:'Annonces de recrutement',table:'club_join_opportunities',href:'#/rejoindre'}
]);

const elt=(tag,className='',value=null)=>{
  const element=document.createElement(tag);
  if(className)element.className=className;
  if(value!==null)element.textContent=String(value);
  return element;
};
export function parsePublicCount(headerValue){
  const match=/\/(\d+|\*)$/.exec(String(headerValue||''));
  return match&&match[1]!=='*'?Number(match[1]):null;
}
export async function probePublicCatalogues(signal,fetcher=fetch){
  return Promise.all(PUBLIC_CATALOGUES.map(async(item)=>{
    const params=new URLSearchParams({select:'id',limit:'1'});
    const url=supabaseConfig.url+'/rest/v1/'+item.table+'?'+params;
    try{
      const response=await fetcher(url,{
        method:'GET',signal,cache:'no-store',
        headers:{
          apikey:supabaseConfig.publishableKey,
          Prefer:'count=exact',
          Accept:'application/json'
        }
      });
      if(!response.ok)return {...item,accessible:false,count:null};
      const body=await response.json();
      if(!Array.isArray(body))return {...item,accessible:false,count:null};
      return {...item,accessible:true,count:parsePublicCount(response.headers?.get?.('content-range'))};
    }catch(error){
      if(signal?.aborted)throw error;
      return {...item,accessible:false,count:null};
    }
  }));
}
function makeLink(text,href,className=''){
  const a=elt('a',className,text);
  a.href=href;
  return a;
}
function makeStatus(entry){
  const card=elt('article','showcase-health-card');
  card.append(elt('span','showcase-health-name',entry.name));
  card.append(elt('strong',
    entry.accessible?'showcase-health-good':'showcase-health-unknown',
    entry.accessible
      ?(entry.count===null?'Accessible':entry.count+' entrée(s) visible(s)')
      :'Indisponible pour le moment'));
  const copy=entry.accessible
    ?'Lecture des données publiques sous les règles Supabase.'
    :'Le module public reste accessible, mais ses données ne sont pas confirmées.';
  card.append(elt('p','',copy),makeLink('Voir la rubrique ↗',entry.href,'showcase-small-link'));
  return card;
}
function buildModules(root){
  const section=elt('section','showcase-block');
  section.append(elt('span','showcase-eyebrow','01 · EXPLORER'),
    elt('h2','','Les fonctionnalités déjà accessibles'),
    elt('p','showcase-lead','Ouvre les véritables pages du site. Les catalogues ne montrent que les contenus publiés par le club.'));
  const grid=elt('div','showcase-feature-grid');
  for(const mod of SHOWCASE_MODULES){
    const article=elt('article','showcase-feature-card');
    article.append(
      elt('span','showcase-feature-state',mod.state==='public'?'RUBRIQUE PUBLIQUE':'APERÇU'),
      elt('h3','',mod.label),
      elt('p','',mod.detail),
      makeLink('Ouvrir ↗',mod.href,'showcase-feature-link')
    );
    grid.append(article);
  }
  section.append(grid);root.append(section);
}
function buildDataChecks(root,signal){
  const section=elt('section','showcase-block');
  section.append(
    elt('span','showcase-eyebrow','02 · BASE DE DONNÉES'),
    elt('h2','','Données publiques en direct'),
    elt('p','showcase-lead','La vérification ci-dessous interroge Supabase en lecture seule. Zéro donnée publiée signifie que la rubrique est prête mais pas encore alimentée.')
  );
  const button=elt('button','showcase-refresh','Vérifier à nouveau');
  button.type='button';
  const status=elt('p','showcase-check-status','Vérification des catalogues…');
  status.setAttribute('role','status');
  const grid=elt('div','showcase-health-grid');
  let counter=0;
  async function reload(){
    const turn=++counter;
    status.textContent='Connexion à Supabase en cours…';
    button.disabled=true;
    try{
      const rows=await probePublicCatalogues(signal);
      if(signal.aborted||turn!==counter||!grid.isConnected)return;
      grid.replaceChildren();
      for(const item of rows)grid.append(makeStatus(item));
      const ok=rows.filter(x=>x.accessible).length;
      status.textContent=ok+' catalogue(s) public(s) accessibles sur '+rows.length+
        '. Les champs privés et les écritures ne sont pas interrogés.';
    }catch{
      if(!signal.aborted&&grid.isConnected)
        status.textContent='Contrôle interrompu. Aucun état de base non vérifié n’est annoncé.';
    }finally{
      if(!signal.aborted&&turn===counter&&button.isConnected)button.disabled=false;
    }
  }
  button.addEventListener('click',()=>void reload());
  section.append(button,status,grid);root.append(section);
  void reload();
}
function buildExercises(root){
  const section=elt('section','showcase-block');
  section.append(
    elt('span','showcase-eyebrow','03 · ESSAYER'),
    elt('h2','','Des modules réellement interactifs'),
    elt('p','showcase-lead','Teste les formulaires et aperçus existants. Les modifications restent uniquement à l’écran : elles ne créent aucun match, article, joueur ou abonnement réel.')
  );
  const tabs=elt('div','showcase-tabs');
  tabs.setAttribute('role','group');
  tabs.setAttribute('aria-label','Choisir un module interactif');
  const slot=elt('div','showcase-demo-slot');
  const notice=elt('p','showcase-local-banner','MODE DÉMONSTRATION — SAISIE LOCALE, AUCUNE PUBLICATION OU ÉCRITURE EN BASE');
  notice.setAttribute('role','note');
  const mountMap={
    match:mountMatchWorkspace,
    article:mountMediaWorkspace,
    callup:mountCallupsPreview,
    season:mountSeasonPreview
  };
  const buttons=[];
  function setExercise(id){
    if(!Object.hasOwn(mountMap,id))return;
    for(const btn of buttons){
      const active=btn.dataset.exercise===id;
      btn.setAttribute('aria-pressed',String(active));
    }
    slot.replaceChildren();
    mountMap[id](slot);
  }
  for(const item of SHOWCASE_EXERCISES){
    const button=elt('button','showcase-tab',item.label);
    button.type='button';
    button.dataset.exercise=item.id;
    button.title=item.description;
    button.addEventListener('click',()=>setExercise(item.id));
    buttons.push(button);
    tabs.append(button);
  }
  section.append(notice,tabs,slot);
  root.append(section);
  setExercise('match');
}
function buildGuidedRoute(root){
  const section=elt('section','showcase-block');
  section.append(
    elt('span','showcase-eyebrow','04 · PARCOURS DE VISITE'),
    elt('h2','','Une démonstration en cinq minutes'),
    elt('p','showcase-lead','Une suggestion de parcours pour montrer la navigation, les modules fonctionnels et les limites de la préversion.')
  );
  const steps=[
    ['01','Découvrir le club','#/','Présentation cinématique et identité visuelle'],
    ['02','Consulter les équipes','#/equipes','Quatre catégories et informations vérifiées'],
    ['03','Voir le Match Center','#/matchs','Écran de rencontres et de bilans publiés'],
    ['04','Découvrir les Awards','#/awards','Recherche et catalogue des distinctions'],
    ['05','Rejoindre le club','#/rejoindre','Parcours interactifs et annonces contrôlées']
  ];
  const list=elt('ol','showcase-route-list');
  for(const [number,title,href,description] of steps){
    const item=elt('li','showcase-route-step');
    item.append(elt('strong','showcase-route-number',number));
    const contents=elt('div');
    contents.append(elt('h3','',title),elt('p','',description));
    item.append(contents,makeLink('Accéder ↗',href,'showcase-small-link'));
    list.append(item);
  }
  section.append(list);
  root.append(section);
}
let generation=0;
let currentController=null;
export function unmountPresentation(){
  generation++;
  currentController?.abort();
  currentController=null;
}
export function mountPresentation(){
  unmountPresentation();
  const root=document.getElementById('showcase-hub');
  if(!root)return;
  const ctrl=new AbortController();
  currentController=ctrl;
  root.replaceChildren();
  buildModules(root);
  buildDataChecks(root,ctrl.signal);
  buildExercises(root);
  buildGuidedRoute(root);
}
