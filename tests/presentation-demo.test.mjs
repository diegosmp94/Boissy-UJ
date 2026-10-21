import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  SHOWCASE_MODULES,SHOWCASE_EXERCISES,PUBLIC_CATALOGUES,
  parsePublicCount,probePublicCatalogues
} from '../presentation.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('app.js');
const html=read('index.html');
const style=read('styles.css');
const src=read('presentation.mjs');
const auth=read('auth-config.mjs');

test('Thursday showcase route is linked from hero, mobile navigation and page titles',()=>{
  assert.match(app,/function presentation\(\)/);
  assert.match(app,/'\/presentation':presentation/);
  assert.match(app,/if\(path==='\/presentation'\) mountPresentation\(\); else unmountPresentation\(\);/);
  assert.match(app,/href="#\/presentation"/);
  assert.match(app,/id="showcase-hub"/);
  assert.match(html,/href="#\/presentation"/);
  assert.match(app,/'\/presentation':'Démonstration interactive'/);
});
test('showcase contains working public links and four separate interactive drafts',()=>{
  assert.equal(SHOWCASE_MODULES.length,9);
  assert.ok(SHOWCASE_MODULES.some(mod=>mod.href==='#/club'&&mod.state==='public'));
  for(const mod of SHOWCASE_MODULES){
    assert.match(mod.href,/^#\//);
    assert.ok(['public','preview'].includes(mod.state));
  }
  assert.deepEqual(SHOWCASE_EXERCISES.map(x=>x.id),
    ['match','article','callup','season']);
  assert.match(src,/match:mountMatchWorkspace/);
  assert.match(src,/article:mountMediaWorkspace/);
  assert.match(src,/callup:mountCallupsPreview/);
  assert.match(src,/season:mountSeasonPreview/);
  assert.match(src,/slot\.replaceChildren\(\)/);
});
test('presentation does not activate auth, payments or privileged mutations',()=>{
  assert.match(auth,/enabled:\s*false/);
  assert.match(src,/MODE DÉMONSTRATION — SAISIE LOCALE/);
  assert.match(src,/AUCUNE PUBLICATION OU ÉCRITURE EN BASE/);
  assert.doesNotMatch(src,/\.rpc\(|service_role|sb_secret_|sk_live_|localStorage|\.insert\(|\.update\(|\.delete\(|method:'POST'/);
  assert.doesNotMatch(src,/innerHTML\s*=/);
});
test('live catalogue check only reads public ids and exact counts',()=>{
  assert.equal(PUBLIC_CATALOGUES.length,6);
  assert.deepEqual(PUBLIC_CATALOGUES.map(x=>x.table),[
    'club_teams','matches','news_posts','club_events',
    'club_awards','club_join_opportunities'
  ]);
  assert.equal(parsePublicCount('0-0/9'),9);
  assert.equal(parsePublicCount('*/0'),0);
  assert.equal(parsePublicCount('unknown'),null);
  assert.equal(parsePublicCount('0-1/*'),null);
});
test('catalogue check tolerates one unavailable public table without fabricating counts',async()=>{
  const seen=[];
  const mockedFetch=async(url,options)=>{
    seen.push({url,options});
    if(url.includes('club_awards'))return {ok:false,status:403};
    return {ok:true,headers:{get:name=>name==='content-range'?'0-0/0':null},
      json:async()=>[]};
  };
  const items=await probePublicCatalogues(undefined,mockedFetch);
  assert.equal(items.length,6);
  assert.equal(items.find(x=>x.table==='club_awards').accessible,false);
  assert.equal(items.find(x=>x.table==='club_awards').count,null);
  assert.ok(items.filter(x=>x.accessible).every(x=>x.count===0));
  assert.ok(seen.every(x=>x.options.method==='GET'));
  assert.ok(seen.every(x=>x.options.headers.Prefer==='count=exact'));
  assert.ok(seen.every(x=>x.url.includes('select=id')&&x.url.includes('limit=1')));
  assert.doesNotMatch(seen.map(x=>x.url).join(''),/staff_|user_roles|role_requests|auth\.users|player_user_id/);
});
test('interactive mobile layout preserves reduced motion and responsive breakpoints',()=>{
  assert.match(style,/\.showcase-feature-grid/);
  assert.match(style,/\.showcase-demo-slot/);
  assert.match(style,/@media\(max-width:550px\)/);
  assert.match(style,/safe-area-inset-bottom/);
  assert.match(style,/prefers-reduced-motion:reduce/);
  assert.match(src,/aria-pressed/);
  assert.match(src,/aria-label/);
  assert.match(src,/currentController\?\.abort\(\)/);
});
