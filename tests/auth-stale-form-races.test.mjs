import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isCurrentAuthForm,validateAuthInput} from '../auth-flow.mjs';

const auth=readFileSync(new URL('../auth.mjs',import.meta.url),'utf8');

function state(){
 const form={isConnected:true};
 const root={isConnected:true,current:form,
  querySelector(selector){
   assert.equal(selector,'form[data-auth-mode]');
   return this.current;
  }
 };
 return {root,form};
}

test('the visible account form stays eligible while it owns the current view',()=>{
 const {root,form}=state();
 assert.equal(isCurrentAuthForm(root,form),true);
 assert.equal(validateAuthInput('login',{email:'test@example.org',password:'valid-1234'}).valid,true);
});

test('a replaced login form cannot overwrite registration or password recovery',()=>{
 const {root,form}=state();
 root.current={isConnected:true};
 // Even when a mocked old element still says connected, ownership is decisive.
 assert.equal(isCurrentAuthForm(root,form),false);
 root.current=form;form.isConnected=false;
 assert.equal(isCurrentAuthForm(root,form),false);
});

test('navigating away invalidates outstanding account requests',()=>{
 const {root,form}=state();
 root.isConnected=false;
 assert.equal(isCurrentAuthForm(root,form),false);
 assert.equal(isCurrentAuthForm(null,form),false);
 assert.equal(isCurrentAuthForm(root,null),false);
});

test('login, sign-up, e-mail resend, reset and new-password responses all have ownership guard',()=>{
 assert.match(auth,/const isCurrent=\(\)=>isCurrentAuthForm\(root,form\)/);
 assert.match(auth,/if\(!isCurrent\(\)\)return; \/\/ Stop before starting an obsolete auth request\./);
 assert.match(auth,/if\(!isCurrent\(\)\)\{\s*\/\/ Keep recovery intent correct/);
 assert.match(auth,/if\(isCurrent\(\)\)alertFor\(root, safeMessage\(error\), true\)/);
 const before=auth.indexOf('const api = await client();');
 const after=auth.indexOf('if(!isCurrent())return;',before);
 const signin=auth.indexOf('api.auth.signInWithPassword',before);
 assert.ok(before>0&&after>before&&signin>after);
 for(const call of [
  'api.auth.signUp(','api.auth.resetPasswordForEmail(',
  'api.auth.resend(','api.auth.updateUser('
 ])assert.ok(auth.indexOf(call,signin)>0,call);
});

test('auth refresh behavior and server-backed permissions remain separate',()=>{
 assert.match(auth,/api\.auth\.getUser\(\)/);
 assert.match(auth,/api\.auth\.signOut\(\)/);
 assert.match(auth,/event==='PASSWORD_RECOVERY'/);
 assert.match(auth,/api\.from\("user_roles"\)\.select\("role"\)/);
 assert.match(auth,/mountAdminMfaSetup\(account,api,user\.id\)/);
 assert.doesNotMatch(auth,/service_role|sb_secret_|method:\s*['"]POST['"]|\.innerHTML\s*=/);
});
