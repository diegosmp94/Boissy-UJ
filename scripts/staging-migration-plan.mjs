/**
 * Offline inventory of staged P2 migration SQL. It reads only Git-tracked SQL,
 * does not connect to PostgreSQL, and intentionally does not apply migrations.
 * Production's Supabase migration versions differ from repository filenames:
 * reconcile against a clean staging schema before executing any DDL.
 */
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,resolve,dirname} from 'node:path';

export const STAGING_PROPOSED_MIGRATIONS=Object.freeze([
 {file:'202610230001_member_news_reactions.sql',group:'réactions'},
 {file:'202610230002_verified_news_media_assets.sql',group:'médias'},
 {file:'202610230003_premium_awards_ballots.sql',group:'Awards'},
 {file:'202610230004_stripe_test_billing_webhook.sql',group:'Stripe TEST'},
 {file:'202610230005_news_revision_restore.sql',group:'versions des actualités'}
]);
export const STAGING_SCHEMA_BLOCKERS=Object.freeze([
 'Existing production schema and history must be reconciled manually',
 'No member data, auth accounts, photos or storage files are to be copied into staging',
 'All five prepared P2 migrations require schema review and staging acceptance',
 'Stripe TEST functions must not be deployed to production',
 'Passing this offline inventory does not prove a migration runs successfully'
]);
const versionOf=file=>{
 const m=/^(\d{12,14})_[a-z0-9_]+\.sql$/.exec(file);
 return m?.[1]||null;
};
export function stageSqlFingerprint(content){
 if(typeof content!=='string'||content.length<100||content.length>500000)
  throw new Error('Invalid SQL migration contents.');
 // Do not confuse static structure checks with actual PostgreSQL SQL validation.
 if(!/\bbegin\s*;/i.test(content)||!/\bcommit\s*;/i.test(content))
  throw new Error('Prepared migration must declare its transaction boundaries.');
 return createHash('sha256').update(content,'utf8').digest('hex');
}
export function inspectStagingMigrationFiles(entries){
 if(!Array.isArray(entries)||!entries.every(e=>e&&
   typeof e.file==='string'&&typeof e.sql==='string'))
  throw new Error('Invalid migration inventory.');
 const allowed=new Map(STAGING_PROPOSED_MIGRATIONS.map(e=>[e.file,e]));
 const indexes=new Set(),result=[];
 for(const item of entries){
  if(!allowed.has(item.file)||indexes.has(item.file))
   throw new Error('Unexpected or repeated staged migration.');
  const version=versionOf(item.file);
  if(!version)throw new Error('Invalid staged migration filename.');
  indexes.add(item.file);
  result.push(Object.freeze({
   filename:item.file,group:allowed.get(item.file).group,
   version,sha256:stageSqlFingerprint(item.sql),status:'requires-staging-review'
  }));
 }
 if(result.length!==allowed.size||[...allowed.keys()].some(k=>!indexes.has(k)))
  throw new Error('Staging migration set is incomplete.');
 result.sort((a,b)=>a.version.localeCompare(b.version));
 if(result.map(e=>e.filename).join('|')!==
    STAGING_PROPOSED_MIGRATIONS.map(e=>e.file).join('|'))
  throw new Error('Staging migration order is unsafe.');
 return Object.freeze(result);
}
export async function loadStagingMigrationPlan(directory){
 const files=await readdir(directory);
 const entries=await Promise.all(STAGING_PROPOSED_MIGRATIONS.map(async({file})=>{
  if(!files.includes(file))throw new Error('A proposed migration is missing.');
  return {file,sql:await readFile(join(directory,file),'utf8')};
 }));
 return inspectStagingMigrationFiles(entries);
}
async function main(){
 const dir=resolve(dirname(fileURLToPath(import.meta.url)),
  '../supabase/migrations');
 const rows=await loadStagingMigrationPlan(dir);
 console.log('STAGING REVIEW ONLY: '+rows.length+' migrations require manual review.');
 for(const row of rows)
  console.log(row.filename+' | '+row.group+' | SHA-256 '+row.sha256);
 console.log('No SQL applied, no project created and no backup restored.');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 main().catch(()=>{
  console.error('BLOCKED: migration staging inventory is unavailable or malformed.');
  process.exitCode=1;
 });
}
