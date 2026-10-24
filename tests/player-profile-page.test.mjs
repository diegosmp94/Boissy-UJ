import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 isPublicPlayerId,playerPublicRoute,loadPublishedPlayerProfile,renderPublicPlayerProfile
} from '../player-profile-page.mjs';

const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const uid='51e41d5a-2c16-4955-9c12-b1ad8fe60a92';
const teamUid='32c74e33-f765-40ad-85c1-b1ba6f983272';
const person={id:uid,team_id:teamUid,display_name:'Joueur autorisé',
 person_kind:'player',role_label:'Milieu',shirt_number:8,
 biography:'Présentation validée par le club.',published:true,consent_confirmed:true};
const team={id:teamUid,code:'a',discipline:'football'};
function fetcherFor({people=[person],teams=[team],fail=null}={}){
 const calls=[];
 const fetcher=async(url,opts)=>{
  const table=url.includes('/team_public_people?')?'people':
   url.includes('/club_teams?')?'teams':'unknown';
  calls.push({table,url,opts});
  return fail===table?{ok:false,status:503}:
   {ok:true,json:async()=>table==='people'?people:teams};
 };
 return {fetcher,calls};
}

test('player route accepts only canonical UUIDs, never a name or query escape',()=>{
 assert.equal(isPublicPlayerId(uid),true);
 assert.equal(playerPublicRoute(uid),'#/joueurs/'+uid);
 for(const id of ['test','1','../admin','?password=123',
  '00000000-0000-0000-0000-000000000000','']){
  assert.equal(isPublicPlayerId(id),false);
  assert.throws(()=>playerPublicRoute(id),/invalide/);
 }
});

test('public player loader reads consented rows and known team via GET only',async()=>{
 const {fetcher,calls}=fetcherFor();
 const result=await loadPublishedPlayerProfile(uid,{fetcher});
 assert.deepEqual(result.person,person);
 assert.equal(result.team.name,'Seniors A');
 assert.equal(result.team.discipline,'football');
 assert.equal(calls.length,2);
 assert.match(calls[0].url,/team_public_people\?/);
 assert.match(calls[0].url,/published=eq.true/);
 assert.match(calls[0].url,/consent_confirmed=eq.true/);
 assert.match(calls[0].url,/person_kind=eq.player/);
 assert.match(calls[0].url,/id=eq./);
 assert.match(calls[1].url,/club_teams\?/);
 assert.ok(calls.every(c=>c.opts.method==='GET'&&c.opts.cache==='no-store'));
 assert.ok(calls.every(c=>c.opts.headers.apikey&&!/auth.users|profiles|user_roles|app_private/.test(c.url)));
});

test('unpublished, no-consent, coaches and unknown teams cannot render an individual player',async()=>{
 for(const patch of [{published:false},{consent_confirmed:false},{person_kind:'coach'}]){
  const {fetcher}=fetcherFor({people:[{...person,...patch}]});
  assert.equal(await loadPublishedPlayerProfile(uid,{fetcher}),null);
 }
 const {fetcher:badTeam}=fetcherFor({teams:[{...team,discipline:'futsal'}]});
 assert.equal(await loadPublishedPlayerProfile(uid,{fetcher:badTeam}),null);
 const {fetcher:missing}=fetcherFor({people:[]});
 assert.equal(await loadPublishedPlayerProfile(uid,{fetcher:missing}),null);
 const {fetcher:failing}=fetcherFor({fail:'people'});
 await assert.rejects(loadPublishedPlayerProfile(uid,{fetcher:failing}),/consultée/);
});

function domNode(tag='div',value=null){
 return {tag,children:[],className:'',href:null,attributes:{},textContent:value??'',
  setAttribute(key,val){this.attributes[key]=String(val);},
  append(...items){this.children.push(...items);},
  replaceChildren(...items){this.children=[...items];}
 };
}
function rendered(entry,{preview=false}={}){
 const previous=globalThis.document;
 globalThis.document={createElement:tag=>domNode(tag)};
 try{
  const root=domNode('root');
  renderPublicPlayerProfile(root,entry,{preview});
  const all=[];const visit=node=>{all.push(node);for(const child of node.children)visit(child);};
  visit(root);return all;
 }finally{
  if(previous===undefined)delete globalThis.document;
  else globalThis.document=previous;
 }
}

test('public preview shows photo slot, age, position and stats but no fictional person',()=>{
 const nodes=rendered(null,{preview:true});
 const content=nodes.map(n=>n.textContent).join(' | ');
 for(const field of ['PHOTO DU JOUEUR','APERÇU DU MODÈLE','Fiche joueur','Âge',
  'Poste','Statistiques individuelles','Matchs joués','Buts',
  'Passes décisives','Minutes jouées','Non publié','—']){
  assert.ok(content.includes(field),'Missing '+field);
 }
 assert.ok(nodes.some(n=>n.attributes.role==='status'));
 assert.ok(nodes.some(n=>n.attributes.role==='img'&&n.attributes['aria-label'].includes('non publiée')));
 assert.ok(nodes.some(n=>n.href==='#/equipes'));
 assert.doesNotMatch(content,/Prénom Nom|Martin Dupont|25 ans|12 buts/);
});

test('consented player uses real name/position/number and never fabricates age, photo or stats',()=>{
 const nodes=rendered({person,team:{code:'a',slug:'seniors-a',name:'Seniors A',division:'Départemental 3',discipline:'football'}});
 const content=nodes.map(n=>n.textContent).join(' | ');
 for(const real of ['Joueur autorisé','Milieu','Présentation validée par le club.','8','Seniors A']){
  assert.ok(content.includes(real),real);
 }
 assert.ok(content.includes('Non publié'));
 assert.ok(content.includes('Aucune statistique individuelle validée'));
 assert.ok(nodes.some(n=>n.href==='#/equipes/football/seniors-a'));
 assert.ok(!nodes.some(n=>n.className==='player-profile-preview-note'));
});

test('team pages link only verified published players and the preview is available without identities',()=>{
 const app=src('app.js'),teamModule=src('team-profile-data.mjs'),css=src('player-profile-page.css');
 assert.match(app,/isPublicPlayerId\(path\.slice\('\/joueurs\/'\.length\)\)/);
 assert.match(app,/path==='\/joueurs\/apercu'\|\|publicPlayerId/);
 assert.match(app,/mountPublicPlayerProfile\(publicPlayerId\)/);
 assert.match(teamModule,/person\.person_kind==='player'&&isPublicPlayerId\(person\.id\)/);
 assert.match(teamModule,/profile\.href=playerPublicRoute\(person\.id\)/);
 assert.match(teamModule,/demo\.href='#\/joueurs\/apercu'/);
 assert.match(src('index.html'),/player-profile-page\.css/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.doesNotMatch(src('player-profile-page.mjs'),/service_role|sb_secret_|\.insert\(|\.update\(|\.delete\(|method:'POST'|innerHTML/);
});
