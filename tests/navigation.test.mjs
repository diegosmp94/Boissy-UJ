import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const text=path=>readFileSync(resolve(root,path),'utf8');
const pages=['index.html','equipes.html','match-center.html','actualites.html','communaute.html','soutenir.html','mon-espace.html'];
test('public navigation points to existing pages or local anchors',()=>{
 for(const page of pages){
  assert.ok(existsSync(resolve(root,page)),page);
  const html=text(page);
  for(const m of html.matchAll(/href="([^"]+)"/g)){
   const target=m[1];
   if(target.startsWith('http')||target.startsWith('#')||target.startsWith('mailto:'))continue;
   const [path,hash]=target.split('#');
   if(path){assert.ok(existsSync(resolve(root,path)),page+': '+target);}
   if(hash&&(!path||path===page)){
    const linked=path?text(path):html;
    assert.ok(linked.includes('id="'+hash+'"'),page+': missing anchor '+hash);
   }
  }
 }
});
test('privacy-oriented preview: no actual payment forms or password fields',()=>{
 for(const page of pages){
  const html=text(page);
  assert.doesNotMatch(html,/sk_live_|pk_live_|type="password"|<form\b/i,page);
 }
});
test('home provides skippable intro and exactly eight chapters',()=>{
 const html=text('index.html');
 assert.match(html,/data-skip/);
 assert.equal((html.match(/class="chapter(?:\s|")/g)||[]).length,8);
});
test('branding file exists and reduced motion is supported',()=>{
 assert.ok(existsSync(resolve(root,'assets/ecusson.svg')));
 assert.match(text('styles.css'),/prefers-reduced-motion/);
 assert.match(text('styles.css'),/safe-area-inset-bottom/);
});
