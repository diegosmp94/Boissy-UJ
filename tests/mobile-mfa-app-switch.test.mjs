import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mfaCodeEntryOpen,mfaReturnDisposition} from '../mfa-mobile-return.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function entry({ready=true,connected=true,inputConnected=true}={}){
 const input={isConnected:inputConnected};
 const panel={isConnected:connected,querySelector:sel=>sel==='input[autocomplete="one-time-code"]'?input:null};
 return {querySelector:sel=>sel==='.admin-mfa-card[data-mfa-code-ready="true"]'&&ready?panel:null};
}
test('mobile MFA app switch preserves only a connected, ready code entry',()=>{
 assert.equal(mfaCodeEntryOpen(entry()),true);
 assert.equal(mfaCodeEntryOpen(entry({ready:false})),false);
 assert.equal(mfaCodeEntryOpen(entry({connected:false})),false);
 assert.equal(mfaCodeEntryOpen(entry({inputConnected:false})),false);
 assert.equal(mfaCodeEntryOpen(null),false);
 assert.equal(mfaCodeEntryOpen({}),false);
});
test('resume is non-destructive for same verified user, fail-closed for signout or role change',()=>{
 const owner='user-a';
 for(const status of ['mfa-required','admin']){
  assert.equal(mfaReturnDisposition({status,userId:owner},owner),'preserve');
 }
 assert.equal(mfaReturnDisposition({status:'unverified',userId:null},owner),'retry');
 assert.equal(mfaReturnDisposition({status:'supporter',userId:owner},owner),'clear');
 assert.equal(mfaReturnDisposition({status:'signed-out',userId:null},owner),'clear');
 assert.equal(mfaReturnDisposition({status:'mfa-required',userId:'user-b'},owner),'clear');
 assert.equal(mfaReturnDisposition({status:'admin',userId:'user-b'},owner),'clear');
 assert.equal(mfaReturnDisposition({status:'admin',userId:owner},null),'clear');
});
test('iOS Safari focus and SIGNED_IN refresh do not erase a pending code form',()=>{
 const auth=read('auth.mjs');
 assert.match(auth,/event==='SIGNED_IN'&&mfaCodeEntryOpen\(root\)/);
 assert.match(auth,/if\(mfaCodeEntryOpen\(root\)\)\{/);
 assert.match(auth,/mfaReturnDisposition\(state,owner\)/);
 assert.match(auth,/adminSessionStatus\(api,owner\)/);
 assert.match(auth,/if\(result==='clear'\)\{/);
 assert.match(auth,/if\(result==='retry'\)\{/);
 assert.match(auth,/event==='SIGNED_OUT'/);
 assert.match(auth,/root\.replaceChildren\(el\('p','auth-loading','Actualisation sécurisée des fonctions et affectations…'\)\)/);
 assert.match(auth,/window\.addEventListener\('focus',recheckOnReturn\)/);
 assert.match(auth,/document\.addEventListener\('visibilitychange',recheckOnReturn\)/);
});
test('MFA code is in memory-only input; user can switch apps and return to the same tab',()=>{
 const mfa=read('admin-security.mjs');
 assert.match(mfa,/root\.dataset\.mfaCodeReady='true'/);
 assert.match(mfa,/delete root\.dataset\.mfaCodeReady/);
 assert.match(mfa,/admin-mfa-mobile-tip/);
 assert.match(mfa,/reviens dans Safari sans fermer cet onglet/);
 assert.match(mfa,/code\.autocomplete='one-time-code'/);
 assert.match(mfa,/const currentUser=await api\.auth\.getUser\(\)/);
 assert.match(mfa,/secured\.status!=='admin'/);
 assert.doesNotMatch(mfa,/localStorage|sessionStorage|document\.cookie|service_role|sb_secret_/);
 const helper=read('mfa-mobile-return.mjs');
 assert.doesNotMatch(helper,/localStorage|sessionStorage|document\.cookie|service_role|sb_secret_|\.rpc\(/);
});
test('temporary errors do not falsely imply the admin logged out and prevent TOTP input',()=>{
 const security=read('admin-security.mjs');
 assert.match(security,/if\(userResult\.error\|\|mfaResult\.error\)/);
 assert.match(security,/status:'unverified'/);
 assert.match(security,/if\(!user\?\.id\|\|expectedId&&user\.id!==expectedId\)/);
 assert.match(security,/status:'signed-out'/);
});
