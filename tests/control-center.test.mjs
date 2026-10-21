import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  CONTROL_MODULES, HOME_CHAPTERS,
  filterControlModules,moveHomeChapter,changeHomeVisibility
} from '../control-center.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('app.js');
const css=read('styles.css');
const moduleCode=read('control-center.mjs');
const config=read('auth-config.mjs');

test('ten validated management modules form the Control Center',()=>{
  assert.equal(CONTROL_MODULES.length,10);
  assert.equal(new Set(CONTROL_MODULES.map(x=>x.id)).size,10);
  for(const id of ['overview','members','teams','matches','media','premium','events','finances','appearance','security']){
    assert.ok(CONTROL_MODULES.some(m=>m.id===id),'missing '+id);
  }
});
test('home editor contains all eight canonical sections',()=>{
  assert.deepEqual(HOME_CHAPTERS.map(x=>x.id),
    ['identite','bienvenue','competition','equipes','medias','communaute','soutenir','rejoindre']);
  assert.ok(HOME_CHAPTERS.every(x=>x.visible===true));
});
test('local rearrangement is safe and does not mutate originals',()=>{
  const original=HOME_CHAPTERS.map(x=>({...x}));
  const moved=moveHomeChapter(original,'medias',-1);
  assert.equal(moved[3].id,'medias');
  assert.equal(moved[4].id,'equipes');
  assert.equal(original[3].id,'equipes');
  assert.notStrictEqual(moved[0],original[0]);
  assert.deepEqual(moveHomeChapter(original,'identite',-1).map(x=>x.id),
    original.map(x=>x.id));
  assert.deepEqual(moveHomeChapter(original,'rejoindre',1).map(x=>x.id),
    original.map(x=>x.id));
});
test('section visibility toggles only selected section; no server storage',()=>{
  const changed=changeHomeVisibility(HOME_CHAPTERS,'soutenir',false);
  assert.equal(changed.find(x=>x.id==='soutenir').visible,false);
  assert.equal(HOME_CHAPTERS.find(x=>x.id==='soutenir').visible,true);
  assert.equal(changed.filter(x=>x.visible).length,7);
});
test('module search is accent-insensitive and scoped by group',()=>{
  assert.deepEqual(filterControlModules(CONTROL_MODULES,'équipes').map(x=>x.id),
    ['teams','matches']); // team mentions in match description
  assert.deepEqual(filterControlModules(CONTROL_MODULES,'','Sport').map(x=>x.id),
    ['teams','matches']);
  assert.equal(filterControlModules(CONTROL_MODULES,'zzz not found').length,0);
});
test('route is exposed through Mon espace, not the public navigation',()=>{
  assert.match(app,/import \{controlCenterMarkup,mountControlCenter,unmountControlCenter\} from '\.\/control-center\.mjs'/);
  assert.match(app,/'\/control-center':controlCenter/);
  assert.match(app,/href="#\/control-center"/);
  assert.match(app,/if\(path==='\/control-center'\) mountControlCenter\(\); else unmountControlCenter\(\);/);
});
test('the admin preview has no actual admin access, private reads or writes',()=>{
  assert.match(moduleCode,/MODE PRÉVISUALISATION — AUCUN ACCÈS ADMINISTRATEUR/);
  assert.match(moduleCode,/sans données personnelles/);
  assert.match(moduleCode,/Les changements sont temporaires, non sauvegardés/);
  assert.doesNotMatch(moduleCode,
    /\.from\(|\.rpc\(|fetch\(|localStorage|sessionStorage|service_role|sb_secret_|\.insert\(|\.update\(|\.delete\(/);
  assert.match(config,/enabled:\s*false/);
});
test('mobile and keyboard support are present',()=>{
  assert.match(css,/\.cc-layout\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(css,/\.cc-root button:focus-visible/);
  assert.match(css,/\.cc-editor-actions/);
  assert.match(moduleCode,/setAttribute\('aria-label'/);
});
