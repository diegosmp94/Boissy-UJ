import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterPublicTeamPeople,filterTeamNews,validateTeamMetrics,loadTeamPublicExtras} from '../team-profile-data.mjs';
import {validateTeamPersonDraft,teamPersonRpcArgs,canEditTeamPublicPeople} from '../team-person-editor.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610210020_team_public_people.sql');
const app=read('app.js');
const root='uuid-a',now=Date.parse('2026-10-21T17:00:00Z');
const valid={teamCode:'a',personKind:'player',displayName:'Personne Exemple',roleLabel:'Gardien',
 shirtNumber:'1',biography:'Présentation publique autorisée.',sortOrder:'1',publish:false,consentConfirmed:false};
test('public directory excludes drafts, unreviewed identities, other team IDs and invalid types',()=>{
 const rows=[
  {id:'ok',team_id:root,display_name:'Nom validé',person_kind:'player',published:true,consent_confirmed:true,sort_order:2},
  {id:'draft',team_id:root,person_kind:'player',published:false,consent_confirmed:true},
  {id:'no-consent',team_id:root,person_kind:'player',published:true,consent_confirmed:false},
  {id:'other',team_id:'another-uuid',person_kind:'coach',published:true,consent_confirmed:true},
  {id:'bad-type',team_id:root,person_kind:'observer',published:true,consent_confirmed:true}
 ];
 assert.deepEqual(filterPublicTeamPeople(rows,root).map(x=>x.id),['ok']);
});
test('team news includes only consent-reviewed published public past items scoped to team',()=>{
 const base={team_id:root,status:'published',visibility:'public',consent_reviewed:true,published_at:'2026-10-10T12:00:00Z'};
 const items=[{...base,id:'good'},{...base,id:'other-team',team_id:'other'},
  {...base,id:'draft',status:'draft'},{...base,id:'no-review',consent_reviewed:false},
  {...base,id:'future',published_at:'2026-12-10T12:00:00Z'},
  {...base,id:'member-only',visibility:'members'}];
 assert.deepEqual(filterTeamNews(items,root,now).map(x=>x.id),['good']);
});
test('team stats validate totals, do not fabricate a table or a ranking',()=>{
 const correct={team_id:root,played:3,wins:1,draws:1,losses:1,goals_for:4,goals_against:5};
 assert.deepEqual(validateTeamMetrics([correct],root),correct);
 assert.equal(validateTeamMetrics([],root),null);
 assert.throws(()=>validateTeamMetrics([{...correct,wins:9}],root),/incohérent/);
 assert.throws(()=>validateTeamMetrics([{...correct,goals_for:-1}],root),/incohérent/);
});
test('team loader performs only read-only UUID-filtered public queries and scrubs unexpected data',async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  if(url.includes('/club_teams?'))return {ok:true,json:async()=>[{id:root,code:'a',discipline:'football'}]};
  if(url.includes('/team_public_people?'))return {ok:true,json:async()=>[
   {id:'good',team_id:root,display_name:'Public',person_kind:'coach',role_label:'Coach',
    published:true,consent_confirmed:true,sort_order:1},
   {id:'hidden',team_id:root,published:false,consent_confirmed:false,person_kind:'player'}]};
  if(url.includes('/team_form_summary?'))return {ok:true,json:async()=>[
    {team_id:root,played:1,wins:1,draws:0,losses:0,goals_for:1,goals_against:0}]};
  if(url.includes('/news_posts?'))return {ok:true,json:async()=>[
   {id:'news-ok',team_id:root,status:'published',visibility:'public',consent_reviewed:true,published_at:'2026-10-10T12:00:00Z'},
   {id:'news-bad',team_id:root,status:'draft',visibility:'public',consent_reviewed:true,published_at:'2026-10-10T12:00:00Z'}]};
  throw new Error('Unknown table');
 };
 const data=await loadTeamPublicExtras('a',{fetcher,now});
 assert.equal(data.configured,true);
 assert.equal(data.people.length,1);
 assert.equal(data.people[0].id,'good');
 assert.equal(data.metrics.played,1);
 assert.deepEqual(data.news.map(x=>x.id),['news-ok']);
 assert.deepEqual(data.errors,[]);
 assert.equal(calls.length,4);
 for(const call of calls){assert.equal(call.options.method,'GET');assert.doesNotMatch(call.url,/user_roles|profiles|app_private|team_player_memberships/);}
 for(const call of calls.slice(1))assert.ok(call.url.includes('team_id=eq.uuid-a'));
 assert.match(calls[1].url,/published=eq.true/);
 assert.match(calls[1].url,/consent_confirmed=eq.true/);
 assert.match(calls[3].url,/consent_reviewed=eq.true/);
 assert.match(calls[3].url,/status=eq.published/);
});
test('one unavailable source does not hide other independently verified team content',async()=>{
 const fetcher=async(url)=>{
  if(url.includes('/club_teams?'))return {ok:true,json:async()=>[{id:'futsal-uuid',code:'futsal',discipline:'futsal'}]};
  if(url.includes('/team_public_people?'))return {ok:false};
  if(url.includes('/team_form_summary?'))return {ok:true,json:async()=>[]};
  return {ok:true,json:async()=>[]};
 };
 const result=await loadTeamPublicExtras('futsal',{fetcher,now});
 assert.deepEqual(result.errors,['people']);
 assert.equal(result.metrics,null);
 assert.deepEqual(result.news,[]);
});
test('invalid and unmatched teams do not leak other team data',async()=>{
 const fetcher=async()=>({ok:true,json:async()=>[{id:'other',code:'a',discipline:'futsal'}]});
 await assert.rejects(loadTeamPublicExtras('none',{fetcher}),/Équipe inconnue/);
 assert.deepEqual(await loadTeamPublicExtras('a',{fetcher}),{configured:false,people:[],metrics:null,news:[],errors:[]});
});
test('admin draft validation and publication explicitly require verified rights',()=>{
 assert.equal(validateTeamPersonDraft(valid).valid,true);
 assert.equal(validateTeamPersonDraft({...valid,publish:true}).valid,false);
 assert.equal(validateTeamPersonDraft({...valid,publish:true,consentConfirmed:true}).valid,true);
 assert.equal(validateTeamPersonDraft({...valid,shirtNumber:'0'}).valid,false);
 assert.equal(validateTeamPersonDraft({...valid,personKind:'coach',shirtNumber:'10'}).valid,false);
 assert.equal(validateTeamPersonDraft({...valid,teamCode:'unknown'}).valid,false);
 assert.equal(validateTeamPersonDraft({...valid,displayName:'A'}).valid,false);
 assert.equal(validateTeamPersonDraft({...valid,sortOrder:'1.3'}).valid,false);
});
test('admin RPC arguments include both team scope and optimistic lock',()=>{
 const v=validateTeamPersonDraft({...valid,publish:true,consentConfirmed:true});
 const args=teamPersonRpcArgs(v,'uuid-a',{id:'existing',updated_at:'2026-10-21T12:00:00Z'});
 assert.equal(args.p_team_id,'uuid-a');
 assert.equal(args.p_id,'existing');
 assert.equal(args.p_expected_updated_at,'2026-10-21T12:00:00Z');
 assert.equal(args.p_consent_confirmed,true);
 assert.throws(()=>teamPersonRpcArgs(validateTeamPersonDraft({...valid,publish:true}),'uuid-a'));
});
test('admin UI refuses preview writes and requires real admin MFA verified identity',()=>{
 assert.equal(canEditTeamPublicPeople('same','same',['admin'],'aal2',true),true);
 for(const roles of [['player'],['coach'],[]])assert.equal(canEditTeamPublicPeople('same','same',roles,'aal2',true),false);
 assert.equal(canEditTeamPublicPeople('same','different',['admin'],'aal2',true),false);
 assert.equal(canEditTeamPublicPeople('same','same',['admin'],'aal1',true),false);
 assert.equal(canEditTeamPublicPeople('same','same',['admin'],'aal2',false),false);
 assert.match(read('control-center.mjs'),/mountTeamPeoplePreview\(preview\)/);
 assert.match(read('admin-center.mjs'),/mountAuthenticatedTeamPeopleEditor\(view,api,verified.userId\)/);
 assert.match(read('team-person-editor.mjs'),/if\(!supabaseConfig.adminEnabled/);
});
test('SQL RLS read-only public surface, consent requirement and authenticated MFA RPC',()=>{
 assert.match(sql,/team_people_publish_requires_consent check \(not published or consent_confirmed\)/);
 assert.match(sql,/alter table public.team_public_people enable row level security/);
 assert.match(sql,/revoke all on table public.team_public_people from public, anon, authenticated/);
 assert.match(sql,/grant select on table public.team_public_people to anon, authenticated/);
 assert.match(sql,/using \(published=true and consent_confirmed=true\)/);
 assert.match(sql,/app_private.is_admin\(\)/);
 assert.match(sql,/auth.uid\(\)/);
 assert.match(sql,/revoke all on function public.admin_save_team_public_person/);
 assert.match(sql,/grant execute on function public.admin_save_team_public_person/);
 assert.match(sql,/team_public_people_audit/);
 assert.match(sql,/p_expected_updated_at is distinct from v_old.updated_at/);
 assert.doesNotMatch(sql,/insert into public\.team_public_people[\s\S]*values\s*\(\s*'[^']+'/i);
});
test('each team subpage now contains sections for roster, coaching, metrics and club news',()=>{
 assert.match(app,/id="team-profile-extras"/);
 assert.match(app,/mountTeamPublicExtras\(activeTeam.code\)/);
 assert.match(app,/unmountTeamPublicExtras\(\)/);
 for(const section of ['Effectif','Encadrement','Bilan de l’équipe','Actualités de l’équipe'])assert.ok(read('team-profile-data.mjs').includes(section));
 assert.match(read('index.html'),/team-profile-data.css/);
 assert.match(read('team-profile-data.css'),/@media\(max-width:720px\)/);
 assert.doesNotMatch(read('team-profile-data.mjs'),/innerHTML\s*=/);
 assert.match(read('auth-config.mjs'),/adminEnabled:\s*true/);
});
