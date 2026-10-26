import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {combinePublishedAgenda,loadPublicAgenda,normalizeAgendaSearch} from '../agenda.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const future='2026-10-25T13:00:00+02:00';
const now=Date.parse('2026-10-21T12:00:00+02:00');
const team=[{id:'a',name:'Seniors A'}];
const matches=[
  {id:'m1',team_id:'a',opponent_name:'Club invité',scheduled_at:future,match_status:'scheduled',published:true,is_home:true},
  {id:'m2',team_id:'a',opponent_name:'Brouillon',scheduled_at:future,match_status:'scheduled',published:false},
  {id:'m3',team_id:'a',opponent_name:'Annulé',scheduled_at:future,match_status:'cancelled',published:true}
];
const events=[
  {id:'e1',title:'Assemblée publique',starts_at:'2026-10-26T12:00:00+02:00',published:true,access_kind:'public'},
  {id:'e2',title:'Contenu Premium',starts_at:future,published:true,access_kind:'premium'},
  {id:'e3',title:'Brouillon',starts_at:future,published:false,access_kind:'public'}
];

test('only verified public future matches and events are included',()=>{
  assert.deepEqual(combinePublishedAgenda(matches,events,team,{now}).map(x=>x.id),['m1','m3','e1']);
  assert.equal(combinePublishedAgenda(matches,events,team,{now,kind:'match'}).length,2);
  assert.equal(combinePublishedAgenda(matches,events,team,{now,kind:'event'}).length,1);
});
test('search normalizes accents and 7-day window is exact',()=>{
  assert.equal(normalizeAgendaSearch(' ÉQUIPE '),'equipe');
  assert.deepEqual(combinePublishedAgenda(matches,events,team,{now,period:'week',query:'invité'}).map(x=>x.id),['m1']);
  assert.equal(combinePublishedAgenda(matches,events,team,{now,query:'inexistant'}).length,0);
});
test('past events are filtered unless explicitly requested; ongoing events remain visible',()=>{
  const rows=[{id:'e4',title:'Événement en cours',starts_at:'2026-10-21T09:00:00+02:00',
    ends_at:'2026-10-21T15:00:00+02:00',published:true,access_kind:'public'},
  {id:'e5',title:'Ancien',starts_at:'2026-10-15T12:00:00+02:00',
    published:true,access_kind:'public'}];
  assert.deepEqual(combinePublishedAgenda([],rows,[],{now}).map(x=>x.id),['e4']);
  assert.equal(combinePublishedAgenda([],rows,[],{now,period:'all'}).length,2);
});
test('unverified dates or private catalogues never leak through merged agenda',()=>{
  const badMatch={...matches[0],id:'bad',scheduled_at:null};
  const badEvent={...events[0],id:'bad-event',starts_at:'not-a-date'};
  assert.equal(combinePublishedAgenda([badMatch],[badEvent],team,{now,period:'all'}).length,0);
});
test('fetch uses only read-only public REST catalogues and handles partial failures',async()=>{
  const requests=[];
  const fake=async(url,opts)=>{
    requests.push({url,opts});
    if(url.includes('club_events'))throw new Error('no network');
    return {ok:true,json:async()=>url.includes('club_teams')?team:matches};
  };
  const result=await loadPublicAgenda(undefined,fake);
  assert.equal(requests.length,3);
  assert.equal(result.matches.length,3);
  assert.equal(result.events.length,0);
  assert.deepEqual(result.unavailable,['club_events']);
  for(const {url,opts} of requests){
    assert.equal(opts.method,'GET');
    assert.match(url,/\/rest\/v1\/(matches|club_events|club_teams)\?/);
    assert.doesNotMatch(url,/auth\.users|profiles|role_requests|app_private/);
    assert.equal(opts.headers.Accept,'application/json');
  }
});
test('abort does not produce a usable response',async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(loadPublicAgenda(controller.signal,async()=>({
    ok:true,json:async()=>[]
  })),/annulée/);
});
test('route, navigation and DOM escaping are wired without write methods',()=>{
  const app=read('app.js'),html=read('index.html'),js=read('agenda.mjs');
  assert.match(app,/'\/agenda':agenda/);
  assert.match(app,/mountAgenda\(\)/);
  assert.match(html,/href="#\/agenda"/);
  assert.match(html,/agenda\.css/);
  assert.match(js,/textContent=String\(text\)/);
  assert.doesNotMatch(js,/innerHTML\s*=|method:'POST'|\.rpc\(/);
});
