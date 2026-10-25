import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CLUB_TEAMS} from '../club-teams.mjs';
import {teamSubpageRoute} from '../team-subpages.mjs';
import {teamNewsRoute,loadTeamPublicExtras} from '../team-profile-data.mjs';
import {mountTeamAffiliatedRoster,unmountTeamAffiliatedRoster} from '../team-affiliated-roster.mjs';
const src=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

function fakeElement(tag){
 return {tagName:tag.toUpperCase(),className:'',children:[],listeners:{},
   isConnected:true,textContent:'',hidden:false,disabled:false,attrs:{},
   append(...children){for(const child of children){child.parent=this;this.children.push(child);}},
   replaceChildren(...children){for(const old of this.children)old.isConnected=false;this.children=[];this.append(...children);},
   remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.isConnected=false;},
   setAttribute(k,v){this.attrs[k]=String(v);},
   addEventListener(k,fn){this.listeners[k]=fn;},
   click(){this.listeners.click?.({preventDefault(){}});},
   querySelector(query){
     const match=n=>query==='form'?n.tagName==='FORM':
       query==='a'?n.tagName==='A':
       query.startsWith('.')?n.className.split(/\s+/).includes(query.slice(1)):false;
     const visit=n=>{
       for(const child of n.children){
        if(match(child))return child;
        const found=visit(child);if(found)return found;
       }
       return null;
     };
     return visit(this);
   }
 };
}
const wait=async()=>{await new Promise(resolve=>setImmediate(resolve));};

test('team-only news links resolve all five squad actualites subpages, not generic media',()=>{
 for(const team of CLUB_TEAMS)
  assert.equal(teamNewsRoute(team.code),teamSubpageRoute(team,'actualites'));
 assert.throws(()=>teamNewsRoute('made-up'),/Équipe inconnue/);
 assert.doesNotMatch(src('team-profile-data.mjs'),/teamDeepLink\('actualites',teamCode\)/);
 assert.match(src('team-profile-data.mjs'),/link.href=teamNewsRoute\(teamCode\)/);
});

test('public roster fetch failure is not presented as zero registered players or coaches',async()=>{
 const team=CLUB_TEAMS.find(t=>t.code==='a');
 const fetcher=async url=>{
  if(url.includes('/club_teams?'))return {ok:true,json:async()=>[{
   id:'test-team-uuid',code:team.code,discipline:team.discipline
  }]};
  if(url.includes('/team_public_people?'))return {ok:false};
  throw new Error('Unexpected endpoint '+url);
 };
 const result=await loadTeamPublicExtras(team.code,{onlyPeople:true,fetcher});
 assert.equal(result.configured,true);
 assert.deepEqual(result.errors,['people']);
 assert.deepEqual(result.people,[]);
 const code=src('team-profile-data.mjs');
 assert.match(code,/if\(!unavailable\)groupedPlayers\(root,data.people\)/);
 assert.match(code,/const warn=element\('p','team-extras-notice','L’annuaire public est temporairement indisponible\.'\)/);
 assert.match(code,/if\(view!=='players'\)/);
});

test('hidden coach controls stay visually hidden under the custom flex styles',()=>{
 const css=src('team-profile-data.css');
 assert.match(css,/\.team-affiliated-reload\[hidden\]\{display:none!important\}/);
});

test('staff roster retries expired login, refreshes empty memberships and clears private form on rights loss',async()=>{
 const previous=globalThis.document;
 const root=fakeElement('div');
 globalThis.document={createElement:fakeElement,getElementById:id=>
  id==='team-affiliated-roster-root'?root:null};
 const team=CLUB_TEAMS.find(t=>t.code==='a');
 const state={authRequests:0,teamQueries:0,listQueries:0,record:[]};
 const api={
  auth:{getUser:async()=>{
    state.authRequests++;
    if(state.authRequests===1||state.authRequests===4)
     return {error:{message:'expired'},data:{user:null}};
    return {error:null,data:{user:{id:'test-coach-uuid'}}};
  }},
  from(table){
   assert.equal(table,'club_teams');
   state.teamQueries++;
   const chain={select(){return chain;},eq(){return chain;},limit(){
    return Promise.resolve({error:null,data:[{id:'team-a-uuid',code:'a',discipline:'football'}]});
   }};
   return chain;
  },
  rpc:async(name,params)=>{
   assert.equal(name,'staff_list_affiliated_players');
   assert.equal(params.p_team_id,'team-a-uuid');
   state.listQueries++;
   return {error:null,data:state.record};
  }
 };
 try{
  mountTeamAffiliatedRoster(team,async()=>api);
  const details=root.children[0],panel=details.children[1];
  const retry=panel.children.find(c=>c.textContent==='Réessayer la vérification');
  const refresh=panel.children.find(c=>c.textContent==='Actualiser les affiliations');
  assert.ok(retry&&refresh);
  assert.equal(state.authRequests,0,'public visitor must not trigger private reads');
  details.open=true;details.listeners.toggle();
  await wait();
  assert.equal(state.authRequests,1);
  assert.equal(state.teamQueries,0);
  assert.equal(retry.hidden,false,'failed login should provide retry');
  assert.equal(refresh.hidden,true);
  assert.equal(panel.querySelector('form'),null);
  retry.click();
  await wait();
  assert.equal(state.authRequests,2);
  assert.equal(state.listQueries,1);
  assert.equal(retry.hidden,true);
  assert.equal(refresh.hidden,false,'even empty team should offer refresh');
  assert.equal(panel.querySelector('form'),null);
  state.record=[{player_user_id:'player-uuid',display_name:'Nom Autorisé',
    position_group:null,shirt_number:null,updated_at:null}];
  refresh.click();
  await wait();
  assert.equal(state.authRequests,3);
  assert.equal(state.listQueries,2);
  assert.ok(panel.querySelector('form'),'newly affiliated player must become editable after refresh');
  refresh.click();
  await wait();
  assert.equal(state.authRequests,4);
  assert.equal(panel.querySelector('form'),null,'permission loss must hide stale private form');
  assert.equal(refresh.hidden,true);
  assert.equal(retry.hidden,false);
  assert.ok(panel.querySelector('.team-affiliated-account-link'));
  assert.equal(state.listQueries,2,'must not read private team list if auth expired');
 }finally{
  unmountTeamAffiliatedRoster();
  if(previous===undefined)delete globalThis.document;else globalThis.document=previous;
 }
});
