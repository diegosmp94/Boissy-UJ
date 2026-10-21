import {supabaseConfig} from './auth-config.mjs';
import {CLUB_TEAMS,DISCIPLINES,teamsByDiscipline} from './club-teams.mjs';
export const IDENTITY_SECTIONS=Object.freeze([
 {id:'history',label:'Histoire'}, {id:'values',label:'Valeurs'},
 {id:'governance',label:'Organisation'}, {id:'projects',label:'Projets'}
]);
export const TEAM_OVERVIEW=Object.freeze(CLUB_TEAMS.map(t=>({
  name:t.name,level:t.division,discipline:t.discipline
})));
export function normalizeIdentitySearch(value){
 return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-FR').trim();
}
export function filterIdentitySections(items,{section='all',query=''}={}){
 const q=normalizeIdentitySearch(query);
 return items.filter(x=>x.published===true&&(section==='all'||x.section===section)
  &&(!q||[x.title,x.body].some(v=>normalizeIdentitySearch(v).includes(q))))
  .sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||String(a.title).localeCompare(String(b.title),'fr'));
}
export async function loadPublishedIdentity(signal,fetcher=fetch){
 const params=new URLSearchParams({select:'id,section,title,body,sort_order,published',
  published:'eq.true',order:'sort_order.asc',limit:'100'});
 const response=await fetcher(supabaseConfig.url+'/rest/v1/club_identity_sections?'+params,{
  method:'GET',signal,cache:'no-store',
  headers:{apikey:supabaseConfig.publishableKey,Accept:'application/json'}
 });
 if(!response.ok)throw new Error('Catalogue indisponible');
 const data=await response.json();
 if(!Array.isArray(data))throw new Error('Format inattendu');
 return data.filter(x=>x.published===true);
}
const node=(tag,cls='',text=null)=>{
 const e=document.createElement(tag);if(cls)e.className=cls;
 if(text!==null)e.textContent=String(text);return e;
};
let generation=0,controller=null;
export function unmountIdentity(){generation++;controller?.abort();controller=null;}
export async function mountIdentity(){
 unmountIdentity();
 const g=generation,root=document.getElementById('identity-public-root');
 if(!root)return;
 const ctrl=new AbortController();controller=ctrl;
 const top=node('section','identity-overview');
 top.append(node('p','identity-eyebrow','NOTRE CLUB'),node('h2','','Cinq équipes. Deux disciplines.'),
  node('p','identity-lead','Boissy-UJ réunit le football à 11 et le futsal. Découvrez les équipes et les contenus officiellement publiés.'));
 for(const discipline of DISCIPLINES){
  const group=node('section','identity-discipline');
  group.append(node('h3','identity-discipline-title',discipline.label));
  const grid=node('div','identity-teams');
  for(const t of teamsByDiscipline(discipline.id,TEAM_OVERVIEW)){
   const card=node('article','identity-team');
   card.append(node('h4','',t.name),node('p','',t.level));
   grid.append(card);
  }
  group.append(grid);top.append(group);
 }
 const published=node('section','identity-published');
 published.append(node('p','identity-eyebrow','PUBLICATIONS DU CLUB'),node('h2','','Notre histoire, nos valeurs et nos projets'),
  node('p','identity-lead','Les contenus ci-dessous sont affichés uniquement après validation et publication par le club.'));
 const controls=node('div','identity-controls');
 const category=node('select','identity-select');
 category.setAttribute('aria-label','Filtrer les contenus par rubrique');
 for(const [value,label] of [['all','Toutes les rubriques'],...IDENTITY_SECTIONS.map(x=>[x.id,x.label])]){
  const opt=node('option','',label);opt.value=value;category.append(opt);
 }
 const search=node('input','identity-search');
 search.type='search';search.maxLength=100;search.placeholder='Rechercher une publication…';
 search.setAttribute('aria-label','Rechercher dans les publications du club');
 controls.append(category,search);
 const list=node('div','identity-articles');list.setAttribute('aria-live','polite');
 published.append(controls,list);
 const links=node('nav','identity-next');links.setAttribute('aria-label','Découvrir Boissy-UJ');
 for(const [href,label] of [['#/equipes','Découvrir nos équipes'],['#/rejoindre','Nous rejoindre'],['#/infos-pratiques','Infos pratiques']]){
  const a=node('a','identity-next-link',label+' ↗');a.href=href;links.append(a);
 }
 root.replaceChildren(top,published,links);
 list.append(node('p','identity-empty','Chargement des contenus publiés…'));
 try{
  const rows=await loadPublishedIdentity(ctrl.signal);
  if(ctrl.signal.aborted||generation!==g||!root.isConnected)return;
  const draw=()=>{
   const filtered=filterIdentitySections(rows,{section:category.value,query:search.value});
   list.replaceChildren();
   if(!filtered.length){
    list.append(node('p','identity-empty','Aucun contenu officiel publié dans cette sélection pour le moment.'));
    return;
   }
   for(const entry of filtered){
    const card=node('article','identity-article');
    card.append(node('span','identity-article-label',IDENTITY_SECTIONS.find(x=>x.id===entry.section)?.label||'Club'),
     node('h3','',entry.title),node('p','',entry.body));
    list.append(card);
   }
  };
  category.addEventListener('change',draw);search.addEventListener('input',draw);draw();
 }catch{
  if(ctrl.signal.aborted||generation!==g||!root.isConnected)return;
  list.replaceChildren(node('p','identity-empty','Les publications officielles sont momentanément indisponibles. Aucun historique, dirigeant ou projet non vérifié ne sera affiché.'));
 }
}
