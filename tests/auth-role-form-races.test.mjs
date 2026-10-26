import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateRoleRequest} from '../role-workflow.mjs';
const auth=readFileSync(new URL('../auth.mjs',import.meta.url),'utf8');
const requests=readFileSync(new URL('../role-workflow.mjs',import.meta.url),'utf8');

test('switching login / registration / recovery invalidates previous async private view',()=>{
  const form=auth.slice(auth.indexOf('function authCard('),auth.indexOf('function renderAuthRetry('));
  assert.match(form,/sessionViewGeneration\s*\+=\s*1;\s*root\.replaceChildren\(\)/);
  const show=auth.slice(auth.indexOf('async function showSession('),auth.indexOf('export function authMarkup('));
  assert.match(show,/const view=sessionViewGeneration\+=1/);
  assert.match(show,/if\s*\(!root\.isConnected\|\|view!==sessionViewGeneration\) return;/);
  assert.match(show,/if\s*\(!root\.isConnected\|\|view!==sessionViewGeneration\)return;/);
});

test('sign-out revokes old private rendering immediately, not only in a scheduled callback',()=>{
  const events=auth.slice(auth.indexOf('api.auth.onAuthStateChange('),auth.indexOf('mounted={subscription}'));
  assert.match(events,/if\(event==='SIGNED_OUT'\)\{[\s\S]*?sessionViewGeneration\+=1;/);
  assert.match(events,/window\.setTimeout\(/);
  assert.ok(events.indexOf('sessionViewGeneration+=1;')<events.indexOf('window.setTimeout('));
});

test('roles are never displayed from a failed Supabase response',()=>{
  assert.match(auth,/const roles = rolesResult\.error \? \[\] : \(rolesResult\.data \|\| \[\]\)\.map/);
  assert.match(auth,/if\(!rolesResult\.error\)void mountMemberRoleRequests/);
});

test('role request uses an immutable snapshot while the RPC runs',()=>{
  assert.match(requests,/const requestedRole=role\.value;/);
  assert.match(requests,/const teamId=requestedRole==='coach'\?team\.value:null/);
  assert.match(requests,/submit\.disabled=true;role\.disabled=true;team\.disabled=true/);
  assert.match(requests,/p_role:requestedRole,p_team_id:teamId/);
  assert.match(requests,/finally\{\s*if\(section\.isConnected\)\{\s*role\.disabled=false;team\.disabled=false;\s*updateRole\(\)/);
  assert.equal(validateRoleRequest('coach',null).valid,false);
  assert.equal(validateRoleRequest('coach','team-1').valid,true);
  assert.equal(validateRoleRequest('admin','team-1').valid,false);
});

test('role request and private request history are robust to network rejection',()=>{
  const reload=requests.slice(requests.indexOf('async function reload(){'),requests.indexOf('  try{\n    const response=await api.from(\'club_teams\')'));
  assert.match(reload,/try\{\s*response=await api\.from\('role_requests'\)/);
  assert.match(reload,/catch\{\s*if\(reloadGate\.isCurrent\(ticket\)&&!disposed&&section\.isConnected\)/);
  assert.match(reload,/if\(!reloadGate\.isCurrent\(ticket\)\|\|disposed\|\|!section\.isConnected\)return/);
  assert.match(requests,/catch\{\s*if\(section\.isConnected\)feedback\.textContent='Service indisponible/);
});
