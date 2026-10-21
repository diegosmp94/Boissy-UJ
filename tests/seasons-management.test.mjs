import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSeason,loadPublicSeasons} from '../season-workspace.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610210010_admin_season_management.sql');
const staff=read('staff-workflows.mjs');
const season=read('season-workspace.mjs');
const css=read('styles.css');
const baseline={label:'2026/2027',status:'planned',start:'2026-08-01',end:'2027-06-30'};
test('frontend season validation checks label, dates and state',()=>{
 assert.equal(validateSeason(baseline).valid,true);
 assert.equal(validateSeason({...baseline,label:'2026/2028'}).valid,false);
 assert.equal(validateSeason({...baseline,status:'superadmin'}).valid,false);
 assert.equal(validateSeason({...baseline,end:'2026-06-30'}).valid,false);
 assert.equal(validateSeason({...baseline,start:'2025-08-01'}).valid,false);
 assert.equal(validateSeason({...baseline,end:''}).valid,false);
 assert.equal(validateSeason({...baseline,label:'2026'}).valid,false);
});
test('only MFA-verified administrators can call protected season mutation',()=>{
 assert.match(sql,/v_actor uuid := \(select auth\.uid\(\)\)/);
 assert.match(sql,/if v_actor is null then/);
 assert.match(sql,/app_private\.is_admin\(\)/);
 assert.match(sql,/Administrator MFA required/);
 assert.match(sql,/security definer set search_path = ''/);
 assert.match(sql,/grant execute on function public\.admin_save_season/);
 assert.match(sql,/revoke all on function public\.admin_save_season/);
});
test('season mutation audits changes, checks dates and prevents active duplicates',()=>{
 assert.match(sql,/create table if not exists app_private\.season_change_log/);
 assert.match(sql,/alter table app_private\.season_change_log enable row level security/);
 assert.match(sql,/revoke all on app_private\.season_change_log from public, anon, authenticated/);
 assert.match(sql,/create unique index if not exists club_seasons_one_active_idx/);
 assert.match(sql,/insert into app_private\.season_change_log/);
 assert.match(sql,/to_jsonb\(v_existing\)/);
 assert.match(sql,/to_jsonb\(v_record\)/);
 assert.match(sql,/Cannot relabel season with fixtures/);
 assert.doesNotMatch(sql,/insert into public\.club_seasons\(label|values\('2026\/2027'/i);
});
test('Control Center season editor is preview-only with public GET for real rows',()=>{
 assert.match(staff,/mountSeasonPreview\(root\)/);
 assert.match(season,/Aucune saison créée ou modifiée dans Supabase/);
 assert.match(season,/Aucune saison configurée pour le moment/);
 assert.match(season,/textContent=String\(content\)/);
 assert.match(season,/method:'GET'/);
 assert.doesNotMatch(season,/\.rpc\(|\.insert\(|\.update\(|method:'POST'|localStorage|innerHTML\s*=/);
 assert.match(css,/\.staff-seasons/);
});
test('read-only season lookup requests only public fields',async()=>{
 let called=null;
 const mock=async(url,options)=>{
   called={url,options};
   return {ok:true,json:async()=>[{id:'sample',label:'2026/2027',state:'planned',starts_on:'2026-08-01',ends_on:'2027-06-30'}]};
 };
 const result=await loadPublicSeasons(undefined,mock);
 assert.equal(result.length,1);
 assert.match(called.url,/\/rest\/v1\/club_seasons\?/);
 assert.match(called.url,/select=id%2Clabel%2Cstate%2Cstarts_on%2Cends_on/);
 assert.equal(called.options.method,'GET');
 assert.doesNotMatch(called.url,/actor_user_id|news_posts|profiles/);
});
