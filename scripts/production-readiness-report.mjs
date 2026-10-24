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
 const HTTP_MIN_ASSETS=11; // 9 public static files + release.json + robots.txt
 const publicHttpVerified=evidence?.scope==='anonymous public HTTP only'&&
  evidence?.passed===true&&evidence.mainRevisionVerified===true&&
  evidence.publicAssetsChecked>=HTTP_MIN_ASSETS&&
  evidence.publicAssetsChecked===evidence.publicAssetsPassed&&
  evidence.checks?.length===evidence.publicAssetsChecked&&
  evidence.checks.every(c=>c.passed===true);
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
