import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 READINESS_CHECKS,MANUAL_RELEASE_GATES,
 checkResult,summarizeReadiness,readBackendReadiness
} from '../admin-readiness.mjs';
import {ADMIN_MODULES} from '../admin-center.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const moduleCode=read('admin-readiness.mjs'),center=read('admin-center.mjs');

const teams=Array.from({length:5},(_,i)=>({id:'team-'+i}));
function client({missing=[],fewerTeams=false,brokenRoles=false,throwAll=false}={}){
 const calls=[];
 const valid=data=>({data,error:null});
 const failure={data:null,error:{message:'Non accessible'}};
 const isMissing=name=>missing.includes(name);
 const limited=async table=>{
  calls.push('table:'+table);
  if(throwAll)throw new Error('Network offline');
  if(isMissing(table))return failure;
  if(table==='club_teams')return valid(fewerTeams?teams.slice(0,4):teams);
  if(table==='role_requests'&&brokenRoles)return failure;
  return valid([]);
 };
 const from=table=>({
  select:fields=>({
   limit:()=>limited(table),
   eq:()=>({limit:()=>limited(table)})
  })
 });
 const rpc=async(name,args)=>{
  calls.push('rpc:'+name);
  if(throwAll)throw new Error('Network offline');
  if(isMissing(name))return failure;
  if(name==='admin_list_team_coaches'){
   assert.equal(args.p_team_id,teams[0].id);
  }
  if(name==='admin_check_news_media_file'){
   assert.deepEqual(args,{p_kind:'photo',p_path:'diagnostic/fichier-absent.webp'});
   return valid(false);
  }
  return valid([]);
 };
 return {api:{from,rpc},calls};
}

test('readiness labels are unique, complete, and distinguish live probes from signoffs',()=>{
 assert.equal(READINESS_CHECKS.length,9);
 assert.equal(new Set(READINESS_CHECKS.map(x=>x.id)).size,9);
 assert.equal(MANUAL_RELEASE_GATES.length,5);
 assert.ok(MANUAL_RELEASE_GATES.some(x=>x.includes('Restauration')));
 assert.ok(MANUAL_RELEASE_GATES.some(x=>x.includes('plusieurs comptes')));
 assert.ok(MANUAL_RELEASE_GATES.some(x=>x.includes('RGPD')));
 assert.ok(ADMIN_MODULES.some(x=>x.id==='readiness'&&x.group==='Pilotage'));
});
test('summary counts access only, never claims a global completion score',()=>{
 assert.deepEqual(summarizeReadiness([
  {status:'accessible'},{status:'unverified'},{status:'accessible'}
 ]),{passed:2,total:3,unverified:1});
 assert.equal(checkResult({data:[],error:null},Array.isArray),'accessible');
 assert.equal(checkResult({data:null,error:null},Array.isArray),'unverified');
 assert.equal(checkResult({data:[],error:{message:'denied'}},Array.isArray),'unverified');
 assert.equal(checkResult(undefined,Array.isArray),'unverified');
});
test('a live admin can see seven working services and two missing media/reaction services',async()=>{
 const {api,calls}=client({missing:['news_reactions','admin_list_news_media']});
 const out=await readBackendReadiness(api);
 assert.equal(out.length,READINESS_CHECKS.length);
 assert.equal(summarizeReadiness(out).passed,7);
 assert.equal(out.find(x=>x.id==='reactions').status,'unverified');
 assert.equal(out.find(x=>x.id==='media').status,'unverified');
 assert.equal(out.find(x=>x.id==='media-preflight').status,'accessible');
 assert.ok(calls.includes('rpc:admin_list_team_coaches'));
 assert.ok(calls.includes('table:club_teams'));
});
test('no team data or network failure fails closed without fabricating readiness',async()=>{
 const fewer=await readBackendReadiness(client({fewerTeams:true}).api);
 assert.equal(fewer.find(x=>x.id==='teams').status,'unverified');
 assert.equal(fewer.find(x=>x.id==='coaches').status,'unverified');
 const broken=await readBackendReadiness(client({throwAll:true}).api);
 assert.equal(summarizeReadiness(broken).passed,0);
 assert.equal(summarizeReadiness(broken).unverified,9);
});
test('readiness is queried only after a verified MFA session and never renders private rows',()=>{
 assert.match(center,/case 'readiness':void mountAdminReadiness\(view,api,verified\.userId\)/);
 assert.match(center,/const check=await adminSessionStatus\(api,verified\.userId\)/);
 assert.match(moduleCode,/const verified=await adminSessionStatus\(api,userId\)/);
 assert.match(moduleCode,/if\(verified.status!=='admin'\)/);
 assert.match(moduleCode,/const check=await adminSessionStatus\(api,userId\)/);
 assert.match(moduleCode,/if\(check.status!=='admin'\)/);
 assert.match(moduleCode,/if\(!root\.isConnected\|\|id!==revision\)return/);
 assert.match(moduleCode,/Une erreur ou un accès refusé donne/);
 assert.doesNotMatch(moduleCode,/service_role|localStorage|innerHTML|JSON\.stringify\(result\.data\)/);
 assert.doesNotMatch(moduleCode,/select\('email|select\('display_name|user_metadata/);
 assert.match(moduleCode,/Une erreur ou un accès refusé donne « Non confirmé »/);
});
test('release blockers cannot become validated just because backend reads succeed',async()=>{
 const all=await readBackendReadiness(client().api);
 assert.deepEqual(summarizeReadiness(all),{passed:9,total:9,unverified:0});
 assert.match(moduleCode,/Aucune recette finale n’est déduite de ce total/);
 assert.match(moduleCode,/pas que les permissions multi-comptes, le RGPD ou une restauration sont homologués/);
});
