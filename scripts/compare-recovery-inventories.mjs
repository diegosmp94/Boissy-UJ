/** Compares two already-collected db-recovery-verification.sql metadata snapshots.
 * No network connections, no database writes, no personal rows, no secrets.
 * This validates consistency only; it NEVER performs or certifies a restore.
 */
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export const RECOVERY_KEYS=Object.freeze([
 'public_table_count','public_schema_fingerprint','rls_disabled_tables',
 'public_rls_policy_fingerprint','privileged_anon_rpcs',
 'user_roles_authenticated_can_write','user_roles_anon_can_write',
 'role_requests_authenticated_can_write_directly',
 'profiles_can_update_identity_or_timestamps','profiles_can_insert_timestamps',
 'profiles_can_update_display_name','profiles_can_insert_id_and_display_name',
 'auth_user_count','profile_count','role_count','club_team_count',
 'pending_or_reviewed_role_requests_count'
]);
const counts=new Set([
 'public_table_count','auth_user_count','profile_count','role_count',
 'club_team_count','pending_or_reviewed_role_requests_count'
]);
const fingerprints=new Set(['public_schema_fingerprint','public_rls_policy_fingerprint']);
const arrays=new Set(['rls_disabled_tables','privileged_anon_rpcs']);
const booleans=new Set(RECOVERY_KEYS.filter(x=>
 !counts.has(x)&&!fingerprints.has(x)&&!arrays.has(x)));
function normalized(value){
 if(value&&typeof value==='object'&&!Array.isArray(value)){
  if(Object.keys(value).length===1&&Object.hasOwn(value,'recovery_verification'))
   return value.recovery_verification;
  if(Array.isArray(value.rows)&&value.rows.length===1&&
    Object.hasOwn(value.rows[0]||{},'recovery_verification'))
   return value.rows[0].recovery_verification;
 }
 return value;
}
export function validateRecoverySnapshot(raw){
 const object=normalized(raw);
 if(!object||typeof object!=='object'||Array.isArray(object))
  throw new Error('Recovery snapshot must be a JSON object.');
 const keys=Object.keys(object).sort();
 if(JSON.stringify(keys)!==JSON.stringify([...RECOVERY_KEYS].sort()))
  throw new Error('Recovery snapshot has missing or unexpected fields.');
 for(const [key,value] of Object.entries(object)){
  if(counts.has(key)&&(!Number.isSafeInteger(value)||value<0))
   throw new Error('Recovery snapshot has an invalid aggregate count.');
  if(fingerprints.has(key)&&!(typeof value==='string'&&/^[a-f0-9]{32}$/.test(value)))
   throw new Error('Recovery snapshot has an invalid schema fingerprint.');
  if(arrays.has(key)&&(!Array.isArray(value)||value.some(x=>
    typeof x!=='string'||!/^[a-z][a-z0-9_]{0,62}$/.test(x))))
   throw new Error('Recovery snapshot has invalid table/function identifiers.');
  if(booleans.has(key)&&typeof value!=='boolean')
   throw new Error('Recovery snapshot has an invalid privilege flag.');
 }
 return object;
}
export function compareRecoverySnapshots(sourceRaw,destinationRaw){
 const source=validateRecoverySnapshot(sourceRaw);
 const restored=validateRecoverySnapshot(destinationRaw);
 const differences=RECOVERY_KEYS.filter(key=>
  JSON.stringify(arrays.has(key)?[...source[key]].sort():source[key])!==
  JSON.stringify(arrays.has(key)?[...restored[key]].sort():restored[key])
 );
 const unsafeFlags= [
  source.rls_disabled_tables.length>0,restored.rls_disabled_tables.length>0,
  source.privileged_anon_rpcs.length>0,restored.privileged_anon_rpcs.length>0,
  source.user_roles_authenticated_can_write,restored.user_roles_authenticated_can_write,
  source.user_roles_anon_can_write,restored.user_roles_anon_can_write,
  source.role_requests_authenticated_can_write_directly,
  restored.role_requests_authenticated_can_write_directly,
  source.profiles_can_update_identity_or_timestamps,
  restored.profiles_can_update_identity_or_timestamps,
  source.profiles_can_insert_timestamps,restored.profiles_can_insert_timestamps
 ];
 return Object.freeze({
  compatible:differences.length===0&&!unsafeFlags.some(Boolean),
  checked:RECOVERY_KEYS.length,
  differentKeys:differences,
  unsafeConfigurations:unsafeFlags.some(Boolean)
 });
}
export function formatRecoveryComparison(comparison){
 const {compatible,checked,differentKeys,unsafeConfigurations}=comparison;
 return [
  compatible?'PASS: inventaires compatibles.':'FAIL: inventaires incompatibles ou protection manquante.',
  'Champs agrégés comparés : '+checked+'.',
  'Nombre de champs différents : '+differentKeys.length+'.',
  'Champs différents : '+(differentKeys.length?differentKeys.join(', '):'aucun')+'.',
  'Indicateur de configuration non sécurisée : '+(unsafeConfigurations?'oui':'non')+'.',
  'Attention : une comparaison ne prouve ni le succès de la restauration, ni l’intégrité des fichiers, ni Storage/Auth, ni la conformité RGPD.'
 ].join('\n');
}
async function main(argv){
 if(argv.length!==2)throw new Error(
  'Usage: node scripts/compare-recovery-inventories.mjs <source.json> <restored.json> (two distinct files)'
 );
 const files=argv.map(file=>resolve(file));
 if(files[0]===files[1])throw new Error('Source and restored inventory paths must differ.');
 // Do not accept extra data: the validator rejects unknown keys, e.g. secrets or personal rows.
 const [a,b]=await Promise.all(files.map(async file=>{
  const content=await readFile(file,'utf8');
  if(content.length>40000)throw new Error('Recovery metadata inventory is unexpectedly large.');
  return JSON.parse(content);
 }));
 const result=compareRecoverySnapshots(a,b);
 console.log(formatRecoveryComparison(result));
 if(!result.compatible)process.exitCode=2;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 main(process.argv.slice(2)).catch(error=>{
  // Avoid printing file paths and raw input values.
  console.error('BLOCKED: recovery inventories are missing, malformed, or inaccessible.');
  process.exitCode=1;
 });
}
