Warning: truncated output (original token count: 10670)
Total output lines: 347

import {mountEvents,unmountEvents} from './events-center.mjs';
import {CLUB_TEAMS,DISCIPLINES,teamsByDiscipline,teamRoute,categoryRoute,disciplineLabel} from './club-teams.mjs';
import {mountTeamProfile,unmountTeamProfile} from './team-pages.mjs';
import {mountTeamPublicExtras,unmountTeamPublicExtras} from './team-profile-data.mjs';
import {mountAwards,unmountAwards} from './awards-center.mjs';
import {mountJoin,unmountJoin,mountPractical,unmountPractical} from './join-center.mjs';
import {mountIdentity,unmountIdentity} from './club-identity.mjs';
import {mountAgenda,unmountAgenda} from './agenda.mjs';
import {mountNews,unmountNews} from './media-center.mjs';
import {mountSport,unmountSport} from './sport-center.mjs';
import {teamDeepLink,parsePublicRoute} from './team-links.mjs';
import {mountTeamStats,unmountTeamStats} from './team-stats.mjs';
import {mountHomeVictory,unmountHomeVictory} from './victory-home.mjs';
import {mountHomeNextMatch,unmountHomeNextMatch} from './home-next-match.mjs';
import {mountLeagueStandings,unmountLeagueStandings} from './league-standings.mjs';
import {adminCenterMarkup,mountAdminCenter,unmountAdminCenter} from './admin-center.mjs';
import {authMarkup,mountAuth,unmountAuth,getAuthClient} from './auth.mjs';
import {hasAuthCallback} from './auth-flow.mjs';
// GitHub Pages emploie un hash router, Supabase renvoie le code PKCE en query.
// Conserver la query jusqu’à son échange par le client auth.
if(hasAuthCallback(window.location.search)&&window.location.hash!=='#/mon-espace'){
  const target=new URL(window.location.href);
  target.hash='#/mon-espace';
  window.history.replaceState(null,'',target.toString());
}
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
    if(document.activeElement===skip)document.getElementById('main')?.focus({preventScroll:true});
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
const teams=CLUB_TEAMS.map(t=>({
  ...t,league:t.division,desc:t.description,
  source:t.source==='FFF'?'FFF · données à connecter':'Calendrier géré par le club'
}));
const footballTeams=teamsByDiscipline('football',teams);
const futsalTeams=teamsByDiscipline('futsal',teams);
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
const teamCard = (team,index) => `<article class="team-card"><span class="team-index">0${index+1} / 04</span><div class="team-symbol" aria-hidden="true"><img src="${crest}" alt="" loading="lazy" /></div><div><span class="tiny-label">${team.tag}</span><h3>${team.name}</h3><p>${team.league}</p></div><a class="text-link" href="${teamRoute(team)}" aria-label="Découvrir ${team.name}">Découvrir <span aria-hidden="true">↗</span></a></article>`;

function home(){return `
  <div class="chapters">
    <section class="chapter chapter-identity" id="identite" aria-labelledby="identity-title">
      <div class="orb orb-a"></div><div class="orb orb-b"></div><div class="pitch-lines" aria-hidden="true"></div>
      <div class="hero-content">
        ${tag('Boissy-UJ · Union Jeunes')}
        <div class="crest-halo"><img class="hero-crest" src="${crest}" alt="Écusson officiel de Boissy-UJ" width="170" height="170" /></div>
        <h1 id="identity-title">PLUS QU’UN CLUB.<br/><em>UNE IDENTITÉ.</em></h1>
        <p>Le football à 11, le futsal et l’esprit d’équipe réunis sous les mêmes couleurs.</p>
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
      <div class="section-copy"><span class="chapter-no">03 / 08</span>${tag('Le football au centre')}<h2 id="competition-title">CHAQUE MATCH<br/><em>COMPTE.</em></h2><p>Retrouvez les rencontres et les résultats officiels lorsqu’ils seront disponibles, ainsi que les statistiques du club.</p>${link('#/matchs','Ouvrir le Match Center','btn-primary')}${link('#/agenda','Agenda du club','btn-ghost')}<div id="home-victory-banner" class="home-victory-banner" aria-live="polite"></div></div>
      <div class="score-panel home-next-match-panel" id="home-next-match" aria-live="polite" aria-label="Prochain match de Boissy UJ"><div class="panel-heading"><span class="live-dot"></span> PROCHAIN MATCH</div><p class="home-next-empty">Chargement du prochain match du club…</p></div>
      ${arrow('equipes')}
    </section>
    <section class="chapter chapter-teams" id="equipes" aria-labelledby="teams-title"><div class="section-heading"><div><span class="chapter-no">04 / 08</span>${tag('Nos couleurs, nos équipes')}<h2 id="teams-title">CINQ ÉQUIPES.<br/><em>DEUX DISCIPLINES.</em></h2></div>${link('#/equipes','Toutes les équipes','btn-outline')}</div><p class="discipline-home-label">FOOTBALL À 11 · 4 ÉQUIPES</p><div class="teams-grid">${footballTeams.map(teamCard).join('')}</div>
    <a class="futsal-home-link" href="${teamRoute(futsalTeams[0])}"><span class="tiny-label">FUTSAL · DÉPARTEMENTAL 2</span><strong>SENIOR</strong><span>Découvrir la cinquième équipe ↗</span></a>${arrow('medias')}</section>
    <section class="chapter chapter-media" id="medias" aria-labelledby="media-title"><div class="section-copy"><span class="chapter-no">05 / 08</span>${tag('Le club en images')}<h2 id="media-title">DES MOMENTS<br/><em>À PARTAGER.</em></h2><p>Actualités, albums photos et vidéos : les coulisses et les temps forts de Boissy-UJ se retrouveront ici.</p>${link('#/actualites','Explorer les actualités','btn-primary')}</div><div class="media-art" aria-label="Espace réservé aux futures photographies officielles"><div class="media-art-inner"><span class="media-play" aria-hidden="true">▶</span><strong>BOISSY<span>UJ</span></strong><small>VOS HISTOIRES. NOS COULEURS.</small></div></div>${arrow('communaute')}</section>
    <section class="chapter chapter-community" id="communaute" aria-labelledby="community-title"><div class="section-copy"><span class="chapter-no">06 / 08</span>${tag('L’expérience supporters')}<h2 id="community-title">VIVEZ LE CLUB<br/><em>AU PLUS PRÈS.</em></h2><p>Accédez à des contenus exclusifs, aux votes des Awards et à des événements privilégiés avec Boissy-UJ Premium.</p>${link('#/communaute','Découvrir Premium','btn-primary')}${link('#/awards','Les Awards','btn-ghost')}</div><div class="premium-teaser"><span class="premium-star" aria-hidden="true">✦</span><div class="tiny-label">BOISSY-UJ PREMIUM</div><strong>10 €<small> / mois</small></strong><span class="premium-separator"></span><p>Ou 100 € pour 12 mois, sans renouvellement automatique.</p><div class="premium-footer">CONTENUS · ÉVÉNEMENTS · AWARDS</div></div>${arrow('soutenir')}</section>
    <section class="chapter chapter-support" id="soutenir" aria-labelledby="support-title"><div class="section-copy"><span class="chapter-no">07 / 08</span>${tag('Construisons la suite')}<h2 id="support-title">SOUTENIR<br/><em>NOTRE AVENIR.</em></h2><p>À travers les dons et les campagnes de financement, chaque soutien contribue aux projets du club.</p>${link('#/soutenir','Découvrir nos projets','btn-outline')}</div><div class="support-orbit" aria-hidden="true"><div class="support-orbit-mid"><img src="${crest}" alt="" /></div></div>${arrow('rejoindre')}</section>
    <section class="chapter chapter-join" id="rejoindre" aria-labelledby="join-title"><img class="join-watermark" src="${crest}" alt="" aria-hidden="true" /><div class="join-inner"><span class="chapter-no">08 / 08</span>${tag('La prochaine histoire commence ici')}<h2 id="join-title">ET SI C’ÉTAIT<br/><em>VOUS ?</em></h2><p>Joueurs, éducateurs, partenaires ou passionnés : votre place dans l’aventure Boissy-UJ est peut-être ici.</p><div class="hero-ctas">${link('#/rejoindre','Nous rejoindre','btn-primary')}${link('#/mon-espace','Mon espace','btn-ghost')}</div></div><footer class="site-footer">© Boissy-UJ · Association Boissy Union Jeunes <span>Site en construction · Informations légales à compléter</span></footer></section>
  </div><aside class="chapter-rail" aria-label="Navigation par chapitres">${chapters.map((c,i)=>`<button type="button" class="rail-dot" data-chapter="${c.id}" aria-label="Chapitre ${i+1} : ${c.name}" title="${c.name}"></button>`).join('')}</aside><div class="chapter-counter" aria-live="off">01 <span>/ 08</span></div>`;}

function pageShell(overline,title,description,body){return `<div class="page-shell"><div class="page-ambient"></div><div class="page-intro">${tag(overline)}<h1>${title}</h1><p>${description}</p></div><div class="page-body">${body}</div><footer class="simple-footer"><span>© Boissy-UJ — Site officiel en préparation</span><a href="#/club">Notre club ↗</a><a href="#/">Retour à l’accueil ↗</a></footer></div>`;}
function matches(){return pageShell('Le terrain avant tout','MATCH <em>CENTER.</em>','Calendriers et résultats publiés des cinq équipes, distinguées entre football à 11 et futsal.',`<div class="info-banner"><span class="info-icon">i</span><div><strong>Données officielles FFF en cours de vérification</strong><p>Les rencontres apparaissent uniquement après publication. Le club peut également renseigner manuellement ses rencontres. Aucun score n’est inventé.</p></div></div><div id="match-center-live" class="sport-root" aria-live="polite"><p class="sport-loading">Aucune rencontre publiée pour le moment — chargement du calendrier…</p></div><div class="subhead"><h2>Statistiques collectives</h2><span>RÉSULTATS PUBLIÉS UNIQUEMENT</span></div><div id="team-form-public" class="sport-team-form" aria-live="polite"><p class="sport-loading">Chargement des bilans…</p></div><div class="subhead"><h2>Classements par championnat</h2><span>MISE À JOUR APRÈS CHAQUE JOURNÉE PAR…4670 tokens truncated… publiés ↗</a></section>
    <p class="trust-review-date">Page de transparence technique · Révision du 22 octobre 2026 · Validation juridique à compléter.</p>
   </div>`);
}
function legal(){
 return pageShell('Informations de l’éditeur','MENTIONS <em>LÉGALES.</em>',
  'Informations sur l’éditeur du site et ses services techniques.',
  `<div class="trust-page" aria-label="Mentions légales du site">
    <aside class="trust-alert" role="note"><strong>Mentions légales provisoires</strong><p>Ce document est une préparation à compléter par les représentants de l'association : l'identité légale définitive, le siège, les numéros administratifs et la direction de publication ne sont pas encore vérifiés.</p></aside>
    <section><h2>Éditeur</h2><p>Site du club Boissy-UJ, association sportive. La dénomination juridique complète, le siège social, le numéro RNA ou SIREN lorsqu'applicable, le responsable de la publication et le moyen de contact officiel restent à confirmer.</p></section>
    <section><h2>Hébergement technique</h2><p>Les pages publiques sont servies via GitHub Pages. L'authentification et les données applicatives reposent sur Supabase. Les informations contractuelles complètes des prestataires et le cas échéant de leurs sous-traitants devront figurer dans la version juridique approuvée.</p></section>
    <section><h2>Contenus et droits</h2><p>Les noms, l'écusson et les créations du site sont destinés à la présentation du club. Les crédits et autorisations de reproduction de chaque photo, vidéo ou document publié doivent être vérifiés avant diffusion. Les statistiques sportives ne sont présentées comme officielles FFF qu'après validation de leurs sources et des droits associés.</p></section>
    <section><h2>Services et paiements</h2><p>Le site propose actuellement des informations sur les offres de soutien, les événements et Premium. Aucun encaissement en ligne n'est activé dans cette préversion. Les conditions de vente et la politique commerciale devront être validées avant toute mise en service financière.</p></section>
    <section><h2>Données personnelles</h2><p>Les informations liées à l'utilisation des comptes sont détaillées sur la page de confidentialité.</p><a class="trust-link" href="#/confidentialite">Consulter la confidentialité ↗</a></section>
    <p class="trust-review-date">Projet de mentions légales · Révision du 22 octobre 2026 · Validation de l'association requise.</p>
   </div>`);
}

function account(){return pageShell('Espace personnel','MON <em>ESPACE.</em>','Un seul compte, plusieurs rôles : supporter, licencié, éducateur ou administrateur. Inscription et connexion sécurisées via Supabase.',`<div class="trust-auth-notice"><strong>Protection des données</strong><p>Les informations saisies servent à gérer ton compte et les fonctionnalités du club. Consulte les finalités, les prestataires et les droits applicables avant de t’inscrire.</p><a href="#/confidentialite">Lire la politique de confidentialité ↗</a></div>`+authMarkup()+`<div class="cc-entry-link"><span class="tiny-label">ADMINISTRATION PROTÉGÉE</span><h2>Centre de gestion Boissy-UJ</h2><p>Ce panneau est réservé aux administrateurs habilités et nécessite la double authentification MFA AAL2. Les autres comptes n’y ont pas accès.</p><a class="btn btn-outline" href="#/control-center">Ouvrir le Centre de gestion <span aria-hidden="true">↗</span></a></div>`);}
function controlCenter(){return adminCenterMarkup();}
const teamRoutes=Object.fromEntries([
  ...DISCIPLINES.map(d=>[categoryRoute(d.id).slice(1),()=>categoryTeamPage(d.id)]),
  ...teams.map(t=>[teamRoute(t).slice(1),()=>singleTeamPage(t)])
]);
const routes={'/':home,'/matchs':matches,'/equipes':teamPage,'/actualites':news,'/communaute':community,'/awards':awards,'/evenements':events,'/agenda':agenda,'/soutenir':support,'/rejoindre':join,'/infos-pratiques':practical,'/club':identity,'/mon-espace':account,'/control-center':controlCenter,'/confidentialite':privacy,'/mentions-legales':legal,...teamRoutes};
let observer;
let hasRenderedRoute=false;
function render(){
  if(observer)observer.disconnect();
  const route=parsePublicRoute(location.hash);
  let path=route.path;
  if(!Object.hasOwn(routes,path))path='/';
  main.innerHTML=routes[path]();
  document.body.classList.toggle('on-home',path==='/');
  document.querySelectorAll('.desktop-links a,.bottom-nav a,.mobile-menu a').forEach(el=>{
    const active=el.getAttribute('href')===`#${path}`;
    if(active)el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
  });
  document.querySelectorAll('.bottom-nav a').forEach(el=>el.classList.toggle('active',el.getAttribute('href')===`#${path}`||(el.dataset.nav==='equipes'&&path.startsWith('/equipes/'))));
  const teamsMainLink=$('#desktop-teams-trigger');
  if(path==='/equipes')teamsMainLink?.setAttribute('aria-current','page');
  else teamsMainLink?.removeAttribute('aria-current');
  const desktopTeamsNav=$('#desktop-team-nav');
  if(desktopTeamsNav)desktopTeamsNav.dataset.sectionActive=String(path==='/equipes'||path.startsWith('/equipes/'));
  closeMenu();
  closeDesktopTeams();
  window.scrollTo({top:0,behavior:'instant'});
  if(hasRenderedRoute)main.focus({preventScroll:true});
  hasRenderedRoute=true;
  if(path==='/')setupChapters();
  if(path==='/mon-espace') void mountAuth(); else unmountAuth();
  if(path==='/matchs') void mountSport(route.teamCode); else unmountSport();
  if(path==='/') void mountHomeVictory(); else unmountHomeVictory();
  if(path==='/') mountHomeNextMatch(); else unmountHomeNextMatch();
  const activeTeam=teams.find(t=>teamRoute(t).slice(1)===path);
  if(activeTeam){void mountTeamProfile(activeTeam.code);void mountTeamPublicExtras(activeTeam.code);}
  else {unmountTeamProfile();unmountTeamPublicExtras();}
  if(path==='/matchs') void mountTeamStats(); else unmountTeamStats();
  if(path==='/matchs') void mountLeagueStandings(route.teamCode);
  else if(activeTeam) void mountLeagueStandings(activeTeam.code);
  else unmountLeagueStandings();
  if(path==='/actualites') void mountNews(route.teamCode); else unmountNews();
  if(path==='/evenements') void mountEvents(); else unmountEvents();
  if(path==='/agenda') void mountAgenda(); else unmountAgenda();
  if(path==='/awards') void mountAwards(); else unmountAwards();
  if(path==='/rejoindre') void mountJoin(); else unmountJoin();
  if(path==='/infos-pratiques') void mountPractical(); else unmountPractical();
  
  if(path==='/club') void mountIdentity(); else unmountIdentity();
  if(path==='/control-center') void mountAdminCenter(getAuthClient); else unmountAdminCenter();
  document.title=(path==='/'?'Boissy-UJ — Club officiel':`Boissy-UJ — ${({ '/matchs':'Match Center','/equipes':'Nos équipes','/actualites':'Actualités','/communaute':'Communauté','/awards':'Awards','/evenements':'Événements','/agenda':'Agenda','/soutenir':'Soutenir le club','/rejoindre':'Nous rejoindre','/infos-pratiques':'Infos pratiques','/club':'Notre club','/mon-espace':'Mon espace','/control-center':'Administration sécurisée','/confidentialite':'Confidentialité','/mentions-legales':'Mentions légales',...Object.fromEntries(DISCIPLINES.map(d=>[categoryRoute(d.id).slice(1),disciplineLabel(d.id)])),...Object.fromEntries(teams.map(t=>[teamRoute(t).slice(1),t.name]))})[path]}`);
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
const desktopTeamNav=$('#desktop-team-nav');
const desktopTeamsTrigger=$('#desktop-teams-trigger');
const desktopTeamsPanel=$('#desktop-teams-submenu');
let suppressDesktopFocusOpen=false;
function openDesktopTeams(){
  if(!desktopTeamsPanel||!desktopTeamsTrigger)return;
  desktopTeamsPanel.hidden=false;
  desktopTeamsTrigger.setAttribute('aria-expanded','true');
  desktopTeamNav.dataset.open='true';
}
function closeDesktopTeams({returnFocus=false}={}){
  if(!desktopTeamsPanel||!desktopTeamsTrigger)return;
  desktopTeamsPanel.hidden=true;
  desktopTeamsTrigger.setAttribute('aria-expanded','false');
  desktopTeamNav.dataset.open='false';
  if(returnFocus){
    suppressDesktopFocusOpen=true;
    desktopTeamsTrigger.focus();
    suppressDesktopFocusOpen=false;
  }
}
// Le pointeur ouvre le menu sans clic ; le focus clavier offre le même accès.
desktopTeamNav?.addEventListener('pointerenter',event=>{
  if(event.pointerType==='mouse'||event.pointerType==='pen')openDesktopTeams();
});
desktopTeamNav?.addEventListener('pointerleave',event=>{
  if(event.pointerType==='mouse'||event.pointerType==='pen')closeDesktopTeams();
});
desktopTeamNav?.addEventListener('focusin',()=>{
  if(!suppressDesktopFocusOpen)openDesktopTeams();
});
desktopTeamNav?.addEventListener('focusout',event=>{
  if(!desktopTeamNav.contains(event.relatedTarget))closeDesktopTeams();
});
desktopTeamNav?.addEventListener('click',event=>{
  if(event.target.closest('a'))closeDesktopTeams();
});
document.addEventListener('pointerdown',event=>{
  if(!desktopTeamNav?.contains(event.target))closeDesktopTeams();
});
function closeMenu({returnFocus=false}={}){const menu=$('#mobile-menu'),toggle=$('#menu-toggle');const wasOpen=!menu.hidden;menu.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Ouvrir le menu');document.body.classList.remove('menu-open');if(returnFocus&&wasOpen)toggle.focus();}
$('#menu-toggle').addEventListener('click',()=>{const menu=$('#mobile-menu'),toggle=$('#menu-toggle');const open=menu.hidden;menu.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu');document.body.classList.toggle('menu-open',open);if(open)menu.querySelector('a')?.focus();});
$('#mobile-menu').addEventListener('click',e=>{if(e.target.closest('a'))closeMenu()});
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  closeMenu({returnFocus:true});
  const wasOpen=desktopTeamsPanel&&!desktopTeamsPanel.hidden;
  const focusedInside=desktopTeamNav?.contains(document.activeElement);
  closeDesktopTeams({returnFocus:Boolean(wasOpen&&focusedInside)});
});
main.addEventListener('click',e=>{const discipline=e.target.closest('[data-discipline-target]');if(discipline){document.getElementById(discipline.dataset.disciplineTarget)?.scrollIntoView({behavior:'smooth',block:'start'});return;}const next=e.target.closest('[data-next]');const dot=e.target.closest('[data-chapter]');const target=next?.dataset.next??dot?.dataset.chapter;if(target){const section=document.getElementById(target);section?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});if(section){section.tabIndex=-1;section.focus({preventScroll:true});}}});
// Le routeur GitHub Pages utilise #/route : un lien #main déclencherait une
// navigation vers une route invalide et ferait perdre la page courante.
// Intercepter uniquement le lien d'évitement, sans changer le hash.
document.querySelector('.skip-link')?.addEventListener('click',event=>{
  event.preventDefault();
  main.scrollIntoView({block:'start',behavior:'instant'});
  main.focus({preventScroll:true});
});
window.addEventListener('hashchange',render);
render();
