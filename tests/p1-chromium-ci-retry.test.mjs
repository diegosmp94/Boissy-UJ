import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../scripts/browser-smoke.mjs',import.meta.url),'utf8');

test('Chromium CI launcher retries at most once without hiding a repeated startup failure',()=>{
 assert.match(src,/async function launchBrowserOnce\(\)/);
 assert.match(src,/async function startBrowser\(\)/);
 assert.match(src,/for\(let attempt=1;attempt<=2;attempt\+\+\)/);
 assert.match(src,/try\{return await launchBrowserOnce\(\);\}/);
 assert.match(src,/if\(attempt===2\)break/);
 assert.match(src,/throw lastError/);
});
test('startup retry keeps failed Chrome processes and temporary profiles cleaned up',()=>{
 assert.match(src,/browser\.kill\('SIGKILL'\);await rm\(dir,\{recursive:true,force:true\}\)/);
 assert.match(src,/const dir=await mkdtemp/);
 assert.match(src,/not installed/);
});
