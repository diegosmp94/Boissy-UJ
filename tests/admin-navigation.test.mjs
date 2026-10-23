import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ADMIN_GROUP_ORDER,normalizeAdminSearch,filterAdminModules,groupAdminModules,availableAdminModules} from '../admin-navigation.mjs';
import {ADMIN_MODULES} from '../admin-center.mjs';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const center=read('admin-center.mjs'),css=read('admin-console.css');

test('search finds actual modules by title, group and description without accents',()=>{
 assert.equal(normalizeAdminSearch('  ÉQUIPES  '),'equipes');
 assert.equal(normalizeAdminSearch(undefined),'');
 assert.deepEqual(filterAdminModules(ADMIN_MODULES,'actualités').map(x=>x.id),['news','news-revisions']);
 assert.deepEqual(filterAdminModules(ADMIN_MODULES,'MATCHS').map(x=>x.id),['matches']);
 assert.ok(filterAdminModules(ADMIN_MODULES,'pilotage').some(x=>x.id==='users'));
 assert.deepEqual(filterAdminModules(ADMIN_MODULES,'inexistant'),[]);
 assert.equal(filterAdminModules(ADMIN_MODULES,'').length,ADMIN_MODULES.length);
});

test('grouping preserves all actual modules, with fixed operational group priority',()=>{
 const groups=groupAdminModules(ADMIN_MODULES);
 assert.deepEqual(groups.map(x=>x.title),ADMIN_GROUP_ORDER);
 const ids=groups.flatMap(g=>g.items.map(m=>m.id));
 assert.equal(ids.length,ADMIN_MODULES.length);
 assert.equal(new Set(ids).size,ADMIN_MODULES.length);
 assert.deepEqual(groupAdminModules([{id:'custom',group:'Expérimental'}]).map(x=>x.title),['Expérimental']);
 assert.deepEqual(groupAdminModules([]),[]);
});

test('free events never appear in navigation if backend probe fails',()=>{
 const disabled=availableAdminModules(ADMIN_MODULES,{eventsReady:false,coachTeamsReady:true});
 const enabled=availableAdminModules(ADMIN_MODULES,{eventsReady:true,coachTeamsReady:true});
 assert.equal(disabled.some(m=>m.id==='events'),false);
 assert.equal(enabled.some(m=>m.id==='events'),true);
 assert.equal(disabled.some(m=>m.id==='matches'),true);
 assert.equal(enabled.length,disabled.length+1);
 assert.match(center,/const eventProbe=await api\.rpc\('admin_list_free_events'\)/);
 assert.match(center,/const eventsReady=!eventProbe\.error&&Array\.isArray\(eventProbe\.data\)/);
 assert.match(center,/const availableModules=availableAdminModules\(ADMIN_MODULES,\{eventsReady,coachTeamsReady,mediaReady,newsRevisionsReady\}\)/);
});

test('media administration is fail-closed until its AAL2 read RPC is installed',()=>{
 const ready=availableAdminModules(ADMIN_MODULES,{mediaReady:true});
 const missing=availableAdminModules(ADMIN_MODULES,{mediaReady:false});
 assert.equal(ready.some(m=>m.id==='news-media'),true);
 assert.equal(missing.some(m=>m.id==='news-media'),false);
 assert.equal(ready.length,missing.length+1);
 assert.match(center,/const mediaProbe=await api.rpc\('admin_list_news_media'\)/);
});

test('coach teams tools are fail-closed until their protected read RPC is deployed',()=>{
 const noMigrations=availableAdminModules(ADMIN_MODULES);
 assert.equal(noMigrations.some(m=>m.id==='coach-teams'),false);
 assert.equal(noMigrations.some(m=>m.id==='events'),false);
 const ready=availableAdminModules(ADMIN_MODULES,{eventsReady:true,coachTeamsReady:true});
 assert.equal(ready.some(m=>m.id==='coach-teams'),true);
 assert.equal(ready.some(m=>m.id==='events'),true);
 assert.match(center,/const probe=await api\.rpc\('admin_list_team_coaches',\{p_team_id:candidate\}\)/);
 assert.match(center,/coachTeamsReady=!probe\.error&&Array\.isArray\(probe\.data\)/);
});

test('admin sidebar is searchable and displays real grouped links only',()=>{
 assert.match(center,/moduleSearch\.type='search'/);
 assert.match(center,/moduleSearch\.addEventListener\('input',renderSidebar\)/);
 assert.match(center,/filterAdminModules\(availableModules,moduleSearch\.value\)/);
 assert.match(center,/groupAdminModules\(filtered\)/);
 assert.match(center,/moduleList\.replaceChildren\(\)/);
 assert.match(center,/navCount\.textContent=filtered\.length/);
 assert.match(center,/selectSection\(item\.id\)/);
 assert.doesNotMatch(center,/mountControlCenter\(|MODE PRÉVISUALISATION/);
});

test('quick actions route through the identical MFA-gated module transition',()=>{
 assert.match(center,/const shortcuts=\(\)=>availableModules\.filter/);
 assert.match(center,/case 'events':mountAdminFreeEvents\(view,api,verified\.userId\)/);
 assert.match(center,/const check=await adminSessionStatus\(api,verified\.userId\)/);
 assert.match(center,/if\(!canOpenAdmin\(check,supabaseConfig\.adminEnabled\)\)/);
 assert.match(center,/b\.addEventListener\('click',\(\)=>void selectSection\(module\.id\)\)/);
 assert.match(center,/view\.replaceChildren\(\)/);
 assert.match(center,/event==='SIGNED_OUT'/);
});

test('navigation remains usable on desktop and narrow phones',()=>{
 assert.match(css,/\.admin-nav-search:focus-visible/);
 assert.match(css,/\.admin-shortcut:focus-visible/);
 assert.match(css,/@media\(max-width:850px\)/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/overscroll-behavior:contain/);
 assert.match(css,/\.admin-nav-list/);
});

test('version history is invisible until backend is installed and MFA capability passes',()=>{
 const missing=availableAdminModules(ADMIN_MODULES,{newsRevisionsReady:false});
 const present=availableAdminModules(ADMIN_MODULES,{newsRevisionsReady:true});
 assert.equal(missing.some(m=>m.id==='news-revisions'),false);
 assert.equal(present.some(m=>m.id==='news-revisions'),true);
 assert.equal(present.length,missing.length+1);
 assert.match(center,/const revisionsProbe=await api.rpc\('admin_news_revisions_ready'\)/);
 assert.match(center,/newsRevisionsReady=!revisionsProbe.error&&revisionsProbe.data===true/);
 assert.match(center,/case 'news-revisions':void mountAdminNewsRevisions\(view,api,verified.userId\)/);
});
