import test from 'node:test';
import assert from 'node:assert/strict';
import {mountAdminRoleModeration} from '../admin-role-moderation.mjs';

// Minimal deterministic DOM: tests the real async controller without browser credentials.
function fakeDOM(){
  class Node {
    constructor(tag){
      this.tagName=tag.toUpperCase();
      this.children=[];this.listeners={};this.textContent='';
      this.className='';this.value='';this.hidden=false;this.isConnected=true;
      this.disabled=false;
    }
    append(...nodes){
      for(const node of nodes){
        this.children.push(node);node.parentNode=this;node.isConnected=true;
        if(this.tagName==='SELECT'&&node.tagName==='OPTION'&&this.children.length===1)this.value=node.value;
      }
    }
    replaceChildren(...nodes){
      for(const old of this.children)old.disconnect();
      this.children=[];this.append(...nodes);
    }
    disconnect(){this.isConnected=false;for(const c of this.children)c.disconnect();}
    insertBefore(node,before){
      const at=this.children.indexOf(before);
      if(at<0)this.append(node);
      else {this.children.splice(at,0,node);node.parentNode=this;node.isConnected=true;}
    }
    addEventListener(type,callback){(this.listeners[type]??=[]).push(callback);}
    fire(type){for(const cb of this.listeners[type]||[])cb({target:this,preventDefault(){}});}
    setAttribute(name,value){(this.attributes??={})[name]=String(value);}
    descendants(){return [this,...this.children.flatMap(c=>c.descendants())];}
    find(cls){return this.descendants().filter(n=>n.className===cls);}
  }
  return {document:{createElement:tag=>new Node(tag)},Node};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function until(predicate){
  for(let i=0;i<15&&!predicate();i++)await flush();
  assert.ok(predicate(),'async step did not start');
}
const visible=node=>node.descendants().filter(n=>n.isConnected)
  .map(n=>n.textContent).join(' | ');

function harness(){
  const {document,Node}=fakeDOM();
  const root=new Node('div'),id='admin-reviewer',reads=[];
  let assurance='aal2';
  const api={
    auth:{
      getUser:async()=>({data:{user:{id}},error:null}),
      mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:assurance},error:null})}
    },
    from:table=>{
      if(table==='user_roles')return {select:()=>({eq:async()=>({data:[{role:'admin'}],error:null})})};
      if(table==='club_teams')return {select:()=>({order:async()=>({data:[],error:null})})};
      if(table==='role_requests')return {select:()=>({eq:()=>({order:()=>({limit:()=>new Promise(resolve=>reads.push(resolve))})})})};
      throw new Error('unexpected table: '+table);
    }
  };
  return {document,root,id,reads,api,setAssurance:value=>{assurance=value;}};
}

test('MFA revoked while moderation reads private requests: identifiers never reach DOM',async()=>{
  const h=harness(),previous=globalThis.document;
  globalThis.document=h.document;
  try{
    const mounting=mountAdminRoleModeration(h.root,h.api,h.id);
    await until(()=>h.reads.length===1);
    const section=h.root.find('admin-role-moderation')[0];
    assert.ok(section);
    h.setAssurance('aal1');
    h.reads[0]({data:[{id:'one',user_id:'PRIVATE_MEMBER_01',
      requested_role:'admin',team_id:null,status:'pending',requested_at:'2026-10-26'}],error:null});
    await mounting;
    assert.equal(section.hidden,true);
    assert.doesNotMatch(visible(h.root),/PRIVATE_MEMBER_01/);
    assert.equal(section.find('admin-role-request-card').length,0);
  }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});

test('older request history response never replaces the newest filtered moderation list',async()=>{
  const h=harness(),previous=globalThis.document;
  globalThis.document=h.document;
  try{
    const mounting=mountAdminRoleModeration(h.root,h.api,h.id);
    await until(()=>h.reads.length===1);
    h.reads[0]({data:[],error:null});
    await mounting;
    const section=h.root.find('admin-role-moderation')[0];
    const filter=section.find('staff-input')[0];
    filter.value='approved';filter.fire('change');
    await until(()=>h.reads.length===2);
    filter.value='rejected';filter.fire('change');
    await until(()=>h.reads.length===3);
    h.reads[2]({data:[{id:'new',user_id:'CURRENT_MEMBER',
      requested_role:'player',team_id:null,status:'rejected',requested_at:'2026-10-26'}],error:null});
    for(let i=0;i<5;i++)await flush();
    h.reads[1]({data:[{id:'old',user_id:'STALE_MEMBER',
      requested_role:'coach',team_id:null,status:'approved',requested_at:'2026-10-26'}],error:null});
    for(let i=0;i<5;i++)await flush();
    assert.match(visible(section),/CURRENT_MEMBER/);
    assert.doesNotMatch(visible(section),/STALE_MEMBER/);
    assert.equal(section.hidden,false);
  }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
