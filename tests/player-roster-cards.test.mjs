import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderPublicPlayerRosterCard} from '../team-profile-data.mjs';

function stubDocument(){
 return {
  createElement(tag){
   return {tagName:tag.toUpperCase(),children:[],className:'',attributes:{},textContent:'',href:null,
    setAttribute(name,value){this.attributes[name]=String(value);},
    append(...children){this.children.push(...children);}
   };
  }
 };
}
const player={
 id:'51e41d5a-2c16-4955-9c12-b1ad8fe60a92',team_id:'team-id',
 person_kind:'player',display_name:'Camille Dupont',shirt_number:14,
 role_label:'Milieu défensif',biography:'Texte privé à ne pas afficher dans la carte.',
 published:true,consent_confirmed:true
};
function render(p){
 const previous=globalThis.document;
 globalThis.document=stubDocument();
 try{return renderPublicPlayerRosterCard(p);}
 finally{
  if(previous===undefined)delete globalThis.document;
  else globalThis.document=previous;
 }
}
function descendants(el){
 const list=[el];
 for(const child of el.children)list.push(...descendants(child));
 return list;
}

test('roster card shows only the real display name and number, not player details',()=>{
 const root=render(player),nodes=descendants(root);
 assert.equal(root.tagName,'A');
 assert.equal(root.href,'#/joueurs/'+player.id);
 assert.equal(root.attributes['aria-label'],'Voir la fiche de Camille Dupont');
 assert.equal(nodes.filter(n=>n.tagName==='H3').length,1);
 assert.equal(nodes.find(n=>n.tagName==='H3').textContent,'Camille Dupont');
 const displayed=nodes.map(n=>n.textContent).filter(Boolean).join(' | ');
 assert.match(displayed,/Camille Dupont/);
 assert.match(displayed,/14/);
 assert.doesNotMatch(displayed,/Milieu|Texte privé|Voir la fiche joueur|Âge|biographie/);
 assert.ok(nodes.some(n=>n.className==='team-extras-player-number'&&
  n.attributes['aria-label']==='Numéro de maillot 14'));
});

test('portrait is a neutral head silhouette and shirt number overlays it',()=>{
 const nodes=descendants(render(player));
 const portrait=nodes.find(n=>n.className==='team-extras-player-portrait');
 assert.equal(portrait.attributes.role,'img');
 assert.equal(portrait.attributes['aria-label'],'Photo du joueur non publiée');
 const icon=nodes.find(n=>n.className==='team-extras-player-silhouette');
 assert.ok(icon);
 assert.ok(icon.children.some(n=>n.className==='team-extras-player-head'));
 assert.ok(icon.children.some(n=>n.className==='team-extras-player-shoulders'));
 assert.ok(portrait.children.some(n=>n.className==='team-extras-player-number'));
 assert.ok(!nodes.some(n=>n.tagName==='IMG'),'never use a made-up image');
});

test('no invented number, invalid identifiers never link to someone else',()=>{
 const noNumber=render({...player,id:'not-a-uuid',shirt_number:null});
 assert.equal(noNumber.tagName,'ARTICLE');
 assert.equal(noNumber.href,null);
 const num=descendants(noNumber).find(n=>n.className==='team-extras-player-number');
 assert.equal(num.textContent,'—');
 assert.equal(num.attributes['aria-label'],'Numéro non communiqué');
 for(const value of [0,100,-1,1.5,'9',null]){
  assert.equal(descendants(render({...player,shirt_number:value}))
   .find(n=>n.className==='team-extras-player-number').textContent,'—');
 }
});

test('public loader remains consent-gated and no external photographs are fetched',()=>{
 const source=readFileSync(new URL('../team-profile-data.mjs',import.meta.url),'utf8');
 assert.match(source,/published:'eq.true',consent_confirmed:'eq.true'/);
 assert.match(source,/person\.published===true&&person\.consent_confirmed===true|p\.published===true&&p\.consent_confirmed===true/);
 assert.match(source,/groupedPlayers\(root,data\.people\)/);
 assert.match(source,/groupPublishedPlayers\(people\)/);
 assert.match(source,/grid\.append\(renderPublicPlayerRosterCard\(person\)\)/);
 assert.doesNotMatch(source,/method:'POST'|\.insert\(|\.upsert\(|innerHTML\s*=/);
});
test('photo-first grid adapts to phones, follows motion preferences',()=>{
 const css=readFileSync(new URL('../team-profile-data.css',import.meta.url),'utf8');
 assert.match(css,/\.team-extras-player-grid\{grid-template-columns:repeat\(4/);
 assert.match(css,/@media\(max-width:720px\)\{\.team-extras-player-grid\{grid-template-columns:repeat\(2/);
 assert.match(css,/\.team-extras-player-portrait\{position:relative/);
 assert.match(css,/\.team-extras-player-number\{position:absolute;z-index:2/);
 assert.match(css,/object-fit:cover|team-extras-player-silhouette/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
