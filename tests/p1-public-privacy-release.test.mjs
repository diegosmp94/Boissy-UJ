import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const html=read('index.html'),app=read('app.js'),css=read('styles.css');
const release=read('scripts/build-preview.mjs');
const audit=read('scripts/audit-preview.mjs');

test('P1 identity: eight original cinematic chapters and premium identity remain',()=>{
 for(const chapter of ['identite','bienvenue','competition','equipes','medias','communaute','soutenir','rejoindre']){
  assert.match(app,new RegExp("id:'"+chapter+"'"));
 }
 assert.match(app,/class="chapter chapter-identity"/);
 assert.match(app,/chapter-counter/);
 assert.match(css,/--navy:#071b38/);
 assert.match(html,/id="intro-skip"/);
});
test('P1 navigation: futsal team is Senior while category and URL stay distinct',()=>{
 assert.match(html,/<section aria-label="Futsal">/);
 assert.match(html,/href="#\/equipes\/futsal\/boissy-uj-futsal">Senior <small>D2<\/small>/);
 assert.match(html,/href="#\/equipes\/futsal\/boissy-uj-futsal">Senior · D2/);
 assert.doesNotMatch(html,/Boissy-UJ Futsal/);
 assert.match(read('club-teams.mjs'),/name:'Senior',division:'Départemental 2',discipline:'futsal'/);
});
test('P1 privacy information is accessible without authentication on all routes',()=>{
 assert.match(html,/href="#\/confidentialite">Confidentialité et données personnelles/);
 assert.match(html,/href="#\/mentions-legales">Mentions légales/);
 assert.match(app,/function privacy\(\)/);
 assert.match(app,/function legal\(\)/);
 assert.match(app,/'\/confidentialite':privacy,'\/mentions-legales':legal/);
 assert.match(app,/Lire la politique de confidentialité/);
 assert.match(app,/Aucun outil de suivi publicitaire n'est intégré au code actuel/);
});
test('P1 legal copy does not invent an RNA, address, DPO, or claim full compliance',()=>{
 assert.match(app,/Mentions légales provisoires/);
 assert.match(app,/coordonnées du responsable de traitement/);
 assert.match(app,/jsDelivr pour charger la bibliothèque d'authentification/);
 assert.match(app,/responsable sera affiché dès confirmation/);
 assert.match(app,/Validation juridique à compléter/);
 assert.doesNotMatch(app,/(conformité RGPD certifiée|100 % conforme RGPD|SIREN\s*:\s*\d{9})/i);
});
test('P1 initial preview stays out of search results until club legal sign-off',()=>{
 assert.match(html,/name="robots" content="noindex, nofollow"/);
 assert.match(html,/name="referrer" content="no-referrer"/);
 assert.match(html,/property="og:description"/);
 assert.match(html,/rel="preload" href="\.\/assets\/ecusson-boissy-uj\.webp"/);
 assert.match(release,/LOCKED_ROBOTS_TEXT/);
});
test('P1 keyboard navigation and reduced motion are respected',()=>{
 assert.match(html,/class="skip-link" href="#main"/);
 assert.match(html,/id="main" tabindex="-1"/);
 assert.match(app,/hasRenderedRoute\)main\.focus\(\{preventScroll:true\}\)/);
 assert.match(app,/section\.tabIndex=-1;section\.focus\(\{preventScroll:true\}\)/);
 assert.match(app,/prefers-reduced-motion: reduce/);
 assert.match(css,/max-height:calc\(100dvh - 76px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('P1 privacy UI is mobile-first and keyboard accessible',()=>{
 assert.match(css,/\.global-legal-footer nav/);
 assert.match(css,/\.trust-page section/);
 assert.match(css,/\.trust-auth-notice/);
 assert.match(css,/@media\(max-width:530px\)/);
 assert.match(css,/\.mobile-menu a,\.mobile-menu summary\{min-height:44px/);
});
test('P1 release bundle copies client root JS CSS HTML modules and excludes private directories',()=>{
 assert.match(release,/readdir\(project,\{withFileTypes:true\}\)/);
 assert.match(release,/new Set\(\['\.html','\.js','\.mjs','\.css'\]\)/);
 assert.match(release,/entry\.isFile\(\)/);
 assert.match(release,/cp\(join\(project,'assets'\),join\(dist,'assets'\)/);
 assert.match(audit,/Internal resource leaked/);
 assert.match(audit,/Unresolved import/);
 assert.match(audit,/Private credential marker/);
 assert.match(audit,/name="robots" content="noindex, nofollow"/);
});
test('P1 deployment CI runs real release preflight in both workflows',()=>{
 assert.match(read('.github/workflows/tests.yml'),/npm run audit:preview/);
 assert.match(read('.github/workflows/quality.yml'),/npm run audit:preview/);
 const p=JSON.parse(read('package.json'));
 assert.equal(p.scripts['audit:preview'],'node scripts/audit-preview.mjs');
 assert.match(p.scripts['release:check'],/npm run build:preview && npm run audit:preview/);
});
