import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAsyncRevisionGate} from '../role-workflow.mjs';

const source=readFileSync(new URL('../role-workflow.mjs',import.meta.url),'utf8');

test('latest history request wins even if an older successful response arrives last',async()=>{
  const gate=createAsyncRevisionGate();
  const seen=[];
  let settleOld,settleNew;
  const oldResult=new Promise(resolve=>{settleOld=resolve;});
  const newResult=new Promise(resolve=>{settleNew=resolve;});
  async function read(promise){
    const ticket=gate.begin();
    const payload=await promise;
    if(gate.isCurrent(ticket))seen.push(payload);
  }
  const old=read(oldResult),newer=read(newResult);
  settleNew('fresh');await newer;
  settleOld('stale');await old;
  assert.deepEqual(seen,['fresh']);
});

test('starting a role submission invalidates an older pending history response',async()=>{
  const gate=createAsyncRevisionGate();
  const pendingRead=gate.begin();
  gate.invalidate();
  assert.equal(gate.isCurrent(pendingRead),false);
  const newRead=gate.begin();
  assert.equal(gate.isCurrent(newRead),true);
});

test('a stale failed lookup must not replace a newer success with a warning',()=>{
  const gate=createAsyncRevisionGate();
  const failedRequest=gate.begin();
  const successfulRequest=gate.begin();
  assert.equal(gate.isCurrent(failedRequest),false);
  assert.equal(gate.isCurrent(successfulRequest),true);
});

test('member UI uses the gate on both failed and successful reads and before mutation',()=>{
  assert.match(source,/const reloadGate=createAsyncRevisionGate\(\)/);
  assert.match(source,/const ticket=reloadGate\.begin\(\)/);
  assert.match(source,/if\(reloadGate\.isCurrent\(ticket\)&&!disposed&&section\.isConnected\)/);
  assert.match(source,/if\(!reloadGate\.isCurrent\(ticket\)\|\|disposed\|\|!section\.isConnected\)return/);
  assert.match(source,/reloadGate\.invalidate\(\); \/\/ An in-flight older history load is now obsolete/);
  assert.match(source,/submit\.disabled=true; \/\/ Wait for the team catalog/);
  assert.match(source,/function updateRole\(\)\{[\s\S]*?submit\.disabled=role\.value==='coach'&&!teams\.length/);
});
