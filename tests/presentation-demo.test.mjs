import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const app=read('app.js'),page=read('index.html');
test('old public demonstration route and CTA are removed',()=>{
 assert.doesNotMatch(app,/function presentation\(\)|'\/presentation':presentation|mountPresentation\(/);
 assert.doesNotMatch(app,/href="#\/presentation"/);
 assert.doesNotMatch(page,/href="#\/presentation"/);
});
test('site still exposes the real public sections, without simulation',()=>{
 for(const route of ["'/matchs':matches","'/equipes':teamPage","'/actualites':news","'/club':identity"])
  assert.ok(app.includes(route));
 assert.match(app,/adminCenterMarkup\(\)/);
});
