import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {withAuthDeadline,AuthServiceTimeout} from '../auth-resilience.mjs';

const roles=readFileSync(new URL('../role-workflow.mjs',import.meta.url),'utf8');
const moderation=readFileSync(new URL('../admin-role-moderation.mjs',import.meta.url),'utf8');

test('hung network request rejects promptly without exposing a response or any secrets',async()=>{
  await assert.rejects(withAuthDeadline(new Promise(()=>{}),8),error=>{
    assert.ok(error instanceof AuthServiceTimeout);
    assert.equal(error.name,'AuthServiceTimeout');
    assert.doesNotMatch(error.message,/token|secret|password|Authorization|apikey/i);
    return true;
  });
});

test('a successful request still resolves normally; timeout cannot change its value',async()=>{
  const payload={data:[{role:'supporter'}],error:null};
  assert.deepEqual(await withAuthDeadline(Promise.resolve(payload),50),payload);
  await assert.rejects(withAuthDeadline(Promise.reject(Error('network unavailable')),50),
    /network unavailable/);
});

test('member role workflows set a deadline on catalog, history and role RPC',()=>{
  assert.match(roles,/withAuthDeadline\(api\.from\('club_teams'\)/);
  assert.match(roles,/withAuthDeadline\(api\.from\('role_requests'\)/);
  assert.match(roles,/withAuthDeadline\(api\.rpc\('member_request_role'/);
  assert.match(roles,/submit\.disabled=true;role\.disabled=true;team\.disabled=true/);
  assert.match(roles,/const requestedRole=role\.value/);
  assert.match(roles,/const teamId=requestedRole==='coach'\?team\.value:null/);
  assert.match(roles,/résultat non confirmé/);
  assert.match(roles,/Actualiser mes demandes/);
  assert.match(roles,/Réessayer le chargement des équipes/);
  assert.match(roles,/reloadGate\.invalidate\(\);\s*section\.remove\(\)/);
  assert.doesNotMatch(roles,/service_role|sb_secret_/);
});

test('admin moderation bounds session, role, history and confirmation requests',()=>{
  assert.match(moderation,/withAuthDeadline\(Promise\.all\(\[/);
  for(const p of ["user_roles","club_teams","role_requests"])
    assert.match(moderation,new RegExp("withAuthDeadline\\(api\\.from\\('"+p+"'\\)"));
  assert.match(moderation,/withAuthDeadline\(api\.rpc\('admin_decide_role_request'/);
  assert.match(moderation,/const afterReadGate=await verifiedAdmin\(api,userId\)/);
  assert.match(moderation,/if\(!afterReadGate\.authorized\)\{lockModeration\(\);return;\}/);
  assert.match(moderation,/const decisionReason=reason\.value\.trim\(\)\|\|null/);
  assert.match(moderation,/Connexion indisponible : décision non confirmée/);
  assert.doesNotMatch(moderation,/service_role|sb_secret_/);
});
