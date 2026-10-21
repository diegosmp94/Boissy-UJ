import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterAdminRoster,rosterAdminTotals} from '../team-roster-admin.mjs';
import {validateTeamPersonDraft,canEditTeamPublicPeople} from '../team-person-editor.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const admin=read('team-person-editor.mjs'),directory=read('team-roster-admin.mjs');
const teams=[
 {id:'football-a',code:'a',name:'Seniors A'},
 {id:'football-b',code:'b',name:'Seniors B'},
 {id:'futsal-id',code:'futsal',name:'Boissy-UJ Futsal'}
];
const rows=[
 {id:'1',team_id:'football-a',display_name:'Émile Tests',role_label:'Milieu',
  sort_order:3,person_kind:'player',published:true},
 {id:'2',team_id:'football-a',display_name:'Alice Exemple',role_label:'Entraîneuse',
  sort_order:1,person_kind:'coach',published:false},
 {id:'3',team_id:'futsal-id',display_name:'Bruno Démo',role_label:'Gardien',
  sort_order:2,person_kind:'player',published:true},
 {id:'4',team_id:'football-b',display_name:'Clara Exemple',role_label:'Défenseure',
  sort_order:5,person_kind:'player',published:false},
 {id:'5',team_id:'secret-team',display_name:'Caché',role_label:'Membre',
  sort_order:1,person_kind:'player',published:true}
];
test('administrative summaries distinguish published and private drafts without fictional totals',()=>{
 assert.deepEqual(rosterAdminTotals([]),{total:0,published:0,drafts:0});
 assert.deepEqual(rosterAdminTotals(rows),{total:5,published:3,drafts:2});
});
test('team scoped filtering never returns another team or unknown teams',()=>{
 assert.deepEqual(filterAdminRoster(rows,teams,{teamCode:'a'}).map(x=>x.id),['2','1']);
 assert.deepEqual(filterAdminRoster(rows,teams,{teamCode:'futsal'}).map(x=>x.id),['3']);
 assert.deepEqual(filterAdminRoster(rows,teams,{teamCode:'does-not-exist'}),[]);
 assert.deepEqual(filterAdminRoster(rows,teams).map(x=>x.id),['2','1','4','3']);
});
test('publication status and accent-insensitive private search work together',()=>{
 assert.deepEqual(filterAdminRoster(rows,teams,{status:'draft'}).map(x=>x.id),['2','4']);
 assert.deepEqual(filterAdminRoster(rows,teams,{status:'published'}).map(x=>x.id),['1','3']);
 assert.deepEqual(filterAdminRoster(rows,teams,{query:'emile'}).map(x=>x.id),['1']);
 assert.deepEqual(filterAdminRoster(rows,teams,{query:'entraîneuse'}).map(x=>x.id),['2']);
 assert.deepEqual(filterAdminRoster(rows,teams,{teamCode:'a',status:'draft',query:'bruno'}),[]);
 assert.deepEqual(filterAdminRoster(rows,teams,{status:'restricted'}),[]);
});
test('admin directory never displays rows without recognized team mapping',()=>{
 assert.equal(filterAdminRoster(rows,teams).length,4);
 assert.deepEqual(filterAdminRoster(rows,[],{}),[]);
 assert.doesNotMatch(directory,/fetch\(|\.rpc\(|localStorage|sessionStorage|innerHTML\s*=/);
 assert.match(directory,/setAttribute\('aria-pressed'/);
 assert.match(directory,/textContent=counts.total/);
 assert.match(directory,/role','status'/);
});
test('real editor is MFA gated and separate from local demonstration',()=>{
 assert.match(read('auth-config.mjs'),/enabled:\s*false/);
 assert.match(admin,/if\(!supabaseConfig.enabled\|\|!container\?\.isConnected/);
 assert.match(admin,/if\(!await verifyAdmin\(api,userId\)/);
 assert.match(admin,/api.rpc\('admin_list_team_public_people'\)/);
 assert.match(admin,/api.rpc\('admin_save_team_public_person',args\)/);
 assert.match(admin,/const browser=mountAdminRosterDirectory\(directory/);
 assert.match(admin,/browser.update\(entries,teams,selected\(\)\?\.id\|\|null\)/);
 assert.equal(canEditTeamPublicPeople('same','same',['player','coach'],'aal2',true),false);
 assert.equal(canEditTeamPublicPeople('same','same',['admin'],'aal1',true),false);
});
test('withdraw control prepares, but never silently publishes or mutates server',()=>{
 assert.match(admin,/Préparer la dépublication/);
 assert.match(admin,/withdraw.hidden=selected\(\)\?\.published!==true/);
 assert.match(admin,/frameData.f.publish.checked=false/);
 assert.match(admin,/frameData.f.consent.checked=false/);
 assert.match(admin,/confirmation=null;frameData.draw\(\)/);
 assert.match(admin,/confirmation!==fingerprint/);
 assert.match(admin,/if\(!await verifyAdmin\(api,userId\)\)/);
 assert.match(admin,/result.error.code==='40001'/);
 assert.doesNotMatch(directory,/\.insert\(|\.update\(|\.delete\(|method:'POST'/);
});
test('server authorization SQL and editorial validation are unchanged',()=>{
 const sql=read('supabase/migrations/202610210020_team_public_people.sql');
 assert.match(sql,/using \(published=true and consent_confirmed=true\)/);
 assert.match(sql,/app_private\.is_admin\(\)/);
 assert.match(sql,/v_old\.updated_at/);
 assert.match(sql,/app_private\.team_public_people_audit/);
 const draft={teamCode:'a',personKind:'player',displayName:'Nom public',roleLabel:'Gardien',
  shirtNumber:'1',biography:'',sortOrder:'0',publish:false,consentConfirmed:false};
 assert.equal(validateTeamPersonDraft(draft).valid,true);
 assert.equal(validateTeamPersonDraft({...draft,publish:true}).valid,false);
 assert.equal(validateTeamPersonDraft({...draft,publish:true,consentConfirmed:true}).valid,true);
});
test('mobile responsive styling and editor refresh affordance are available',()=>{
 assert.match(read('index.html'),/team-roster-admin\.css/);
 assert.match(read('team-roster-admin.css'),/@media\(max-width:740px\)/);
 assert.match(read('team-roster-admin.css'),/@media\(max-width:420px\)/);
 assert.match(admin,/Actualiser les profils/);
 assert.match(admin,/refresh.addEventListener\('click'/);
 assert.match(admin,/frameData.action.disabled=false/);
});
