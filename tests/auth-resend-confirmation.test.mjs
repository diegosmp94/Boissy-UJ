import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateAuthInput,authRedirectUrl} from '../auth-flow.mjs';
import {supabaseConfig} from '../auth-config.mjs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const auth=read('auth.mjs');

test('resend confirmation accepts a valid email without requesting a password',()=>{
 const valid=validateAuthInput('resend',{email:'supporter@example.com'});
 assert.deepEqual(valid.errors,[]);
 assert.equal(valid.valid,true);
 assert.equal(valid.password,'');
 assert.equal(valid.email,'supporter@example.com');
});
test('resend confirmation rejects invalid addresses and unsupported modes',()=>{
 for(const email of ['', 'bad', '@example.com', 'a'.repeat(255)+'@example.fr'])
  assert.equal(validateAuthInput('resend',{email}).valid,false);
 assert.equal(validateAuthInput('request-admin',{email:'supporter@example.com'}).valid,false);
});
test('resend confirmation uses the same production redirect as initial signup',()=>{
 assert.equal(authRedirectUrl({origin:'https://diegosmp94.github.io',pathname:'/Boissy-UJ/',hash:'#/mon-espace'}),
  'https://diegosmp94.github.io/Boissy-UJ/');
 assert.match(auth,/api\.auth\.resend\(\{/);
 assert.match(auth,/type: "signup",email,options:\{emailRedirectTo:redirectTo\}/);
 assert.match(auth,/emailRedirectTo: redirectTo/);
 assert.match(auth,/const redirectTo = authRedirectUrl\(window.location\)/);
});
test('resend confirmation UI can be reached without registration or login',()=>{
 assert.match(auth,/resend: "Renvoyer la confirmation"/);
 assert.match(auth,/mode === "login" \|\| mode === "register"/);
 assert.match(auth,/Renvoyer l'e-mail de confirmation/);
 assert.match(auth,/authCard\(root, "resend"\)/);
 assert.match(auth,/if \(mode === "resend"\) \{/);
 assert.match(auth,/mode !== "newPassword"/);
 assert.match(auth,/mode === "reset"/);
});
test('resend confirmation avoids account existence leaks and leaves admin locked',()=>{
 assert.match(auth,/Si cette adresse possède un compte en attente de confirmation/);
 assert.match(auth,/safeMessage\(result.error\)/);
 assert.match(auth,/code.includes\("rate_limit"\)/);
 assert.doesNotMatch(auth,/service_role|sb_secret_|method:\s*'POST'/);
 assert.equal(supabaseConfig.enabled,true);
 assert.equal(supabaseConfig.adminEnabled,false);
});
