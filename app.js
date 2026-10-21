import {mountNews,unmountNews} from './media-center.mjs';
import {mountSport,unmountSport} from './sport-center.mjs';
import {authMarkup,mountAuth,unmountAuth} from './auth.mjs';
function initIntro(){
  const intro=document.getElementById('cinema-intro');
  const skip=document.getElementById('intro-skip');
  if(!intro)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let seen=false;
  try{seen=window.sessionStorage.getItem('boissy-intro-seen')==='1';}catch{}
  let timer;
  const dismiss=()=>{
    if(intro.classList.contains('is-dismissed'))return;
    window.clearTimeout(timer);
    intro.classList.add('is-dismissed');
    intro.setAttribute('aria-hidden','true');
    try{window.sessionStorage.setItem('boissy-intro-seen','1');}catch{}
    window.setTimeout(()=>intro.remove(),550);
  };
  skip?.addEventListener('click',dismiss);
  if(reduced||seen){dismiss();return;}
  timer=window.setTimeout(dismiss,1550);
}
initIntro();

const crest = './assets/ecusson-boissy-uj.webp';
const teams = [
  {name:'Seniors A',league:'Départemental 3',tag:'D3',source:'FFF · données à connecter',desc:'Le groupe fanion de Boissy-UJ.'},
  {name:'Seniors B',league:'Départemental 4',tag:'D4',source:'FFF · données à connecter',desc:'La dynamique du collectif.'},
  {name:'Seniors C',league:'Matchs amicaux',tag:'AMICAL',source:'Calendrier géré par le club',desc:'Le football et le plaisir du jeu.'},
  {name:'Vétérans',league:'Départemental 3',tag:'D3',source:'FFF · données à connecter',desc:'L’expérience au service du collectif.'},
];
const chapters = [
  {id:'identite',name:'Identité'}, {id:'bienvenue',name:'Bienvenue'}, {id:'competition',name:'Compétition'},
  {id:'equipes',name:'Équipes'}, {id:'medias',name:'Médias'}, {id:'communaute',name:'Communauté'},
  {id:'soutenir',name:'Soutenir'}, {id:'rejoindre',name:'Rejoindre'},
];
const $ = selector => document.querySelector(selector);
const main = $('#main');
const tag = (text,extra='') => `<span class="eyebrow ${extra}">${text}</span>`;
const link = (href,text,extra='') => `<a class="btn ${extra}" href="${href}">${text}<span aria-hidden="true">↗</span></a>`;
const arrow = next => `<button type="button" class="chapter-next" data-next="${next}" aria-label="Passer au chapitre suivant"><span>Défiler pour découvrir</span><b aria-hidden="true">↓</b></button>`;
const teamCard = (team,index) => `<article class="team-card"><span class="team-index">0${index+1} / 04</span><div class="team-symbol" aria-hidden="true"><img src="${crest}" alt="" loading="lazy" /></div><div><span class="tiny-label">${team.tag}</span><h3>${team.name}</h3><p>${team.league}</p></div><a class="text-link" href="#/equipes" aria-label="Découvrir ${team.name}">Découvrir <span aria-hidden="true">↗</span></a></article>`;

function home(){return `
  <div class="chapters">
    <section class="chapter chapter-identity" id="identite" aria-labelledby="identity-title">
      <div class="orb orb-a"></div><div class="orb orb-b"></div><div class="pitch-lines" aria-hidden="true"></div>
      <div class="hero-content">
        ${tag('Boissy-UJ · Union Jeunes')}
        <div class="crest-halo"><img class="hero-crest" src="${crest}" alt="Écusson officiel de Boissy-UJ" width="170" height="170" /></div>
        <h1 id="identity-title">PLUS QU’UN CLUB.<br/><em>UNE IDENTITÉ.</em></h1>
        <p>Le football, l’esprit d’équipe et une communauté réunis sous les mêmes couleurs.</p>
        <div class="hero-ctas">${link('#/equipes','Découvrir nos équipes','btn-primary')}${link('#/rejoindre','Rejoindre le club','btn-ghost')}</div>
      </div>
      <div class="vertical-rule" aria-hidden="true">BOISSY-UJ · 2026</div>
      ${arrow('bienvenue')}
    </section>
    <section class="chapter chapter-welcome" id="bienvenue" aria-labelledby="welcome-title">
      <div class="section-copy"><span class="chapter-no">02 / 08</span>${tag('Notre histoire s’écrit ensemble')}<h2 id="welcome-title">UN MAILLOT.<br/><em>UNE MÊME PASSION.</em></h2><p>Sur le terrain et en dehors, Boissy-UJ avance avec celles et ceux qui font vivre le club au quotidien.</p>${link('#/rejoindre','Faire partie de l’aventure','btn-outline')}</div>
      <div class="graphic-field" aria-hidden="true"><div class="graphic-center"></div><span>ENSEMBLE</span></div>
      ${arrow('competition')}
    </section>
    <section class="chapter chapter-competition" id="competition" aria-labelledby="competition-title">
      <div class="section-copy"><span class="chapter-no">03 / 08</span>${tag('Le football au centre')}<h2 id="competition-title">CHAQUE MATCH<br/><em>COMPTE.</em></h2><p>Retrouvez les rencontres et les résultats officiels lorsqu’ils seront disponibles, ainsi que les statistiques du club.</p>${link('#/matchs','Ouvrir le Match Center','btn-primary')}</div>
      <div class="score-panel"><div class="panel-heading"><span class="live-dot"></span> PROCHAINES RENCONTRES</div><div class="versus"><span>BOISSY-UJ</span><strong>VS</strong><span>À VENIR</span></div><div class="panel-meta">Calendrier en cours de préparation</div><div class="score-divider"></div><div class="mini-stat"><span>4 équipes</span><span>3 compétitions FFF</span></div></div>
      ${arrow('equipes')}
    </section>
    <section class="chapter chapter-teams" id="equipes" aria-labelledby="teams-title"><div class="section-heading"><div><span class="chapter-no">04 / 08</span>${tag('Nos couleurs, nos équipes')}<h2 id="teams-title">QUATRE ÉQUIPES.<br/><em>UNE SEULE FAMILLE.</em></h2></div>${link('#/equipes','Toutes les équipes','btn-outline')}</div><div class="teams-grid">${teams.map(teamCard).join('')}</div>${arrow('medias')}</section>
    <section class="chapter chapter-media" id="medias" aria-labelledby="media-title"><div class="section-copy"><span class="chapter-no">05 / 08</span>${tag('Le club en images')}<h2 id="media-title">DES MOMENTS<br/><em>À PARTAGER.</em></h2><p>Actualités, albums photos et vidéos : les coulisses et les temps forts de Boissy-UJ se retrouveront ici.</p>${link('#/actualites','Explorer les actualités','btn-primary')}</div><div class="media-art" aria-label="Espace réservé aux futures photographies officielles"><div class="media-art-inner"><span class="media-play" aria-hidden="true">▶</span><strong>BOISSY<span>UJ</span></strong><small>VOS HISTOIRES. NOS COULEURS.</small></div></div>${arrow('communaute')}</section>
    <section class="chapter chapter-community" id="communaute" aria-labelledby="community-title"><div class="section-copy"><span class="chapter-no">06 / 08</span>${tag('L’expérience supporters')}<h2 id="community-title">VIVEZ LE CLUB<br/><em>AU PLUS PRÈS.</em></h2><p>Accédez à des contenus exclusifs, aux votes des Awards et à des événements privilégiés avec Boissy-UJ Premium.</p>${link('#/communaute','Découvrir Premium','btn-primary')}${link('#/evenements','Nos événements','btn-ghost')}</div><div class="premium-teaser"><span class="premium-star" aria-hidden="true">✦</span><div class="tiny-label">BOISSY-UJ PREMIUM</div><strong>10 €<small> / mois</small></strong><span class="premium-separator"></span><p>Ou 100 € pour 12 mois, sans renouvellement automatique.</p><div class="premium-footer">CONTENUS · ÉVÉNEMENTS · AWARDS</div></div>${arrow('soutenir')}</section>
    <section class="chapter chapter-support" id="soutenir" aria-labelledby="support-title"><div class="section-copy"><span class="chapter-no">07 / 08</span>${tag('Construisons la suite')}<h2 id="support-title">SOUTENIR<br/><em>NOTRE AVENIR.</em></h2><p>À travers les dons et les campagnes de financement, chaque soutien contribue aux projets du club.</p>${link('#/soutenir','Découvrir nos projets','btn-outline')}</div><div class="support-orbit" aria-hidden="true"><div class="support-orbit-mid"><img src="${crest}" alt="" /></div></div>${arrow('rejoindre')}</section>
    <section class="chapter chapter-join" id="rejoindre" aria-labelledby="join-title"><img class="join-watermark" src="${crest}" alt="" aria-hidden="true" /><div class="join-inner"><span class="chapter-no">08 / 08</span>${tag('La prochaine histoire commence ici')}<h2 id="join-title">ET SI C’ÉTAIT<br/><em>VOUS ?</em></h2><p>Joueurs, éducateurs, partenaires ou passionnés : votre place dans l’aventure Boissy-UJ est peut-être ici.</p><div class="hero-ctas">${link('#/rejoindre','Nous rejoindre','btn-primary')}${link('#/mon-espace','Mon espace','btn-ghost')}</div></div><footer class="site-footer">© Boissy-UJ · Association Boissy Union Jeunes <span>Site en construction · Informations légales à compléter</span></footer></section>
  </div><aside class="chapter-rail" aria-label="Navigation par chapitres">${chapters.map((c,i)=>`<button type="button" class="rail-dot" data-chapter="${c.id}" aria-label="Chapitre ${i+1} : ${c.name}" title="${c.name}"></button>`).join('')}</aside><div class="chapter-counter" aria-live="off">01 <span>/ 08</span></div>`;}

function pageShell(overline,title,description,body){return `<div class="page-shell"><div class="page-ambient"></div><div class="page-intro">${tag(overline)}<h1>${title}</h1><p>${description}</p></div><div class="page-body">${body}</div><footer class="simple-footer"><span>© Boissy-UJ — Site officiel en préparation</span><a href="#/">Retour à l’accueil ↗</a></footer></div>`;}
function matches(){return pageShell('Le terrain avant tout','MATCH <em>CENTER.</em>','Calendrier des quatre équipes : rencontres et résultats publiés par le club, avec source indiquée pour chaque match.',`<div class="info-banner"><span class="info-icon">i</span><div><strong>Données officielles FFF en cours de vérification</strong><p>Les rencontres apparaissent uniquement après publication. Le club peut également renseigner manuellement ses rencontres. Aucun score n’est inventé.</p></div></div><div id="match-center-live" class="sport-root" aria-live="polite"><p class="sport-loading">Aucune rencontre publiée pour le moment — chargement du calendrier…</p></div><div class="subhead"><h2>Nos compétitions</h2><span>SAISON À CONFIGURER</span></div><div class="detail-grid">${teams.map(t=>`<article class="detail-card"><span class="tiny-label">${t.tag}</span><h3>${t.name}</h3><p>${t.league}</p><small>${t.source}</small></article>`).join('')}</div>`);}

function teamPage(){return pageShell('Boissy-UJ · Saison à configurer','NOS <em>ÉQUIPES.</em>','Quatre collectifs, une même identité. Les effectifs, portraits et statistiques seront publiés avec les autorisations nécessaires.',`<div class="detail-grid">${teams.map((t,i)=>`<article class="detail-card team-detail"><span class="tiny-label">0${i+1} / 04 · ${t.tag}</span><img src="${crest}" width="78" height="78" alt="" loading="lazy"/><h2>${t.name}</h2><p>${t.league}</p><small>${t.desc}</small><div class="empty-caption">Effectif et calendrier à renseigner</div></article>`).join('')}</div>`);}
function news(){return pageShell('Vie du club','ACTUALITÉS <em>& MÉDIAS.</em>','Découvrez uniquement les informations publiées par Boissy-UJ : la vie du club, nos équipes et les événements.',`<div class="info-banner"><span class="info-icon">i</span><div><strong>Publications contrôlées</strong><p>Les brouillons, contenus privés et médias non autorisés ne sont pas affichés. Le club publiera progressivement ses actualités.</p></div></div><div id="news-feed-public" class="news-root" aria-live="polite"><p class="news-loading">Chargement des actualités…</p></div><div class="detail-grid two"><div class="detail-card"><span class="tiny-label">MÉDIAS</span><h3>Galeries photos</h3><p>Les photos ne seront accessibles qu'après vérification des autorisations de diffusion.</p></div><div class="detail-card"><span class="tiny-label">VIDÉOS</span><h3>Vidéos du club</h3><p>Les rencontres et les coulisses seront diffusées uniquement lorsqu'un contenu aura été publié.</p></div></div>`);}

function community(){return pageShell('Une communauté, des avantages','LA PASSION <em>ENSEMBLE.</em>','Un compte gratuit pour suivre le club. Deux formules premium pour aller plus loin.',`<div class="pricing-grid"><article class="pricing-card"><span class="tiny-label">SUPPORTER</span><h2>Gratuit</h2><p>Actualités publiques, suivi des équipes et réactions aux publications.</p><div class="chip">Compte bientôt disponible</div></article><article class="pricing-card featured"><span class="tiny-label">PREMIUM MENSUEL</span><div class="price">10 €<small> / mois</small></div><p>Sans engagement. Renouvellement mensuel résiliable en ligne.</p><div class="chip">Paiements non activés</div></article><article class="pricing-card"><span class="tiny-label">PREMIUM ANNUEL</span><div class="price">100 €<small> / 12 mois</small></div><p>Renouvellement manuel uniquement. Aucun prélèvement annuel automatique.</p><div class="chip">Paiements non activés</div></article></div><div class="info-banner"><span class="info-icon">i</span><div><strong>Avantages en préparation</strong><p>Contenus exclusifs, événements privilégiés, réductions configurables, avantages partenaires et votes aux Awards des Seniors A, B et C.</p></div></div>`);}
function events(){return pageShell('La vie associative','NOS <em>ÉVÉNEMENTS.</em>','Rencontres du club, événements ouverts au public et moments privilégiés pour les supporters.',`<div class="events-explainer"><article class="detail-card"><span class="tiny-label">ACCÈS PUBLIC</span><h2>Événements ouverts</h2><p>Réservation gratuite ou payante selon les modalités annoncées pour chaque événement.</p></article><article class="detail-card"><span class="tiny-label">PRIORITÉ PREMIUM</span><h2>Accès anticipé</h2><p>Certains événements proposeront une réservation prioritaire aux abonnés, avec réduction ou gratuité si prévue.</p></article><article class="detail-card"><span class="tiny-label">EXCLUSIF PREMIUM</span><h2>Moments réservés</h2><p>Des événements pourront être exclusivement accessibles aux abonnés Boissy-UJ Premium.</p></article></div><div class="empty-hero"><div class="empty-icon" aria-hidden="true">◇</div><h2>AUCUN ÉVÉNEMENT PUBLIÉ POUR LE MOMENT.</h2><p>Les premières dates et réservations seront affichées lorsque le club aura validé les informations et la billetterie.</p><a class="text-link" href="#/communaute">Découvrir la communauté ↗</a></div><div class="info-banner"><span class="info-icon">i</span><div><strong>Réservations désactivées en préversion</strong><p>Aucun billet ne peut être acheté, réservé ou payé avant validation du module et des conditions juridiques.</p></div></div>`);}
function support(){return pageShell('Ensemble, plus loin','SOUTENIR <em>BOISSY-UJ.</em>','Dons ponctuels, soutien mensuel et campagnes par projet : une future façon de contribuer au développement du club.',`<div class="detail-grid two"><article class="detail-card support-card"><span class="tiny-label">01 / SOUTIEN</span><h2>Fonds général</h2><p>Aider le club à financer ses activités associatives et sportives.</p><div class="chip">Ouverture des dons à venir</div></article><article class="detail-card support-card"><span class="tiny-label">02 / PROJETS</span><h2>Campagnes dédiées</h2><p>Participer à un projet identifié et consulter sa progression.</p><div class="chip">Campagnes à publier</div></article></div><div class="info-banner"><span class="info-icon">i</span><div><strong>Aucun paiement actif</strong><p>La collecte via Stripe sera accessible uniquement après validation de l’association, des conditions légales et des parcours de paiement.</p></div></div>`);}
function join(){return pageShell('Faire partie du club','NOUS <em>REJOINDRE.</em>','Les demandes de recrutement des joueurs seront examinées directement par les dirigeants de Boissy-UJ.',`<div class="detail-grid two"><article class="detail-card"><span class="tiny-label">JOUEURS</span><h2>Rejoindre une équipe</h2><p>Un formulaire simplifié permettra de choisir une catégorie et de communiquer ses coordonnées en toute sécurité.</p><div class="chip">Formulaire sécurisé en préparation</div></article><article class="detail-card"><span class="tiny-label">SUPPORTERS</span><h2>Suivre le club</h2><p>Un compte supporter permettra de suivre les actualités, les équipes et les événements.</p><a class="text-link" href="#/communaute">Découvrir la communauté ↗</a></article></div>`);}
function account(){return pageShell('Espace personnel','MON <em>ESPACE.</em>','Un seul compte, plusieurs rôles : supporter, licencié, éducateur ou administrateur. Inscription et connexion sécurisées via Supabase.',authMarkup());}
const routes={'/':home,'/matchs':matches,'/equipes':teamPage,'/actualites':news,'/communaute':community,'/evenements':events,'/soutenir':support,'/rejoindre':join,'/mon-espace':account};
let observer;
function render(){
  if(observer)observer.disconnect();
  let path=decodeURI(location.hash.replace(/^#/,''))||'/';
  if(!Object.hasOwn(routes,path))path='/';
  main.innerHTML=routes[path]();
  document.body.classList.toggle('on-home',path==='/');
  document.querySelectorAll('.desktop-links a,.bottom-nav a,.mobile-menu a').forEach(el=>{
    const active=el.getAttribute('href')===`#${path}`;
    if(active)el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
  });
  document.querySelectorAll('.bottom-nav a').forEach(el=>el.classList.toggle('active',el.getAttribute('href')===`#${path}`));
  closeMenu();
  window.scrollTo({top:0,behavior:'instant'});
  if(path==='/')setupChapters();
  if(path==='/mon-espace') void mountAuth(); else unmountAuth();
  if(path==='/matchs') void mountSport(); else unmountSport();
  if(path==='/actualites') void mountNews(); else unmountNews();
  document.title=(path==='/'?'Boissy-UJ — Club officiel':`Boissy-UJ — ${({ '/matchs':'Match Center','/equipes':'Nos équipes','/actualites':'Actualités','/communaute':'Communauté','/evenements':'Événements','/soutenir':'Soutenir le club','/rejoindre':'Nous rejoindre','/mon-espace':'Mon espace'})[path]}`);
}
function setupChapters(){
  const sections=[...document.querySelectorAll('.chapter')];
  const dots=[...document.querySelectorAll('.rail-dot')];
  const counter=$('.chapter-counter');
  observer=new IntersectionObserver(entries=>{
    const showing=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
    if(!showing)return;
    const index=sections.findIndex(s=>s===showing.target);
    if(index<0)return;
    dots.forEach((dot,i)=>{
      dot.classList.toggle('active',i===index);
      if(i===index)dot.setAttribute('aria-current','step');else dot.removeAttribute('aria-current');
    });
    counter.innerHTML=`${String(index+1).padStart(2,'0')} <span>/ 08</span>`;
  },{threshold:[0.25,0.5,0.75]});
  sections.forEach(section=>observer.observe(section));
}
function closeMenu(){const menu=$('#mobile-menu'),toggle=$('#menu-toggle');menu.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Ouvrir le menu');document.body.classList.remove('menu-open');}
$('#menu-toggle').addEventListener('click',()=>{const menu=$('#mobile-menu'),toggle=$('#menu-toggle');const open=menu.hidden;menu.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu');document.body.classList.toggle('menu-open',open);if(open)menu.querySelector('a')?.focus();});
$('#mobile-menu').addEventListener('click',e=>{if(e.target.closest('a'))closeMenu()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
main.addEventListener('click',e=>{const next=e.target.closest('[data-next]');const dot=e.target.closest('[data-chapter]');const target=next?.dataset.next??dot?.dataset.chapter;if(target)document.getElementById(target)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});});
window.addEventListener('hashchange',render);
render();
