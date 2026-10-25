import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CLUB_TEAMS} from '../club-teams.mjs';
import {mountTeamAffiliatedRoster,unmountTeamAffiliatedRoster} from '../team-affiliated-roster.mjs';
import {mountTeamPublicExtras,unmountTeamPublicExtras} from '../team-profile-data.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function fakeDom(){
 const document={activeElement:null};
 class Node{
  constructor(tag){
   this.tagName=tag.toUpperCase();this.children=[];this.listeners={};
   this.textContent='';this.className='';this.hidden=false;this.value='';
   this.isConnected=true;
  }
  append(...children){
   for(const child of children){
    this.children.push(child);child.parentNode=this;
    if(this.tagName==='SELECT'&&child.tagName==='OPTION'&&
       this.children.filter(c=>c.tagName==='OPTION').length===1)this.value=child.value;
   }
  }
  replaceChildren(...children){this.children.forEach(c=>c.isConnected=false);this.children=[];this.append(...children);}
  remove(){
   if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(c=>c!==this);
   this.isConnected=false;
  }
  setAttribute(name,value){(this.attrs??={})[name]=String(value);}
  addEventListener(name,callback){(this.listeners[name]??=[]).push(callback);}
  dispatch(name,extras={}){
   for(const callback of this.listeners[name]||[])callback({target:this,preventDefault(){},...extras});
  }
  focus(){document.activeElement=this;}
  findAll(predicate){
   const all=[this];for(const child of this.children)all.push(...child.findAll(predicate));
   return all.filter(predicate);
  }
  querySelector(selector){
   if(selector==='form select')
    return this.findAll(n=>n.tagName==='FORM')[0]?.findAll(n=>n.tagName==='SELECT')[0]||null;
   if(selector==='form')return this.findAll(n=>n.tagName==='FORM')[0]||null;
   if(selector==='.team-affiliated-account-link')
    return this.findAll(n=>n.className==='team-affiliated-account-link')[0]||null;
   return null;
  }
 }
 const root=new Node('section');
 document.getElementById=id=>id==='team-affiliated-roster-root'?root:null;
 document.createElement=tag=>new Node(tag);
 return {root,document};
}
function formState(root){
 const form=root.findAll(n=>n.tagName==='FORM')[0];
 assert.ok(form,'secured roster form available');
 const [player,position]=form.findAll(n=>n.tagName==='SELECT');
 const number=form.findAll(n=>n.tagName==='INPUT')[0];
 return {form,player,position,number};
}

test('unassigned player has no implicit goalkeeper selection and cannot be saved without an explicit group',async()=>{
 const {root,document}=fakeDom();
 const prev=globalThis.document;
 globalThis.document=document;
 const team=CLUB_TEAMS.find(t=>t.code==='a');
 const data=[
  {player_user_id:'player-A',display_name:'Joueur A',position_group:null,shirt_number:null,updated_at:null},
  {player_user_id:'player-B',display_name:'Joueur B',position_group:null,shirt_number:null,updated_at:null}
 ];
 const writes=[];
 const api={
  auth:{getUser:async()=>({data:{user:{id:'staff-user'}},error:null})},
  from:table=>{
   assert.equal(table,'club_teams');
   return {select:()=>({eq:()=>({limit:async()=>({
    data:[{id:'team-a-id',code:'a',discipline:'football'}],error:null
   })})})};
  },
  rpc:async(name,args)=>{
   if(name==='staff_list_affiliated_players')return {data:data.map(x=>({...x})),error:null};
   if(name==='staff_set_affiliated_player_position'){
    writes.push(args);const row=data.find(x=>x.player_user_id===args.p_player_user_id);
    Object.assign(row,{position_group:args.p_position_group,shirt_number:args.p_shirt_number,
     updated_at:'2026-10-25T09:01:00Z'});
    return {data:true,error:null};
   }
   throw new Error('Unexpected RPC '+name);
  }
 };
 try{
  mountTeamAffiliatedRoster(team,async()=>api);
  const disclosure=root.findAll(n=>n.tagName==='DETAILS')[0];
  disclosure.open=true;disclosure.dispatch('toggle');
  await tick();await tick();
  let {form,player,position,number}=formState(root);
  assert.equal(player.value,'player-A');
  assert.equal(position.value,'','new player must not default to Gardien');
  assert.equal(position.children[0].textContent,'Choisir une catégorie…');
  assert.equal(position.required,true);
  assert.equal(number.value,'');
  player.value='player-B';player.dispatch('change');
  assert.equal(position.value,'');
  number.value='8';
  form.dispatch('submit');await tick();
  assert.equal(writes.length,0,'empty position cannot write');
  position.value='defender';
  form.dispatch('submit');await tick();await tick();
  assert.equal(writes.length,1);
  assert.deepEqual(writes[0],{
   p_team_id:'team-a-id',p_player_user_id:'player-B',
   p_position_group:'defender',p_shirt_number:8,p_expected_updated_at:null
  });
  ({form,player,position,number}=formState(root));
  assert.equal(player.value,'player-B','save must not jump to the first player');
  assert.equal(position.value,'defender');
  assert.equal(number.value,'8');
  assert.equal(document.activeElement,player,'keyboard focus must be restored');
  // A manual refresh keeps the same player selected.
  root.findAll(n=>n.textContent==='Actualiser les affiliations'&&n.tagName==='BUTTON')[0].dispatch('click');
  await tick();await tick();
  ({player,position}=formState(root));
  assert.equal(player.value,'player-B');
  assert.equal(position.value,'defender');
 }finally{
  unmountTeamAffiliatedRoster();
  if(prev===undefined)delete globalThis.document;else globalThis.document=prev;
 }
});
test('unconfigured public catalogue renders five honest empty groups without inventing identities',async()=>{
 const {root,document}=fakeDom();
 document.getElementById=id=>id==='team-profile-extras'?root:null;
 const previousDocument=globalThis.document,previousFetch=globalThis.fetch;
 const requests=[];
 globalThis.document=document;
 globalThis.fetch=async(url,options)=>{
  requests.push({url,options});
  assert.match(url,/\/rest\/v1\/club_teams\?/);
  return {ok:true,json:async()=>[]};
 };
 try{
  await mountTeamPublicExtras('a',{view:'players'});
  const headings=root.findAll(n=>n.tagName==='H2').map(n=>n.textContent);
  assert.deepEqual(headings,['Gardiens','Défenseurs','Milieux','Attaquants','Éducateurs']);
  assert.equal(root.findAll(n=>n.className.includes('team-extras-player-card')).length,0);
  assert.equal(requests.length,1,'no optional stats or news requests for an empty team');
  assert.equal(requests[0].options.method,'GET');
  assert.ok(root.findAll(n=>n.textContent.includes('Annuaire public non configuré')).length>0);
  assert.ok(root.findAll(n=>n.textContent.includes('Aucun éducateur autorisé')).length>0);
 }finally{
  unmountTeamPublicExtras();
  if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
  if(previousFetch===undefined)delete globalThis.fetch;else globalThis.fetch=previousFetch;
 }
});
