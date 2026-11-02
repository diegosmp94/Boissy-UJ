/**
 * Step 64: honest Go/No-Go evidence for the FULL Boissy-UJ product.
 *
 * No network calls, user data or privileged credentials. An HTTP check can
 * validate published static files but never certify RGPD, RLS, Auth, ticketing
 * or actual device accessibility. Open critical workstreams block full launch.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ACTIVE_WORKSTREAMS,workstreamCounts} from '../open-workstreams.mjs';

export function assessBoissyFullLaunch(evidence=null,workstreams=ACTIVE_WORKSTREAMS){
 if(!Array.isArray(workstreams)||workstreams.some(x=>!x?.priority||!x?.id))
  throw Error('Invalid open-workstreams inventory');
 const c=workstreamCounts(workstreams);
 // The public smoke verifies these 14 essential resources. A report with
 // duplicated checks must never be mistaken for complete release evidence.
 const requiredAssets=[
  'index.html','app.js','styles.css','club-teams.mjs','auth.mjs',
  'sport-center.mjs','media-center.mjs','home-next-match.mjs',
  'premium-front.css','site-maintenance-config.mjs','site-entry.mjs',
  'maintenance.html','release.json','robots.txt'
 ];
 const checks=evidence?.checks;
 const checksComplete=Array.isArray(checks)&&
  checks.length>=requiredAssets.length&&
  checks.every(item=>item&&typeof item.check==='string'&&item.passed===true)&&
  new Set(checks.map(item=>item.check)).size===checks.length&&
  requiredAssets.every(name=>checks.some(item=>item.check===name));
 const publicHttpVerified=evidence?.scope==='anonymous public HTTP only'&&
  evidence?.passed===true&&evidence.mainRevisionVerified===true&&
  /^[0-9a-f]{40}$/.test(String(evidence.commitExpected||''))&&
  evidence.publicAssetsChecked===checks?.length&&
  evidence.publicAssetsPassed===checks?.length&&
  checksComplete;
 const blockers=workstreams.map(item=>Object.freeze({
  id:item.id,priority:item.priority,dependency:item.dependency
 }));
 return Object.freeze({
  scope:'full-product-release',
  status:c.total===0&&publicHttpVerified?'requires-human-signoff':'not-homologated',
  fullProductCertified:false, // human sign-off is never a CI side effect
  publicHttpVerified:Boolean(publicHttpVerified),
  actualMemberFlowsCertified:false,
  legalApprovalCertified:false,
  iPhoneAndroidPhysicalDevicesCertified:false,
  dataRestoreCertified:false,
  openWorkstreams:c.total,
  openPriorities:c,
  pending:Object.freeze(blockers),
  approval:'Official club sign-off plus independently archived device, Auth/RLS, legal and recovery evidence are required'
 });
}
async function main(){
 const folder=resolve(process.cwd(),'smoke-artifacts');
 let http=null;
 try{http=JSON.parse(await readFile(join(folder,'live-public-report.json'),'utf8'));}
 catch{http=null;}
 const result=assessBoissyFullLaunch(http);
 await mkdir(folder,{recursive:true});
 await writeFile(join(folder,'production-readiness.json'),
  JSON.stringify(result,null,2)+'\n');
 console.log('HTTP publication verified against main: '+result.publicHttpVerified);
 console.log('Full Boissy-UJ homologation: '+result.status+
  ' ('+result.openWorkstreams+' open workstreams, including '+
   result.openPriorities.p1+' P1)');
 if(result.status!=='requires-human-signoff')
  console.log('NO-GO for full product launch; public technical proof is a separate check.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(()=>{
  console.error('BLOCKED: cannot produce a reliable publication acceptance report.');
  process.exitCode=1;
 });
}
