import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const auth=readFileSync(new URL('../auth.mjs',import.meta.url),'utf8');
test('unverified role lookup does not mount private or permission-dependent panels',()=>{
 assert.match(auth,/if\(!rolesResult\.error\)void mountMemberRoleRequests\(account,api,user\.id\)/);
 assert.match(auth,/if\(!rolesResult\.error\)mountMemberSports\(account,api,user\.id,roles\)/);
 assert.match(auth,/if\(!rolesResult\.error&&roles\.includes\('admin'\)\)void mountAdminMfaSetup\(account,api,user\.id\)/);
 assert.doesNotMatch(auth,/roles\.length \?[^\n]+: "en cours de chargement"/);
});
test('sign-out remains mounted despite role lookup failure',()=>{
 const signout=auth.indexOf('account.append(signOut);');
 const failclose=auth.indexOf('if(!rolesResult.error)void mountMemberRoleRequests(');
 assert.ok(signout>0&&failclose>signout);
});
