import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {authRedirectUrl,authCallbackError,hasAuthCallback,validateAuthInput} from '../auth-flow.mjs';
import {supabaseConfig} from '../auth-config.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const auth=read('auth.mjs'),app=read('app.js');
const valid={email:'user@example.org',password:'unMotDePasseFiable123',displayName:'Supporter A'};
test('login and signup are enabled without bypassing secured admin access or payments',()=>{
 assert.equal(supabaseConfig.enabled,true);
 assert.equal(supabaseConfig.adminEnabled,true);
 assert.equal(supabaseConfig.url,'https://dahzewvbybujqhogumte.supabase.co');
 assert.match(auth,/if \(!supabaseConfig.enabled\)/);
 assert.match(read('admin-role-moderation.mjs'),/supabaseConfig.adminEnabled/);
 assert.match(read('club-editor.mjs'),/supabaseConfig.adminEnabled/);
 assert.match(read('team-person-editor.mjs'),/supabaseConfig.adminEnabled/);
 assert.doesNotMatch(auth,/(?:service_role|sb_secret_|sk_live_)/);
});

test('free supporter plan opens the real account page while paid plans stay disabled',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/href="#\/mon-espace">Se connecter ou créer un compte<\/a>/);
 assert.doesNotMatch(app,/Compte bientôt disponible/);
 assert.match(app,/Paiements non activés/);
 assert.equal(supabaseConfig.enabled,true);
});
test('login validates email and password before talking to Supabase',()=>{
 assert.equal(validateAuthInput('login',valid).valid,true);
 assert.equal(validateAuthInput('login',{...valid,password:'short'}).valid,false);
 assert.equal(validateAuthInput('login',{...valid,password:'a'.repeat(129)}).valid,false);
 assert.equal(validateAuthInput('login',{...valid,email:'not-an-email'}).valid,false);
 assert.equal(validateAuthInput('login',{...valid,email:'a'.repeat(255)+'@x.org'}).valid,false);
 assert.equal(validateAuthInput('reset',{email:valid.email}).valid,true);
 assert.equal(validateAuthInput('reset',{email:'missing'}).valid,false);
});
test('signup takes a minimally necessary display name, no identity claim or role',()=>{
 assert.equal(validateAuthInput('register',valid).valid,true);
 assert.equal(validateAuthInput('register',{...valid,displayName:'A'}).valid,false);
 assert.equal(validateAuthInput('register',{...valid,displayName:'X'.repeat(101)}).valid,false);
 assert.equal(validateAuthInput('newPassword',{password:valid.password}).valid,true);
 assert.equal(validateAuthInput('newPassword',{password:'1234'}).valid,false);
 assert.equal(validateAuthInput('elevate',valid).valid,false);
 assert.match(auth,/signUp\(\{ email, password, options:/);
 assert.match(auth,/data: \{ display_name: review.displayName \}/);
 assert.doesNotMatch(auth,/data: \{[^}]*role:/);
});
test('PKCE callback uses hash-independent exact GitHub Pages base URL',()=>{
 assert.equal(authRedirectUrl({origin:'https://diegosmp94.github.io',pathname:'/Boissy-UJ/'}),
  'https://diegosmp94.github.io/Boissy-UJ/');
 assert.equal(authRedirectUrl({origin:'http://localhost:5173',pathname:'/'}),
  'http://localhost:5173/');
 assert.throws(()=>authRedirectUrl({origin:'http://untrusted.example',pathname:'/'}));
 assert.throws(()=>authRedirectUrl({origin:'javascript:bad',pathname:'/'}));
 assert.match(auth,/const redirectTo = authRedirectUrl\(window.location\)/);
 assert.match(auth,/flowType: "pkce"/);
 assert.match(auth,/detectSessionInUrl: true/);
});
test('valid auth callbacks are routed to Mon espace without deleting a code',()=>{
 assert.equal(hasAuthCallback('?code=pkce-code'),true);
 assert.equal(hasAuthCallback('?error_code=otp_expired'),true);
 assert.equal(hasAuthCallback('?error=access_denied'),true);
 assert.equal(hasAuthCallback('?x=one'),false);
 assert.equal(hasAuthCallback(''),false);
 assert.match(app,/hasAuthCallback\(window.location.search\)/);
 assert.match(app,/target.hash='#\/mon-espace'/);
 assert.match(app,/window.history.replaceState\(null,'',target.toString\(\)\)/);
});
test('email link errors never echo untrusted callback descriptions into the interface',()=>{
 assert.match(authCallbackError('?error_code=otp_expired'),/expiré/);
 assert.match(authCallbackError('?error_code=access_denied'),/expiré/);
 assert.equal(authCallbackError('?error_description=%3Cimg%20src%3Dx%3E'),'');
 const msg=authCallbackError('?error=bad&error_description=%3Cscript%3E');
 assert.ok(msg.length>0);
 assert.doesNotMatch(msg,/script|img/i);
});
test('auth state subscription occurs before session read for password recovery',()=>{
 const start=auth.indexOf('export async function mountAuth()');
 const body=auth.slice(start);
 assert.ok(body.indexOf("api.auth.onAuthStateChange(")<body.indexOf('await api.auth.getSession()'));
 assert.match(body,/event==='PASSWORD_RECOVERY'/);
 assert.match(body,/recoveryExpected&&session/);
 assert.match(auth,/sessionStorage.setItem\(RECOVERY_KEY/);
 assert.match(auth,/sessionStorage.removeItem\(RECOVERY_KEY/);
 assert.match(auth,/api.auth.updateUser\(\{ password \}\)/);
 assert.match(auth,/setRecoveryIntent\(false\)/);
 assert.match(auth,/window.setTimeout\(\(\)=>\{/);
 assert.match(body,/mounted\?\.subscription\)mounted.subscription.unsubscribe\(\)/);
});
test('standard supporter account retains proper getUser verification and logout',()=>{
 assert.match(auth,/api.auth.signInWithPassword\(\{ email, password \}\)/);
 assert.match(auth,/api.auth.getUser\(\)/);
 assert.match(auth,/api.auth.signOut\(\)/);
 assert.match(auth,/api.from\("profiles"\).select\("display_name"\).eq\("id", user.id\)/);
 assert.match(auth,/api.from\("user_roles"\).select\("role"\).eq\("user_id", user.id\)/);
  assert.match(auth,/if \(!root\.isConnected\|\|view!==sessionViewGeneration\) return/);
 assert.doesNotMatch(auth,/\.innerHTML\s*=/);
});
