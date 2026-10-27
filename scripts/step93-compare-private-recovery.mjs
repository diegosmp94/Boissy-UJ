/** Step 93: strict metadata-only inventory comparison for isolated restores.
 * No DB connection, no user rows, no PII or secrets printed.
 */
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export const METADATA_FIELDS=Object.freeze([
 'version','public_and_private_table_count','catalog_schema_sha256','policy_sha256',
 'no_rls_count','privileged_anon_rpc_count','auth_users','profiles',
 'storage_objects_metadata','news_media_assets','awards_ballots',
 'privacy_requests','privacy_steps'
]);
const NUMBERS=new Set(METADATA_FIELDS.filter(x=>!x.endsWith('_sha256')));
export function validateStep93Metadata(input){
 let x=input;
 if(x&&typeof x==='object'&&!Array.isArray(x)&&
  Object.keys(x).join()==='step93_recovery_metadata')x=x.step93_recovery_metadata;
 if(x&&typeof x==='object'&&Array.isArray(x.rows)&&x.rows.length===1)
  x=x.rows[0].step93_recovery_metadata;
 if(!x||typeof x!=='object'||Array.isArray(x)||
  Object.keys(x).sort().join()!==[...METADATA_FIELDS].sort().join())
  throw Error('Unexpected recovery metadata fields');
 for(const key of METADATA_FIELDS){
  const v=x[key];
  if(NUMBERS.has(key)){
   if(!Number.isSafeInteger(v)||v<0)
    throw Error('Invalid aggregate recovery metadata');
  }else if(typeof v!=='string'||!/^[0-9a-f]{64}$/.test(v))
   throw Error('Invalid metadata fingerprint');
 }
 if(x.version!==1)throw Error('Unsupported metadata version');
 return x;
}
export function compareStep93Metadata(source,target){
 const a=validateStep93Metadata(source),b=validateStep93Metadata(target);
 const different=METADATA_FIELDS.filter(k=>a[k]!==b[k]);
 const unsafe=a.no_rls_count!==0||b.no_rls_count!==0||
  a.privileged_anon_rpc_count!==0||b.privileged_anon_rpc_count!==0;
 return Object.freeze({
  compatible:!unsafe&&different.length===0,
  unsafe,checked:METADATA_FIELDS.length,differentKeys:different
 });
}
export function formatStep93MetadataDiff(x){
 return [
  x.compatible?'PASS: empreintes et totaux cohérents.':
   'FAIL: écarts ou configuration dangereuse.',
  'Champs agrégés contrôlés : '+x.checked,
  'Différences : '+(x.differentKeys.length?x.differentKeys.join(', '):'aucune'),
  'RLS ou accès RPC anonyme non sûr : '+(x.unsafe?'oui':'non'),
  'ATTENTION : les lignes réelles, les octets Storage, Auth/SMTP, Edge Functions et les accès utilisateurs ne sont pas vérifiés par ce rapport.'
 ].join('\n');
}
async function main(argv){
 if(argv.length!==2||resolve(argv[0])===resolve(argv[1]))
  throw Error('Two distinct metadata inventory paths required');
 const [a,b]=await Promise.all(argv.map(async path=>{
  const content=await readFile(path,'utf8');
  if(content.length>20000)throw Error('Metadata unexpectedly large');
  return JSON.parse(content);
 }));
 const result=compareStep93Metadata(a,b);
 console.log(formatStep93MetadataDiff(result));
 if(!result.compatible)process.exitCode=2;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 main(process.argv.slice(2)).catch(()=>{
  console.error('BLOCKED: invalid private metadata inventory; no values disclosed.');
  process.exitCode=1;
 });
}
