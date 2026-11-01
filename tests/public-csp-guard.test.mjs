import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateEntrypointCsp} from '../scripts/public-csp-guard.mjs';

const currentHtml=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const validCsp="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'none'; upgrade-insecure-requests";
const html=policy=>'<html><head><meta http-equiv="Content-Security-Policy" content="'+policy+'"></head></html>';

test('published HTML keeps restrictive essential CSP meta directives',()=>{
 assert.equal(validateEntrypointCsp(currentHtml).checked,true);
 assert.match(validateEntrypointCsp(currentHtml).scope,/not certified/);
});

test('CSP guard rejects missing or permissive script directives',()=>{
 assert.throws(()=>validateEntrypointCsp('<html></html>'),/CSP meta tag missing/);
 assert.throws(()=>validateEntrypointCsp(html(validCsp.replace("script-src 'self' https://cdn.jsdelivr.net; ",''))),/script-src missing/);
 for(const bad of ["'unsafe-inline'","'unsafe-eval'",'*','http://example.test']){
  assert.throws(()=>validateEntrypointCsp(html(validCsp.replace('script-src \'self\'','script-src \'self\' '+bad))),/script policy/);
 }
});

test('CSP guard rejects relaxed object, base, form and frame directives',()=>{
 for(const [original,changed] of [
  ["object-src 'none'","object-src *"],
  ["base-uri 'self'","base-uri *"],
  ["form-action 'self'","form-action *"],
  ["frame-src 'none'","frame-src *"]
 ]){
  assert.throws(()=>validateEntrypointCsp(html(validCsp.replace(original,changed))),/directive requires review/);
 }
 assert.throws(()=>validateEntrypointCsp(html(validCsp.replace('upgrade-insecure-requests',''))),/upgrade-insecure-requests missing/);
});

test('public smoke validator enforces CSP semantics, not just meta marker',()=>{
 const source=readFileSync(new URL('../scripts/public-live-validator.mjs',import.meta.url),'utf8');
 assert.match(source,/validateEntrypointCsp\(body\)/);
 assert.match(source,/from '\.\/public-csp-guard\.mjs'/);
});
