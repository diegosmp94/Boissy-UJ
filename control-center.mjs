/**
 * Boissy-UJ Control Center — SAFE PUBLIC DESIGN PREVIEW.
 *
 * Intentional constraints: no privileged fetches, no persistence,
 * no backend writes, no actual admin access. The future production
 * version MUST authorize each action on a secured server using
 * Supabase Auth + assigned team scope + AAL2 for administrators.
 */
export const CONTROL_MODULES = Object.freeze([
  {id:'overview',name:'Vue générale',group:'Pilotage',phase:'socle',description:'Tableau de bord associatif et synthèse des opérations, alimentés plus tard par des indicateurs autorisés.',publicRoute:null},
  {id:'members',name:'Utilisateurs & rôles',group:'Pilotage',phase:'a-venir',description:'Comptes, rôles cumulables, invitations et réinitialisation par e-mail, avec audit et protection des mineurs.',publicRoute:'#/mon-espace'},
  {id:'teams',name:'Équipes & effectifs',group:'Sport',phase:'socle',description:'Quatre équipes validées, saisons, affectations et autorisations des éducateurs.',publicRoute:'#/equipes'},
  {id:'matches',name:'Match Center',group:'Sport',phase:'socle',description:'Calendriers, compositions, résultats et statistiques vérifiées ou saisies par le club.',publicRoute:'#/matchs'},
  {id:'media',name:'Actualités & médias',group:'Contenu',phase:'socle',description:'Gestion éditoriale, versions, publication encadrée et respect des droits à l’image.',publicRoute:'#/actualites'},
  {id:'premium',name:'Communauté & Awards',group:'Contenu',phase:'a-venir',description:'Votes premium, avantages, modération des réactions et accès réservés.',publicRoute:'#/communaute'},
  {id:'events',name:'Événements & billets',group:'Gestion',phase:'socle',description:'Programme, capacités, tarifs et réservations après validation du backend.',publicRoute:'#/evenements'},
  {id:'finances',name:'Dons & finances',group:'Gestion',phase:'a-venir',description:'Comptabilité des dons, abonnements, transactions et rapprochements Stripe TEST puis LIVE autorisé.',publicRoute:'#/soutenir'},
  {id:'appearance',name:'Éditeur du site',group:'Design',phase:'apercu',description:'Sections de l’accueil, ordre de lecture et aperçu du site avant publication.',publicRoute:'#/'},
  {id:'security',name:'Sécurité & intégrations',group:'Configuration',phase:'a-venir',description:'RLS, MFA, journaux, sauvegardes, sources FFF autorisées et paramètres de conformité.',publicRoute:null}
]);
export const HOME_CHAPTERS = Object.freeze([
  {id:'identite',name:'Identité du club',visible:true},
  {id:'bienvenue',name:'Bienvenue',visible:true},
  {id:'competition',name:'Compétitions',visible:true},
  {id:'equipes',name:'Nos équipes',visible:true},
  {id:'medias',name:'Actualités & médias',visible:true},
  {id:'communaute',name:'Supporters & communauté',visible:true},
  {id:'soutenir',name:'Soutenir le club',visible:true},
  {id:'rejoindre',name:'Rejoindre Boissy-UJ',visible:true}
]);

export function filterControlModules(modules,query='',group='all'){
  const normalized=value=>String(value||'').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-FR');
  const term=normalized(query.trim());
  return modules.filter(m=>(group==='all'||m.group===group)
    && (!term||[m.name,m.group,m.description].some(x=>normalized(x).includes(term))));
}
export function moveHomeChapter(chapters,id,delta) {
  if(!Number.isInteger(delta)||Math.abs(delta)!==1) return chapters.map(x=>({...x}));
  const next=chapters.map(x=>({...x}));
  const at=next.findIndex(x=>x.id===id);
  const target=at+delta;
  if(at<0||target<0||target>=next.length) return next;
  [next[at],next[target]]=[next[target],next[at]];
  return next;
}
export function changeHomeVisibility(chapters,id,visible) {
  return chapters.map(x=>x.id===id?{...x,visible:Boolean(visible)}:{...x});
}

const phaseLabel = {socle:'Socle disponible',apercu:'Aperçu interactif', 'a-venir':'À développer'};
let generation=0;
let mounted=null;
const textEl=(tag,name,text)=>{
  const el=document.createElement(tag);
  if(name)el.className=name;
  if(text!=null)el.textContent=String(text);
  return el;
};
const link=(href,text,className)=>{
  const el=textEl('a',className,text);
  el.href=href;
  return el;
};
const button=(name,label)=>{
  const b=textEl('button',name,label);
  b.type='button';
  return b;
};

export function controlCenterMarkup(){
  return `<div class="cc-intro"><span class="tiny-label">BOISSY-UJ CONTROL CENTER · PRÉVERSION</span><h1>CENTRE DE <em>GESTION.</em></h1><p>Un environnement unique pour préparer le pilotage du club, des équipes aux finances. Cette préversion présente uniquement des modules et des réglages de démonstration.</p></div><div id="control-center-root" class="cc-root" aria-live="polite"></div>`;
}

function buildOverview(root){
  const stats=textEl('div','cc-stats');
  for(const [label,value,subtext] of [
    ['Équipes prévues','04','Seniors A, B, C et Vétérans'],
    ['Modules du centre',String(CONTROL_MODULES.length).padStart(2,'0'),'Feuille de route en cours'],
    ['Encaissements LIVE','00','Paiements non activés'],
    ['Accès administrateur','—','Authentification encore verrouillée']
  ]){
    const item=textEl('div','cc-stat');
    item.append(textEl('span','cc-stat-label',label),textEl('strong','',value),textEl('span','cc-stat-note',subtext));
    stats.append(item);
  }
  root.append(stats);
}
function sectionEditor(root){
  root.replaceChildren();
  const head=textEl('div','cc-pane-head');
  head.append(textEl('h2','','Éditeur de l’accueil'),textEl('p','',
    'Déplace ou masque les chapitres pour explorer une mise en page. Les changements sont temporaires, non sauvegardés et ne modifient pas le site publié.'));
  root.append(head);
  let sections=HOME_CHAPTERS.map(x=>({...x}));
  const counter=textEl('p','cc-count');
  const list=textEl('ol','cc-editor-list');
  const preview=textEl('div','cc-editor-preview');
  function draw(){
    list.replaceChildren();preview.replaceChildren();
    const visible=sections.filter(x=>x.visible);
    counter.textContent=visible.length+' chapitre(s) visibles sur '+sections.length+' · prévisualisation locale';
    sections.forEach((chapter,i)=>{
      const li=textEl('li','cc-editor-row');
      const main=textEl('div','cc-editor-item');
      main.append(textEl('span','cc-editor-position',String(i+1).padStart(2,'0')),
        textEl('strong','',chapter.name));
      const controls=textEl('div','cc-editor-actions');
      const up=button('cc-small-btn','↑');
      up.setAttribute('aria-label','Monter '+chapter.name);
      up.disabled=i===0;
      up.addEventListener('click',()=>{sections=moveHomeChapter(sections,chapter.id,-1);draw()});
      const down=button('cc-small-btn','↓');
      down.setAttribute('aria-label','Descendre '+chapter.name);
      down.disabled=i===sections.length-1;
      down.addEventListener('click',()=>{sections=moveHomeChapter(sections,chapter.id,1);draw()});
      const label=textEl('label','cc-switch-label');
      const check=document.createElement('input');
      check.type='checkbox';check.checked=chapter.visible;
      check.addEventListener('change',()=>{sections=changeHomeVisibility(sections,chapter.id,check.checked);draw()});
      label.append(check,textEl('span','','Visible'));
      controls.append(up,down,label);
      li.append(main,controls);
      list.append(li);
    });
    if(visible.length===0) preview.append(textEl('p','cc-muted','Aucun chapitre sélectionné dans cet aperçu.'));
    else visible.forEach((chapter,i)=>{
      const block=textEl('div','cc-preview-chapter');
      block.append(textEl('span','',String(i+1).padStart(2,'0')),textEl('strong','',chapter.name));
      preview.append(block);
    });
  }
  const reset=button('cc-reset','Réinitialiser cet aperçu');
  reset.addEventListener('click',()=>{sections=HOME_CHAPTERS.map(x=>({...x}));draw()});
  root.append(counter,list,textEl('h3','cc-preview-heading','Ordre actuellement prévisualisé'),preview,reset);
  draw();
}
function modulePanel(root,module){
  root.replaceChildren();
  if(module.id==='appearance'){sectionEditor(root);return}
  const head=textEl('div','cc-pane-head');
  head.append(textEl('span','cc-phase',phaseLabel[module.phase]),
    textEl('h2','',module.name),textEl('p','',module.description));
  root.append(head);
  const note=textEl('div','cc-readonly-message');
  note.append(textEl('strong','','Accès protégé · aucune opération active'),
    textEl('p','',
      'Aucune donnée privée n’est chargée et aucune modification serveur n’est possible dans cette préversion. Les futurs outils exigeront une session autorisée, des droits vérifiés côté serveur et un journal d’audit.'));
  root.append(note);
  if(module.id==='overview')buildOverview(root);
  if(module.publicRoute){
    root.append(link(module.publicRoute,'Consulter la rubrique publique ↗','cc-public-link'));
  }
}

export function unmountControlCenter(){
  generation++;
  if(mounted){mounted.replaceChildren();mounted=null}
}
export function mountControlCenter(){
  unmountControlCenter();
  const root=document.getElementById('control-center-root');
  if(!root)return;
  mounted=root;
  const banner=textEl('div','cc-preview-banner');
  banner.setAttribute('role','status');
  banner.append(textEl('strong','','MODE PRÉVISUALISATION — AUCUN ACCÈS ADMINISTRATEUR'),
    textEl('p','',
      'L’authentification administrative reste fermée. Tous les indicateurs affichés sont des informations de conception ; aucun membre, billet ou paiement réel n’est exposé.'));
  const layout=textEl('div','cc-layout');
  const side=textEl('aside','cc-sidebar');
  const title=textEl('h2','','Modules du club');
  const label=textEl('label','cc-filter-label','Rechercher un module');
  const search=textEl('input','cc-module-search');
  search.type='search'; search.maxLength=80;
  search.placeholder='Équipes, statistiques, finance…';
  search.setAttribute('aria-label','Rechercher un module');
  label.append(search);
  const groupLabel=textEl('label','cc-filter-label','Catégorie');
  const group=document.createElement('select');
  group.className='cc-group-select';
  for(const name of ['all',...new Set(CONTROL_MODULES.map(m=>m.group))]){
    const opt=textEl('option','',name==='all'?'Toutes les catégories':name);opt.value=name;group.append(opt);
  }
  groupLabel.append(group);
  const nav=textEl('nav','cc-module-list');
  nav.setAttribute('aria-label','Navigation du Control Center');
  side.append(title,label,groupLabel,nav);
  const pane=textEl('section','cc-pane');
  pane.setAttribute('aria-label','Détail du module');
  layout.append(side,pane);
  root.append(banner,layout);
  let active='overview';
  function rerender(){
    const list=filterControlModules(CONTROL_MODULES,search.value,group.value);
    nav.replaceChildren();
    if(!list.length)nav.append(textEl('p','cc-muted','Aucun module correspondant.'));
    list.forEach(m=>{
      const item=button('cc-module-button',m.name);
      item.setAttribute('aria-current',active===m.id?'page':'false');
      item.append(textEl('small','',phaseLabel[m.phase]));
      item.addEventListener('click',()=>{active=m.id;rerender()});
      nav.append(item);
    });
    const selected=CONTROL_MODULES.find(m=>m.id===active);
    if(selected)modulePanel(pane,selected);
  }
  search.addEventListener('input',rerender);
  group.addEventListener('change',rerender);
  rerender();
}
