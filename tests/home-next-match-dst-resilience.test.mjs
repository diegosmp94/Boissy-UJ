import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 parisNextMidnight,nextUpcomingMatch,nextMatchRefreshDelay,
 renderHomeNextMatch
} from '../home-next-match.mjs';

const source=readFileSync(new URL('../home-next-match.mjs',import.meta.url),'utf8');
const dayOnly=(day)=>({
 id:'sourced',teamCode:'futsal',opponent:'Adversaire référencé',
 status:'scheduled',localDay:day,dateOnly:true,time:Date.parse(day+'T12:00:00Z'),
 is_home:true,published:false,clubConfirmed:false,sourceLabel:'Relevé de tiers'
});

for(const [day,expected] of [
 ['2026-10-24','2026-10-24T22:00:00.000Z'], // DST ends the NEXT day
 ['2027-03-27','2027-03-27T23:00:00.000Z'], // DST begins the NEXT day
 ['2027-03-28','2027-03-28T22:00:00.000Z'], // DST already changed
 ['2027-10-30','2027-10-30T22:00:00.000Z'],
 ['2027-10-31','2027-10-31T23:00:00.000Z'],
 ['2028-02-29','2028-02-29T23:00:00.000Z'] // valid leap date
]){
 test('date-only Paris midnight at DST/leap boundary '+day,()=>{
  const end=parisNextMidnight(day);
  assert.equal(new Date(end).toISOString(),expected);
  const match=dayOnly(day);
  assert.equal(nextUpcomingMatch([match],end-1),match);
  assert.equal(nextUpcomingMatch([match],end),null);
  assert.equal(nextMatchRefreshDelay([match],end-3000),4000);
 });
}

test('invalid ISO dates cannot be rolled forward into fictitious fixtures',()=>{
 for(const s of ['2026-02-30','2027-04-31','2026-13-01','2026-00-01',
  '2027-02-29','2027-6-02','1999-12-31','2101-01-01','bad-date','']){
  assert.ok(Number.isNaN(parisNextMidnight(s)),s);
  assert.equal(nextUpcomingMatch([dayOnly(s)],0),null);
 }
});

function mockNode(tag='div',value=''){
 return {
  tag,children:[],attributes:{},className:'',textContent:String(value),href:'',
  setAttribute(name,val){this.attributes[name]=String(val);},
  append(...nodes){this.children.push(...nodes);},
  replaceChildren(...nodes){this.children=[...nodes];}
 };
}
function mockRender(fixture,options){
 const previous=globalThis.document;
 globalThis.document={
  createElement:tag=>mockNode(tag),
  createTextNode:text=>mockNode('#text',text)
 };
 try{
  const root=mockNode('root');
  renderHomeNextMatch(root,fixture,options);
  const found=[];
  const walk=node=>{
   found.push(node);
   for(const child of node.children||[])walk(child);
  };
  walk(root);
  return found;
 }finally{
  if(previous===undefined)delete globalThis.document;
  else globalThis.document=previous;
 }
}

test('outage after a sourced fixture exists is announced, not concealed or certified',()=>{
 const item=dayOnly('2027-03-27');
 const live=mockRender(item,{dataUnavailable:false});
 const offline=mockRender(item,{dataUnavailable:true});
 assert.ok(!live.some(x=>x.className.includes('home-next-sync-warning')));
 assert.ok(offline.some(x=>x.className.includes('home-next-sync-warning')&&
  x.attributes.role==='status'&&x.textContent.includes('momentanément indisponible')));
 assert.ok(offline.some(x=>x.textContent==='Calendrier référencé · date et horaire à confirmer par le club'));
 assert.ok(offline.some(x=>x.href==='#/matchs'));
 assert.ok(offline.some(x=>x.href==='#/equipes/futsal/boissy-uj-futsal'));
});

test('when no match is known, empty schedule is distinct from unavailable publication service',()=>{
 const empty=mockRender(null,{dataUnavailable:false});
 const offline=mockRender(null,{dataUnavailable:true});
 assert.ok(empty.some(x=>x.textContent==='Aucune rencontre à venir connue pour le moment.'));
 assert.ok(offline.some(x=>x.textContent.startsWith('Programme momentanément indisponible.')));
});

test('home mount updates its offline flag on failure and on recovery without publishing anything',()=>{
 assert.match(source,/remoteUnavailable=true;lastSync=Date\.now\(\)/);
 assert.match(source,/remoteUnavailable=false;lastSync=Date\.now\(\)/);
 assert.match(source,/dataUnavailable:remoteUnavailable/);
 assert.match(source,/const deadline=boundedPublicRequest\(abort\.signal\)/);
 assert.match(source,/finally\{\s*deadline\.dispose\(\)/);
 assert.match(source,/NEXT_MATCH_REFRESH_MS=60\*60\*1000/);
 assert.doesNotMatch(source,/service_role|sb_secret_|method:'POST'|\.insert\(|\.upsert\(|\.delete\(|innerHTML\s*=/);
});
