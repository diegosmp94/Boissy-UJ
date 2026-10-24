import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CLUB_TEAMS} from '../club-teams.mjs';
import {
 isPublicEducator,publicEducators,renderPublicEducatorCard,
 filterPublicTeamPeople
} from '../team-profile-data.mjs';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const approved={team_id:'team-1',published:true,consent_confirmed:true,sort_order:0};
const coach={...approved,id:'coach-uuid',display_name:'Camille Exemple',
 person_kind:'coach',role_label:'Entraîneur principal'};
const secondCoach={...coach,team_id:'team-2',role_label:'Entraîneur adjoint'};
const staffEducator={...approved,display_name:'Alex Exemple',person_kind:'staff',
 role_label:'Préparateur physique'};
const clubStaff={...approved,display_name:'Morgan Exemple',person_kind:'staff',
 role_label:'Responsable matériel'};

test('coach and authorized training staff are educators, non-coaching staff stays separate',()=>{
 assert.equal(isPublicEducator(coach),true);
 assert.equal(isPublicEducator(staffEducator),true);
 assert.equal(isPublicEducator({...staffEducator,role_label:'Assistant entraîneur'}),true);
 assert.equal(isPublicEducator({...staffEducator,role_label:'Éducateur adjoint'}),true);
 assert.equal(isPublicEducator(clubStaff),false);
 assert.equal(isPublicEducator({...coach,published:false}),false);
 assert.equal(isPublicEducator({...coach,consent_confirmed:false}),false);
 assert.equal(isPublicEducator({...staffEducator,consent_confirmed:false}),false);
 assert.equal(isPublicEducator({...coach,person_kind:'player'}),false);
 assert.equal(isPublicEducator(null),false);
 assert.deepEqual(publicEducators([coach,staffEducator,clubStaff,{...coach,published:false}])
  .map(p=>p.display_name),['Camille Exemple','Alex Exemple']);
});

test('five team roster routes share one educators section and each requires publication rights',()=>{
 assert.equal(CLUB_TEAMS.length,5);
 const source=src('team-profile-data.mjs');
 assert.match(source,/groupedPlayers\(root,data\.people\)/);
 const grouped=source.slice(source.indexOf('function groupedPlayers('));
 const order=['for(const position of PLAYER_POSITION_GROUPS)','educatorsSection(root,people)','if(approved.unclassified.length)'];
 for(let i=1;i<order.length;i++)assert.ok(grouped.indexOf(order[i-1])<grouped.indexOf(order[i]));
 assert.match(source,/section\.append\(element\('h2','','Éducateurs'\)\)/);
 assert.match(source,/if\(!items\.length\)grid\.append\(empty\('Aucun éducateur autorisé à la publication/);
 assert.match(source,/data\.people\.filter\(p=>p\.person_kind==='staff'&&!isPublicEducator\(p\)\)/);
 assert.match(source,/onlyPeople:view==='players'/);
 assert.match(source,/published:'eq.true',consent_confirmed:'eq.true'/);
 const filtered=filterPublicTeamPeople([coach,secondCoach], 'team-1');
 assert.deepEqual(publicEducators(filtered),[coach]);
 assert.equal(publicEducators(filterPublicTeamPeople([secondCoach],'team-1')).length,0);
});

function fakeDocument(){
 return {createElement:tag=>({
  tagName:tag.toUpperCase(),className:'',textContent:'',attributes:{},children:[],
  setAttribute(name,value){this.attributes[name]=String(value);},
  append(...children){this.children.push(...children);}
 })};
}
function descendants(node){
 return [node,...node.children.flatMap(descendants)];
}
test('educator tile has neutral head portrait, name and actual role, but no invented photo or shirt number',()=>{
 const previous=globalThis.document;
 globalThis.document=fakeDocument();
 let nodes,card;
 try{card=renderPublicEducatorCard(coach);nodes=descendants(card);}
 finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
 assert.equal(card.tagName,'ARTICLE');
 assert.ok(card.className.includes('team-extras-educator-card'));
 const photo=nodes.find(n=>n.className.includes('team-extras-educator-portrait'));
 assert.ok(photo);
 assert.equal(photo.attributes.role,'img');
 assert.equal(photo.attributes['aria-label'],'Photo de l’éducateur non publiée');
 assert.ok(nodes.some(n=>n.className==='team-extras-player-head'));
 assert.ok(nodes.some(n=>n.className==='team-extras-player-shoulders'));
 assert.ok(nodes.some(n=>n.className==='team-extras-educator-name'
  &&n.textContent==='Camille Exemple'));
 assert.ok(nodes.some(n=>n.className==='team-extras-educator-function'
  &&n.textContent==='Entraîneur principal'));
 assert.equal(nodes.filter(n=>n.tagName==='IMG'||n.className==='team-extras-player-number').length,0);
 assert.equal(card.href,undefined);
 assert.doesNotMatch(nodes.map(n=>n.textContent).join(' | '),/0 matchs|99|Poste fictif/);
});

test('educators appear in responsive grid without new private read or public write',()=>{
 const css=src('team-profile-data.css'),code=src('team-profile-data.mjs');
 assert.match(css,/\.team-extras-educator-grid\{grid-template-columns:repeat\(4/);
 assert.match(css,/@media\(max-width:720px\)\{\.team-extras-educator-grid\{grid-template-columns:repeat\(2/);
 assert.match(css,/\.team-extras-educator-portrait\{border-bottom/);
 assert.doesNotMatch(code,/innerHTML\s*=|service_role|sb_secret_|\.insert\(|\.upsert\(/);
 const admin=src('admin-coach-teams.mjs');
 assert.match(admin,/admin_set_coach_team_assignment/);
 assert.match(admin,/Affectations des entraîneurs aux équipes/);
 assert.match(src('supabase\/migrations\/202610220003_admin_coach_team_assignments.sql'),
  /administrator MFA|MFA AAL2|required/i);
});
