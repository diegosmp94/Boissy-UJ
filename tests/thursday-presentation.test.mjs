import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parsePublicCount,probePublicCatalogues,PUBLIC_CATALOGUES,SHOWCASE_MODULES,SHOWCASE_EXERCISES} from '../presentation.mjs';
import {validateMatchDraft} from '../match-workspace.mjs';
import {checkArticle} from '../staff-workflows.mjs';
import {validateSeason} from '../season-workspace.mjs';
import {makeCallupPreview} from '../callups-preview.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const page=read('presentation.mjs'),app=read('app.js'),html=read('index.html');
const css=read('styles.css'),cfg=read('auth-config.mjs');

test('presentation page is discoverable on main and mobile, with a real route',()=>{
  assert.match(app,/function presentation\(\)/);
  assert.match(app,/'\/presentation':presentation/);
  assert.match(app,/if\(path==='\/presentation'\) mountPresentation\(\); else unmountPresentation\(\);/);
  assert.match(app,/id="showcase-hub"/);
  assert.match(app,/showcase-home-entry/);
  assert.match(html,/href="#\/presentation"/);
  assert.match(app,/Démonstration interactive/);
  assert.match(css,/\.showcase-hub/);
  assert.match(css,/@media\(max-width:550px\)/);
  assert.match(css,/safe-area-inset-bottom/);
});
test('real modules can be demonstrated without fake official posts or scores',()=>{
  assert.deepEqual(SHOWCASE_EXERCISES.map(x=>x.id),['match','article','callup','season']);
  assert.match(page,/mountMatchWorkspace/);
  assert.match(page,/mountMediaWorkspace/);
  assert.match(page,/mountCallupsPreview/);
  assert.match(page,/mountSeasonPreview/);
  assert.match(page,/MODE DÉMONSTRATION — SAISIE LOCALE, AUCUNE PUBLICATION OU ÉCRITURE EN BASE/);
  assert.doesNotMatch(page,/\.rpc\(|\.insert\(|\.update\(|\.delete\(|method:'POST'|localStorage|sessionStorage|innerHTML\s*=/);
  assert.match(cfg,/enabled:\s*false/);
});
test('existing forms validate real input and expose preview only',()=>{
  assert.equal(validateMatchDraft({
    team:'a',opponent:'Équipe exemple',when:'2026-10-22T16:00',
    venue:'Terrain fictif (démo)',season:'2026/2027',
    status:'played',source:'manual',reference:'',
    homeScore:'1',awayScore:'0'
  }).valid,true);
  assert.equal(validateSeason({label:'2026/2027',status:'planned',start:'2026-07-01',end:'2027-06-30'}).valid,true);
  assert.equal(makeCallupPreview({team:'a',response:'confirmed'}).response,'Présent');
  assert.deepEqual(checkArticle({team:'a',title:'Annonce exemple',excerpt:'Résumé local',body:'Contenu local.'}).errors,[]);
});
test('presentation explores existing public pages without pretending privileged features run',()=>{
  for(const route of ['#/matchs','#/equipes','#/actualites','#/evenements','#/awards','#/rejoindre','#/infos-pratiques'])
    assert.ok(SHOWCASE_MODULES.some(x=>x.href===route),route);
  assert.ok(SHOWCASE_MODULES.some(x=>x.href==='#/control-center'&&x.state==='preview'));
  assert.match(page,/Les pages publiques et les aperçus interactifs/);
});
test('count parser does not mistake unknown or truncated headers for exact totals',()=>{
  assert.equal(parsePublicCount('0-0/4'),4);
  assert.equal(parsePublicCount('*/0'),0);
  assert.equal(parsePublicCount('0-0/*'),null);
  assert.equal(parsePublicCount(null),null);
  assert.equal(parsePublicCount(''),null);
});
test('live catalogue probes GET public id only, never perform writes',async()=>{
  const requests=[];
  const fake=async(url,options)=>{
    requests.push({url,options});
    return {ok:true,json:async()=>[{id:'sample'}],
      headers:{get:()=> '0-0/4'}};
  };
  const rows=await probePublicCatalogues(undefined,fake);
  assert.equal(rows.length,PUBLIC_CATALOGUES.length);
  assert.ok(rows.every(r=>r.accessible===true&&r.count===4));
  assert.ok(requests.every(({url,options})=>options.method==='GET'
    &&url.includes('/rest/v1/')
    &&url.includes('select=id')
    &&url.includes('limit=1')
    &&options.headers.Prefer==='count=exact'));
  assert.doesNotMatch(requests.map(x=>x.url).join(''),/user_roles|profiles|player_user_id|role_requests|match_callups|auth\.users/);
});
test('unavailable read remains unavailable, does not invent count',async()=>{
  const mock=async()=>({ok:false,status:503});
  const rows=await probePublicCatalogues(undefined,mock);
  assert.equal(rows.length,6);
  assert.ok(rows.every(x=>x.accessible===false&&x.count===null));
});
test('router unmounts presentation and aborts live lookups',()=>{
  assert.match(page,/currentController\?\.abort\(\)/);
  assert.match(page,/const ctrl=new AbortController\(\)/);
  assert.match(page,/if\(signal\.aborted\|\|turn!==counter\|\|!grid\.isConnected\)return/);
  assert.match(page,/role='note'|setAttribute\('role','note'\)/);
  assert.match(page,/setAttribute\('aria-pressed',String\(active\)\)/);
  assert.match(page,/setAttribute\('aria-label','Choisir un module interactif'\)/);
});
