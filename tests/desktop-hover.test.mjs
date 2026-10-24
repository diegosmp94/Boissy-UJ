import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const script=read('app.js');
const begin=script.indexOf("const desktopHeaderGroups=[...document.querySelectorAll('.desktop-header-group')];");
const end=script.indexOf('function closeMenu(',begin);
const escapeStart=script.indexOf("document.addEventListener('keydown',e=>{",end);
const escapeEnd=script.indexOf("main.addEventListener('click'",escapeStart);

function environment(){
 const handlers={},docHandlers={};
 let doc;
 const groups=['team','competitions','club'].map(name=>{
  const listeners={},attrs={'aria-controls':name+'-panel'};
  const link={focus(){doc.activeElement=link;}};
  const trigger={attrs,
   getAttribute:key=>attrs[key]??null,
   setAttribute(key,val){attrs[key]=val;},
   focus(){doc.activeElement=trigger;listeners.focusin?.({target:trigger});},
   addEventListener(type,fn){(handlers[name+'-trigger']??={})[type]=fn;}
  };
  const panel={hidden:true,querySelector(selector){
   assert.equal(selector,'a');return link;
  }};
  const group={id:name,dataset:{},listeners,trigger,panel,link,
   contains(el){return [group,trigger,panel,link].includes(el);},
   querySelector(selector){
    if(selector==='.header-group-trigger')return trigger;
    if(selector==='#'+name+'-panel')return panel;
    if(selector==='.desktop-teams-submenu,.desktop-header-panel')return panel;
    return null;
   },
   addEventListener(type,fn){listeners[type]=fn;}
  };
  return group;
 });
 doc={activeElement:null,querySelectorAll(selector){
  assert.equal(selector,'.desktop-header-group');return groups;
 },addEventListener(type,fn){docHandlers[type]=fn;}};
 assert.ok(begin>0&&end>begin&&escapeStart>end&&escapeEnd>escapeStart);
 vm.runInNewContext(script.slice(begin,end)+'\n'+script.slice(escapeStart,escapeEnd),{
  document:doc,closeMenu(){},
 });
 return {groups,handlers,docHandlers,doc};
}

test('three header dropdowns are exclusive; hover, keyboard, touch and Escape work',()=>{
 const {groups,handlers,docHandlers,doc}=environment();
 const [teams,competitions,club]=groups;
 teams.listeners.pointerenter({pointerType:'mouse'});
 assert.equal(teams.panel.hidden,false);
 assert.equal(teams.trigger.attrs['aria-expanded'],'true');
 assert.equal(teams.dataset.open,'true');
 competitions.listeners.pointerenter({pointerType:'mouse'});
 assert.equal(teams.panel.hidden,true,'opening a second panel closes teams');
 assert.equal(competitions.panel.hidden,false);
 club.listeners.pointerenter({pointerType:'touch'});
 assert.equal(club.panel.hidden,true,'touch hover must not open menus');
 club.trigger.focus();
 assert.equal(club.panel.hidden,false);
 assert.equal(competitions.panel.hidden,true);
 docHandlers.keydown({key:'Escape'});
 assert.equal(club.panel.hidden,true);
 assert.equal(doc.activeElement,club.trigger,'Escape restores trigger focus');
 assert.equal(club.trigger.attrs['aria-expanded'],'false');
 club.listeners.pointerenter({pointerType:'mouse'});
 docHandlers.pointerdown({target:{}});
 assert.equal(club.panel.hidden,true,'outside pointer closes all menus');
 teams.listeners.pointerenter({pointerType:'mouse'});
 teams.listeners.pointerleave({pointerType:'mouse'});
 assert.equal(teams.panel.hidden,true);
});

test('click and ArrowDown expose usable menu links, selection closes the panel',()=>{
 const {groups,handlers,doc}=environment();
 const [,competition]=groups;
 handlers['competitions-trigger'].click();
 assert.equal(competition.panel.hidden,false);
 handlers['competitions-trigger'].keydown({key:'ArrowDown',preventDefault(){}});
 assert.equal(doc.activeElement,competition.link);
 competition.listeners.click({target:{closest:()=>({href:'#/matchs?competition=cup'})}});
 assert.equal(competition.panel.hidden,true);
 competition.listeners.focusin({});
 assert.equal(competition.panel.hidden,false);
 competition.listeners.focusout({relatedTarget:{}});
 assert.equal(competition.panel.hidden,true);
});
