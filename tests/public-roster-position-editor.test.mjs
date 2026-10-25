import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 publicPositionForRole,canonicalPublicPlayerRole,validateTeamPersonDraft,
 mountTeamPeoplePreview
} from '../team-person-editor.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

function dom(){
 class Node {
  constructor(tag){
   this.tagName=tag.toUpperCase();this.children=[];this.listeners={};
   this.className='';this.hidden=false;this.value='';this.textContent='';
   this.classList={add:()=>{}};
  }
  append(...items){
   for(const item of items){
    this.children.push(item);item.parent=this;
    if(this.tagName==='SELECT'&&this.children.length===1)this.value=item.value;
   }
  }
  replaceChildren(...items){this.children=[];this.append(...items);}
  setAttribute(key,value){(this.attrs??={})[key]=value;}
  addEventListener(name,cb){(this.listeners[name]??=[]).push(cb);}
  dispatch(name){for(const fn of this.listeners[name]||[])fn({target:this,preventDefault(){}});}
  all(test){return [this,...this.children.flatMap(c=>c.all(test))].filter(test);}
 }
 return {document:{createElement:tag=>new Node(tag)},Node};
}
function withPreview(action){
 const old=globalThis.document,{document,Node}=dom();
 globalThis.document=document;
 try{return action(mountTeamPeoplePreview(new Node('section')));}
 finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
}

test('all public position choices use exactly the four canonical roster groups',()=>{
 assert.deepEqual([
  canonicalPublicPlayerRole('goalkeeper'),
  canonicalPublicPlayerRole('defender'),
  canonicalPublicPlayerRole('midfielder'),
  canonicalPublicPlayerRole('forward')
 ],['Gardien','Défenseur','Milieu','Attaquant']);
 for(const invalid of ['coach','','admin','other',null,undefined]){
  assert.equal(canonicalPublicPlayerRole(invalid),null);
 }
 for(const [role,group] of [
  ['gardien de but','goalkeeper'],
  ['Défenseur central','defender'],
  ['Milieu offensif','midfielder'],
  ['Ailier','forward']
 ])assert.equal(publicPositionForRole('player',role),group);
 assert.equal(publicPositionForRole('player','Inconnu'),null);
 assert.equal(publicPositionForRole('coach','Gardien'),null);
 assert.equal(publicPositionForRole('staff','Défenseur'),null);
});

test('public editor loads existing precise role without erasing it and guides explicit position selection',()=>{
 withPreview(view=>{
  const {f,preview}=view;
  assert.equal(f.position.value,'');
  assert.equal(f.position.required,undefined);
  assert.ok(!view.form.children.some(n=>n.tagName==='IMG'));
  const label=view.form.all(n=>n.tagName==='LABEL'&&n.textContent.includes('Catégorie du joueur'))[0];
  assert.ok(label);
  assert.equal(label.hidden,false);
  const names=f.position.children.map(x=>x.textContent);
  assert.deepEqual(names,['Choisir une catégorie…','Gardiens','Défenseurs','Milieux','Attaquants']);
  view.fill({
   team_id:'unmatched',person_kind:'player',
   display_name:'Exemple Public',role_label:'Défenseur latéral',
   shirt_number:5,sort_order:0,published:false
  });
  assert.equal(f.position.value,'defender');
  assert.equal(f.role.value,'Défenseur latéral','original detailed position must remain intact');
  assert.equal(f.number.value,'5');
  f.position.value='midfielder';f.position.dispatch('change');
  assert.equal(f.role.value,'Milieu','choosing a group should produce an unambiguous public label');
  assert.equal(view.values().roleLabel,'Milieu');
  f.role.value='Milieu récupérateur';f.role.dispatch('input');
  assert.equal(f.position.value,'midfielder','a precise recognisable role keeps its parent group');
  assert.equal(view.values().roleLabel,'Milieu récupérateur');
  f.role.value='Joueur polyvalent';f.role.dispatch('input');
  assert.equal(f.position.value,'');
  assert.ok(preview.all(n=>n.textContent.includes('À classer')).length,
   'admin sees an honest unclassified warning, never an invented group');
  assert.equal(view.values().publish,false);
  assert.equal(view.values().consentConfirmed,false);
 });
});

test('coaches and non-coaching staff never receive a player category automatically',()=>{
 withPreview(view=>{
  const {f}=view;
  f.kind.value='coach';f.kind.dispatch('change');
  const label=view.form.all(n=>n.tagName==='LABEL'&&n.textContent.includes('Catégorie du joueur'))[0];
  assert.equal(label.hidden,true);
  f.role.value='Entraîneur adjoint';f.role.dispatch('input');
  assert.equal(f.position.value,'');
  assert.equal(view.values().roleLabel,'Entraîneur adjoint');
  f.kind.value='staff';f.kind.dispatch('change');
  assert.equal(label.hidden,true);
  f.role.value='Préparateur physique';f.role.dispatch('input');
  assert.equal(f.position.value,'');
  assert.equal(view.values().roleLabel,'Préparateur physique');
 });
});

test('admin editor remains read-only in local preview and maintains publish/consent guard',()=>{
 const src=read('team-person-editor.mjs');
 const positions=read('player-position-groups.mjs');
 assert.match(src,/function canonicalPublicPlayerRole|export function canonicalPublicPlayerRole/);
 assert.match(src,/if\(v\.personKind==='player'&&!publicPositionForRole/);
 assert.match(src,/syncPublicPosition\(\)/);
 assert.match(src,/mountTeamPeoplePreview\(root\)/);
 assert.match(src,/form\.noValidate=true/);
 assert.match(src,/if\(!await verifyAdmin\(api,userId\)\)/);
 assert.match(src,/admin_save_team_public_person/);
 assert.ok(!src.includes('admin_list_team_coaches'));
 assert.ok(!src.includes('service_role'));
 assert.ok(!src.includes('.insert('));
 assert.match(positions,/goalkeeper/);
 assert.equal(validateTeamPersonDraft({
  teamCode:'a',personKind:'player',displayName:'Exemple Validé',
  roleLabel:'Gardien',shirtNumber:1,sortOrder:0,
  biography:'',publish:true,consentConfirmed:false
 }).valid,false);
});
