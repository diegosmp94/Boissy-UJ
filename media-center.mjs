import {supabaseConfig} from './auth-config.mjs';

const BASE = supabaseConfig.url + '/rest/v1/news_posts';
let currentAbort=null;
let generation=0;

function el(tag,className='',text=null){
  const n=document.createElement(tag);
  if(className)n.className=className;
  if(text!==null)n.textContent=String(text);
  return n;
}

export function humanKind(kind){
  return ({article:'Article',photo:'Galerie',video:'Vidéo'})[kind] || 'Actualité';
}
function normalizeSearch(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('fr-FR');
}
export function filterNews(rows,{kind='all',query=''}={}){
  const term=normalizeSearch(query.trim());
  return rows.filter(post=>(kind==='all'||post.content_kind===kind)
    && (!term||[post.title,post.excerpt,post.body].some(v=>
      normalizeSearch(v).includes(term))));
}
function publishDate(value){
  if(!value||Number.isNaN(Date.parse(value)))return 'Date non disponible';
  return new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeZone:'Europe/Paris'}).format(new Date(value));
}

function card(post){
  const article=el('article','news-card');
  const top=el('div','news-meta');
  top.append(
    el('span','news-kind',humanKind(post.content_kind)),
    el('time','news-date',publishDate(post.published_at))
  );
  top.lastElementChild.dateTime=post.published_at;
  article.append(top,el('h3','',post.title));
  if(post.excerpt)article.append(el('p','news-excerpt',post.excerpt));
  if(post.body){
    const details=el('details','news-details');
    details.append(el('summary','','Lire la publication'),el('p','news-body',post.body));
    article.append(details);
  }
  return article;
}

function showFeed(root,rows,ready){
  root.replaceChildren();
  const options=el('div','news-controls');
  const inputLabel=el('label','news-label','Rechercher');
  const search=el('input','news-search');
  search.type='search';
  search.placeholder='Rechercher une actualité';
  search.maxLength=100;
  search.autocomplete='off';
  search.setAttribute('aria-label','Rechercher une actualité');
  inputLabel.append(search);
  const selectLabel=el('label','news-label','Type');
  const select=el('select','news-select');
  select.setAttribute('aria-label','Filtrer les publications par type');
  for(const [value,name] of [['all','Tout voir'],['article','Articles'],['photo','Galeries'],['video','Vidéos']]){
    const option=el('option','',name);option.value=value;select.append(option);
  }
  selectLabel.append(select);
  options.append(inputLabel,selectLabel);
  const container=el('div','news-feed');
  const count=el('p','news-count');
  root.append(options,count,container);
  if(!ready){
    const notice=el('p','news-notice',
      'Les publications ne peuvent pas être chargées : le service éditorial est en cours de préparation. Aucune actualité fictive n’est affichée.');
    notice.setAttribute('role','status');
    root.prepend(notice);
  }
  const update=()=>{
    container.replaceChildren();
    const results=filterNews(rows,{kind:select.value,query:search.value});
    count.textContent=results.length+' publication(s) visible(s)';
    if(!results.length){
      container.append(el('div','news-empty',
        ready?'Aucune actualité publiée ne correspond à ces critères.':'Les premières publications apparaîtront ici après mise en service.'));
    }else results.forEach(p=>container.append(card(p)));
  };
  search.addEventListener('input',update);
  select.addEventListener('change',update);
  update();
}

export function unmountNews(){
  generation++;
  currentAbort?.abort();
  currentAbort=null;
}
export async function mountNews(){
  unmountNews();
  const id=generation;
  const root=document.getElementById('news-feed-public');
  if(!root)return;
  const ctrl=new AbortController();
  currentAbort=ctrl;
  root.replaceChildren(el('p','news-loading','Chargement des publications…'));
  try {
    const params=new URLSearchParams({
      select:'id,slug,title,excerpt,body,content_kind,published_at',
      status:'eq.published',
      visibility:'eq.public',
      consent_reviewed:'eq.true',
      published_at:'lte.'+new Date().toISOString(),
      order:'published_at.desc',
      limit:'50'
    });
    const response=await fetch(BASE+'?'+params.toString(),{
      method:'GET',signal:ctrl.signal,cache:'no-store',
      headers:{apikey:supabaseConfig.publishableKey,Accept:'application/json'}
    });
    if(!response.ok)throw new Error('Source éditoriale indisponible');
    const data=await response.json();
    if(!Array.isArray(data))throw new Error('Format éditorial invalide');
    if(ctrl.signal.aborted||id!==generation||!root.isConnected)return;
    showFeed(root,data,true);
  }catch(err){
    if(ctrl.signal.aborted||id!==generation||!root.isConnected)return;
    showFeed(root,[],false);
  }
}
