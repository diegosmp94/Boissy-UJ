import test from 'node:test';
import assert from 'node:assert/strict';
import {CLUB_TEAMS} from '../club-teams.mjs';
import {rosterReadinessForTeam,mountAdminRosterReadiness} from '../admin-roster-readiness.mjs';
import {mountAuthenticatedTeamPeopleEditor} from '../team-person-editor.mjs';

const teams=CLUB_TEAMS.map((team,i)=>({...team,id:'team-'+(i+1)}));
const people=[
 {team_id:'team-1',person_kind:'player',published:true,consent_confirmed:true,
  role_label:'Défenseur central',display_name:'Publié consentant'},
 {team_id:'team-1',person_kind:'player',published:true,consent_confirmed:true,
  role_label:'Poste à confirmer',display_name:'Publié sans poste'},
 {team_id:'team-1',person_kind:'coach',published:true,consent_confirmed:true,
  role_label:'Entraîneur'},
 {team_id:'team-1',person_kind:'player',published:false,consent_confirmed:false,
  display_name:'Brouillon privé'},
 {team_id:'team-2',person_kind:'player',published:true,consent_confirmed:true,role_label:'Gardien'}
];
const privatePlayers=[
 {player_user_id:'player-1',position_group:'defender',shirt_number:4},
 {player_user_id:'player-2',position_group:null,shirt_number:null},
 {player_user_id:'player-2',position_group:null,shirt_number:null} // duplicate response must not double count
];

test('roster diagnostic counts only approved public records, without linking by names',()=>{
 const result=rosterReadinessForTeam(teams[0],people,privatePlayers);
 assert.deepEqual({
  affiliated:result.affiliated,numbered:result.numbered,
  missingPosition:result.missingPosition,missingNumber:result.missingNumber,
  publishedPlayers:result.publishedPlayers,educators:result.educators,
  publicUnclassified:result.publicUnclassified,pending:result.pending,consentReview:result.consentReview
 },{
  affiliated:2,numbered:1,missingPosition:1,missingNumber:1,
  publishedPlayers:2,educators:1,publicUnclassified:1,pending:1,consentReview:0
 });
 assert.ok(!JSON.stringify(result).includes('Publié consentant'));
 assert.ok(!JSON.stringify(result).includes('player-1'));
 const unavailable=rosterReadinessForTeam(teams[0],people,null);
 assert.equal(unavailable.available,false);
 assert.equal(unavailable.affiliated,null,'network failure cannot count as zero');
 assert.equal(unavailable.publishedPlayers,2);
 assert.equal(rosterReadinessForTeam(teams[1],people,[]).publishedPlayers,1);
 assert.equal(rosterReadinessForTeam(teams[1],people,[]).affiliated,0);
 assert.throws(()=>rosterReadinessForTeam({code:'untrusted',id:'x'},[],[]));
});

function fakeDocument(){
 class Element{
  constructor(tag){
   this.tagName=tag.toUpperCase();this.children=[];this.listeners={};this.textContent='';
   this.className='';this.value='';this.hidden=false;this.isConnected=true;
   this.dataset={};this.classList={add(){}};
  }
  append(...nodes){for(const node of nodes){
   this.children.push(node);node.parentNode=this;
   if(this.tagName==='SELECT'&&node.tagName==='OPTION'&&this.children.length===1)this.value=node.value;
  }}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  insertBefore(node,before){
   const index=this.children.indexOf(before);if(index<0)this.append(node);
   else {this.children.splice(index,0,node);node.parentNode=this;}
  }
  setAttribute(name,value){(this.attrs??={})[name]=String(value);}
  addEventListener(event,callback){(this.listeners[event]??=[]).push(callback);}
  fire(name){for(const callback of this.listeners[name]||[])callback({target:this,preventDefault(){}});}
  find(cls){return this.descendants().filter(x=>x.className.includes(cls));}
  descendants(){return [this,...this.children.flatMap(x=>x.descendants())];}
  focus(){}
 }
 return {document:{createElement:tag=>new Element(tag)},Element};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('admin roster readiness requires explicit click and a fresh admin check before any private RPC',async()=>{
 const {document,Element}=fakeDocument(),old=globalThis.document;
 globalThis.document=document;
 try{
  const root=new Element('div');let current=true,checks=0,privateReads=0;
  const api={rpc:async(name,args)=>{
   assert.equal(name,'staff_list_affiliated_players');
   assert.ok(teams.some(t=>t.id===args.p_team_id));
   privateReads++;
   return {data:args.p_team_id==='team-1'?privatePlayers:[],error:null};
  }};
  const audit=mountAdminRosterReadiness(root,api,async()=>{checks++;return current;},
   ()=>({revision:1,teams,entries:people}));
  assert.ok(audit?.invalidate);
  assert.equal(privateReads,0);
  const button=root.find('team-person-secondary-button')[0];
  assert.equal(button.type,'button');
  button.fire('click');await flush();await flush();
  assert.equal(privateReads,5);
  assert.equal(checks,2,'check authorization before and after sensitive reads');
  const output=root.find('admin-roster-audit-results')[0];
  assert.equal(output.find('admin-roster-audit-item').length,5);
  const visible=output.descendants().map(n=>n.textContent).join('|');
  assert.match(visible,/Seniors A/);
  assert.match(visible,/sans catégorie/);
  assert.doesNotMatch(visible,/Publié consentant|Brouillon privé|player-1/);
  current=false;
  button.fire('click');await flush();
  assert.equal(privateReads,5,'revoked admin must not receive private data');
  assert.equal(output.children.length,0,'stale private reports are cleared on denied access');
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});

test('an authorized administrator can mount the real public editor without undefined button exception',async()=>{
 const {document,Element}=fakeDocument(),old=globalThis.document;
 globalThis.document=document;
 try{
  const root=new Element('div'),userId='admin-uuid';let privateReads=0;
  const api={
   auth:{
    getUser:async()=>({data:{user:{id:userId}},error:null}),
    mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'},error:null})}
   },
   from:table=>{
    assert.ok(['user_roles','club_teams'].includes(table));
    return {select:()=>{
     if(table==='user_roles')return {
      eq:async()=>({data:[{role:'admin'}],error:null})
     };
     return {order:async()=>({data:teams.map(t=>({id:t.id,code:t.code,name:t.name})),error:null})};
    }};
   },
   rpc:async name=>{
    if(name==='admin_list_team_public_people')return {data:[],error:null};
    if(name==='staff_list_affiliated_players'){privateReads++;return {data:[],error:null};}
    throw new Error('unexpected RPC '+name);
   }
  };
  await mountAuthenticatedTeamPeopleEditor(root,api,userId);
  assert.equal(root.find('team-person-private').length,1,'admin roster editor mounted');
  assert.ok(root.find('team-person-secondary-button').length>=2,'refresh/withdraw buttons exist');
  assert.equal(root.find('admin-roster-readiness').length,1,'private read-only audit mounted');
  assert.equal(privateReads,0,'the module never fetches private affiliations on mount');
  const text=root.descendants().map(n=>n.textContent).join('|');
  assert.match(text,/Équipes · effectifs publics/);
  assert.match(text,/État des effectifs par équipe/);
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});
