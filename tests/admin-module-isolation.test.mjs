import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('admin-center.mjs');

test('each admin route creates an isolated module DOM root',()=>{
 assert.match(source,/const view=el\('div','admin-module-instance'\)/);
 assert.match(source,/pane\.replaceChildren\(view\)/);
 assert.match(source,/if\(serial!==currentGeneration\|\|!view\.isConnected\|\|active!==id\)return/);
 assert.match(source,/view\.replaceChildren\(\)/);
});

test('all private admin tools mount under a detachable view, never shared pane',()=>{
 for(const name of [
 'mountAdminMembers','mountAdminRoleModeration','mountAuthenticatedTeamPeopleEditor','mountAdminPlayerTeams','mountAdminCoachTeams',
 'mountAdminSeasons','mountAdminMatches','mountAdminNews','mountAuthenticatedClubIdentityEditor'
 ]){
  assert.ok(source.includes(name+'(view,api,verified.userId)'),name+' not detached');
  assert.ok(!source.includes(name+'(pane,api,verified.userId)'),name+' shares live pane');
 }
});

test('overview async read cannot repaint a subsequent section',()=>{
 assert.match(source,/async function overview\(view\)/);
 assert.match(source,/if\(serial!==currentGeneration\|\|!view\.isConnected\|\|active!=='overview'\)return/);
 assert.match(source,/view\.append\(grid,/);
 assert.doesNotMatch(source,/pane\.append\(grid,/);
});

test('sensitive reads are guarded at the start of every module switch',()=>{
 assert.match(source,/const check=await adminSessionStatus\(api,verified.userId\)/);
 assert.match(source,/if\(!canOpenAdmin\(check,supabaseConfig.adminEnabled\)\)/);
 assert.match(source,/view\.replaceChildren\(el\('p','admin-empty','Accès suspendu/);
 assert.match(source,/event==='SIGNED_OUT'/);
 assert.match(source,/unmountAdminCenter\(\)/);
});
