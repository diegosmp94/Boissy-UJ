import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sanitizedAuthCallbackUrl,hasAuthCallback,loginSuccessMessage} from '../auth-flow.mjs';
import {supabaseConfig} from '../auth-config.mjs';
const read=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const auth=read('auth.mjs');

test('PKCE query parameters are removed without disturbing GitHub Pages hash navigation',()=>{
 const full='https://diegosmp94.github.io/Boissy-UJ/?code=once&lang=fr&error_description=secret#/mon-espace';
 const clean=sanitizedAuthCallbackUrl(full);
 assert.equal(clean,'https://diegosmp94.github.io/Boissy-UJ/?lang=fr#/mon-espace');
 assert.equal(hasAuthCallback(new URL(clean).search),false);
 assert.equal(sanitizedAuthCallbackUrl(clean),clean);
});
test('expired confirmation error details are not persisted in the browser address bar',()=>{
 const url='https://diegosmp94.github.io/Boissy-UJ/?error=access_denied&error_code=otp_expired&error_description=private&ref=member#/mon-espace';
 const clean=sanitizedAuthCallbackUrl(url);
 assert.equal(clean,'https://diegosmp94.github.io/Boissy-UJ/?ref=member#/mon-espace');
 for(const value of ['error=','error_code=','error_description=','code=once']){
  assert.equal(clean.includes(value),false);
 }
});
test('normal news links and unrelated query parameters remain intact',()=>{
 const url='https://diegosmp94.github.io/Boissy-UJ/?lang=fr#/actualites?equipe=futsal';
 assert.equal(sanitizedAuthCallbackUrl(url),url);
});
test('user sees a stable account view after signup with immediate session',()=>{
 assert.match(loginSuccessMessage('register',{session:{user:{id:'some-uuid'}}}),/Compte créé/);
 assert.match(loginSuccessMessage('register',{session:null}),/e-mail/);
 assert.match(loginSuccessMessage('newPassword'),/Mot de passe mis à jour/);
 assert.match(auth,/if\(result\?\.data\?\.session\)/);
 assert.match(auth,/await showSession\(root,api\)/);
 assert.match(auth,/auth-success/);
});
test('repeated session events must not overwrite newer account or signed-out views',()=>{
 assert.match(auth,/let sessionViewGeneration = 0/);
 assert.match(auth,/const view=sessionViewGeneration\+=1/);
 assert.match(auth,/view!==sessionViewGeneration/);
 assert.match(auth,/sessionViewGeneration\+=1;\s*signOut.disabled = true/);
 assert.match(auth,/export function unmountAuth\(\)\{\s*generation \+= 1;\s*sessionViewGeneration\+=1;/);
 assert.match(auth,/event==='SIGNED_OUT'/);
});
test('auth callback is cleaned after the code exchange and also on bootstrap failure',()=>{
 assert.match(auth,/const \{data:\{session\},error\}=await api.auth.getSession\(\)/);
 assert.match(auth,/if\(isCallback\)\{\s*const safe=sanitizedAuthCallbackUrl\(window.location.href\);/);
 assert.match(auth,/window.history.replaceState\(null,'',safe\)/);
 const sections=auth.split('window.history.replaceState');
 assert.equal(sections.length,3);
 assert.match(auth,/if\(isCallback\)\{\s*window.history.replaceState\(null,'',sanitizedAuthCallbackUrl\(window.location.href\)\)/);
});
test('recovery supplies same-browser guidance instead of promising cross-device code exchange',()=>{
 assert.match(auth,/mode==="reset"/);
 assert.match(auth,/même navigateur et sur le même appareil/);
 assert.match(auth,/event==='PASSWORD_RECOVERY'/);
 assert.match(auth,/recoveryExpected&&session/);
 assert.match(auth,/api.auth.updateUser\(\{ password \}\)/);
});
test('browser library is pinned to a verified stable major-v2 package version',()=>{
 assert.match(auth,/@supabase\/supabase-js@2\.118\.0\/\+esm/);
 assert.doesNotMatch(auth,/@supabase\/supabase-js@2\/\+esm/);
});
test('only normal supporter login is enabled; privileged administration stays closed',()=>{
 assert.equal(supabaseConfig.enabled,true);
 assert.equal(supabaseConfig.adminEnabled,true);
 for(const filename of ['admin-role-moderation.mjs','club-editor.mjs','team-person-editor.mjs']){
  assert.match(read(filename),/supabaseConfig.adminEnabled/);
 }
 assert.doesNotMatch(auth,/(?:sb_secret_|service_role|sk_live_)/);
});
test('success notices have responsive, contrast-aware styles with live markup',()=>{
 assert.match(read('index.html'),/auth-feedback\.css/);
 assert.match(read('auth-feedback.css'),/\.auth-success\{/);
 assert.match(read('auth-feedback.css'),/color:#fbe5b0/);
});
