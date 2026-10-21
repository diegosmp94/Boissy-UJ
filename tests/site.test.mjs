import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const text=file=>readFileSync(join(root,file),'utf8');
const app=text('app.js'),html=text('index.html'),css=text('styles.css');
test('base pages and assets exist',()=>{for(const p of ['index.html','app.js','styles.css','assets/ecusson-boissy-uj.webp','docs/MATRICE_RECETTE.md'])assert.ok(existsSync(join(root,p)),p)});
test('eight chapters are specified and rendered',()=>{for(const id of ['identite','bienvenue','competition','equipes','medias','communaute','soutenir','rejoindre'])assert.match(app,new RegExp("id:'"+id+"'"));assert.match(app,/chapter-identity/);assert.match(css,/\.chapter\s*\{/)});
test('four teams and league distinctions',()=>{for(const s of ['Seniors A','Seniors B','Seniors C','Vétérans','Départemental 3','Départemental 4','Matchs amicaux'])assert.ok(app.includes(s),s)});
test('correct premium pricing and non-renewing annual plan',()=>{assert.match(app,/10 €/);assert.match(app,/100 €/);assert.match(app,/sans renouvellement automatique|Aucun prélèvement annuel automatique/i)});
test('mobile navigation, accessible skip link and responsive layout',()=>{assert.match(html,/class="skip-link"/);assert.match(html,/bottom-nav/);assert.match(html,/aria-expanded="false"/);assert.match(css,/safe-area-inset-bottom/);assert.match(css,/prefers-reduced-motion/)});
test('no payments, passwords or fictitious results in preversion',()=>{assert.doesNotMatch(app+html,/sk_live_|pk_live_|type="password"|<form\b/i);assert.match(app,/Aucune rencontre publiée/);assert.match(app,/Aucun paiement actif/)});
test('weighted acceptance matrix totals 100',()=>{const doc=text('docs/MATRICE_RECETTE.md');const rows=doc.split('\n').filter(s=>/^\| .+ \|\s*\d+\s*\|/.test(s));const points=rows.map(r=>Number((r.match(/\|\s*(\d+)\s*\|/)||[])[1]||0));assert.equal(points.reduce((a,b)=>a+b,0),100);assert.match(doc,/85 %/)});

test('brief intro is accessible, skippable and respects reduced motion',()=>{assert.match(html,/id="cinema-intro"/);assert.match(html,/id="intro-skip"/);assert.match(app,/function initIntro\(/);assert.match(app,/prefers-reduced-motion/);assert.match(app,/sessionStorage/);assert.match(css,/@keyframes intro-reveal/)});

test('events route is linked and explicitly disables paid reservations in preview',()=>{assert.match(app,/function events\(\)/);assert.match(app,/'\/evenements':events/);assert.match(html,/href="#\/evenements"/);assert.match(app,/Billetterie non activée/)});
