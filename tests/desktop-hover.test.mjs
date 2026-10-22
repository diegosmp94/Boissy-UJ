import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const script=read('app.js');
const begin=script.indexOf("const desktopTeamNav=$('#desktop-team-nav');");
const end=script.indexOf('function closeMenu(',begin);
const escapeStart=script.indexOf("document.addEventListener('keydown',e=>{",end);
const escapeEnd=script.indexOf("main.addEventListener('click'",escapeStart);

test('desktop mega-menu interaction opens on mouse hover, closes outside and works via keyboard',()=>{
 assert.ok(begin>0&&end>begin&&escapeStart>end&&escapeEnd>escapeStart);
 const handler={};
 const docHandler={};
 const attrs={};
 let doc;
 const menuLink={};
 const trigger={
  setAttribute(name,value){attrs[name]=value;},
  focus(){doc.activeElement=trigger;handler.focusin?.({target:trigger});}
 };
 const panel={hidden:true};
 const nav={
  dataset:{},
  contains(el){return [nav,trigger,panel,menuLink].includes(el);},
  addEventListener(type,fn){handler[type]=fn;}
 };
 const els={'#desktop-team-nav':nav,'#desktop-teams-trigger':trigger,'#desktop-teams-submenu':panel};
 doc={
  activeElement:null,
  addEventListener(type,fn){docHandler[type]=fn;}
 };
 vm.runInNewContext(script.slice(begin,end)+'\n'+script.slice(escapeStart,escapeEnd),{
  $:selector=>els[selector],
  document:doc,
  closeMenu(){}
 });
 handler.pointerenter({pointerType:'mouse'});
 assert.equal(panel.hidden,false);
 assert.equal(attrs['aria-expanded'],'true');
 assert.equal(nav.dataset.open,'true');
 handler.pointerleave({pointerType:'mouse'});
 assert.equal(panel.hidden,true);
 assert.equal(attrs['aria-expanded'],'false');
 handler.pointerenter({pointerType:'touch'});
 assert.equal(panel.hidden,true,'a touch pointer must not trigger a hover menu');
 doc.activeElement=trigger;
 handler.focusin({target:trigger});
 assert.equal(panel.hidden,false);
 handler.focusout({relatedTarget:{}});
 assert.equal(panel.hidden,true);
 handler.pointerenter({pointerType:'mouse'});
 docHandler.pointerdown({target:{}});
 assert.equal(panel.hidden,true,'outside click dismisses menu');
 handler.focusin({target:trigger});
 doc.activeElement=menuLink;
 docHandler.keydown({key:'Escape'});
 assert.equal(panel.hidden,true,'Escape closes the panel');
 assert.equal(doc.activeElement,trigger,'focus returns to the desktop teams link');
 assert.equal(attrs['aria-expanded'],'false','suppress focus re-open after Escape');
 handler.pointerenter({pointerType:'mouse'});
 handler.click({target:{closest(){return {href:'#/equipes/football'};}}});
 assert.equal(panel.hidden,true,'selecting a submenu link closes panel');
});
