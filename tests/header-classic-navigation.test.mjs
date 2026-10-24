import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=src('index.html'),app=src('app.js'),css=src('header-navigation.css'),
 sport=src('sport-center.mjs'),smoke=src('scripts/browser-smoke.mjs');
const desktop=html.slice(html.indexOf('    <nav class="desktop-links"'),html.indexOf('    <div class="header-actions">'));
const mobile=html.slice(html.indexOf('  <nav class="mobile-menu"'),html.indexOf('  <main id="main"'));

test('classic navigation has four top-level options and keeps My Space separate',()=>{
 const top=desktop.match(/class="desktop-header-group"/g)||[];
 assert.equal(top.length,2,'competitions and club have their own dropdowns');
 assert.match(desktop,/class="desktop-team-nav desktop-header-group"/);
 assert.match(desktop,/href="#\/">Accueil<\/a>/);
 assert.match(desktop,/>Équipes <span/);
 assert.match(desktop,/>Compétitions <span/);
 assert.match(desktop,/>Vie du club <span/);
 assert.doesNotMatch(desktop,/>Matchs<\/a>|>Awards<\/a>\s*<a/);
 assert.match(html,/class="header-account" href="#\/mon-espace"/);
 for(const id of ['desktop-teams','desktop-competitions','desktop-club']){
  assert.match(desktop,new RegExp('id="'+id+'-trigger" aria-controls="'+id+'-submenu" aria-expanded="false"'));
  assert.match(desktop,new RegExp('id="'+id+'-submenu"[^>]*hidden'));
 }
});

test('all previously reachable public pages remain present in a correct submenu',()=>{
 const links=[
  '#/equipes','#/equipes/football','#/equipes/football/seniors-a',
  '#/equipes/football/seniors-b','#/equipes/football/seniors-c',
  '#/equipes/football/veterans','#/equipes/futsal',
  '#/equipes/futsal/boissy-uj-futsal',
  '#/matchs','#/matchs?competition=league','#/matchs?competition=cup',
  '#/matchs?section=classements','#/agenda',
  '#/actualites','#/evenements','#/awards','#/communaute',
  '#/club','#/rejoindre','#/soutenir','#/infos-pratiques'
 ];
 for(const href of links){
  assert.ok(desktop.includes('href="'+href+'"'),href+' missing from desktop');
  assert.ok(mobile.includes('href="'+href+'"'),href+' missing from mobile');
 }
 assert.equal((mobile.match(/<details class="mobile-teams mobile-header-group">/g)||[]).length,2);
 assert.equal((mobile.match(/<details class="mobile-team-discipline">/g)||[]).length,2);
 assert.match(mobile,/<summary>Équipes/);
 assert.match(mobile,/<summary>Compétitions/);
 assert.match(mobile,/<summary>Vie du club/);
 assert.match(mobile,/href="#\/mon-espace">Mon espace/);
 assert.match(html,/href="\.\/header-navigation\.css"/);
});

test('three desktop menus coordinate pointer, click, keyboard, Escape and active route',()=>{
 assert.match(app,/const desktopHeaderGroups=\[\.\.\.document\.querySelectorAll\('\.desktop-header-group'\)\]/);
 assert.match(app,/function openDesktopMenu\(group\)/);
 assert.match(app,/function closeDesktopMenus\(\{except=null,returnFocus=false\}=\{\}\)/);
 assert.match(app,/event\.pointerType==='mouse'\|\|event\.pointerType==='pen'/);
 assert.match(app,/event\.key!=='ArrowDown'/);
 assert.match(app,/if\(event\.target\.closest\('a'\)\)closeDesktopMenus\(\)/);
 assert.match(app,/closeDesktopMenus\(\{returnFocus:true\}\)/);
 assert.match(app,/suppressDesktopHeaderFocusOpen=true/);
 assert.match(app,/menu\.querySelectorAll\('details\[open\]'\)/);
 assert.match(app,/'desktop-competitions-nav':path==='\/matchs'\|\|path==='\/agenda'/);
 assert.match(app,/'desktop-club-nav':\['\/actualites'/);
 assert.doesNotMatch(app,/window\.open\(|href='https:/);
});

test('Championship, Cup and Standings shortcuts go to actual existing sections',()=>{
 assert.match(app,/sportQuery\?\.get\('competition'\)==='cup'\?'cup':'league'/);
 assert.match(app,/mountSport\(route\.teamCode,\{competition\}\)/);
 assert.match(sport,/initialCompetition='league'/);
 assert.match(sport,/defaultKind:activeCompetition/);
 assert.match(sport,/initialCompetition:competition/);
 assert.match(app,/sportQuery\?\.get\('section'\)==='classements'/);
 assert.match(app,/getElementById\('team-league-standing'\)/);
 assert.match(css,/#team-league-standing\{scroll-margin-top:102px\}/);
 assert.doesNotMatch(html,/#\/classements|#\/coupe|#\/championnat/);
});

test('mobile and desktop keep accessible reduced-motion-safe styling and real browser checks',()=>{
 assert.match(css,/\.desktop-header-panel\[hidden\]\{display:none!important\}/);
 assert.match(css,/\.header-group-trigger:focus-visible/);
 assert.match(css,/\.mobile-classic-menu/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(smoke,/name:'desktop-classic-header'/);
 assert.match(smoke,/Classic header must have three navigation groups/);
 assert.match(smoke,/Mobile header should group teams, competitions and club/);
 assert.match(smoke,/Header dropdown did not close/);
 assert.match(smoke,/Mobile accordion remained open after closing menu/);
});
