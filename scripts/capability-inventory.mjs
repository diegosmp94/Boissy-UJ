/**
 * Boissy UJ — Step 66: reproducible OFFLINE inventory of repository capabilities
 * against a read-only, sanitized Supabase schema snapshot.
 *
 * Never connects to Supabase or declares a feature authorized for public use.
 * Historical Supabase migration names need not match repo SQL filenames.
 */
import {readFile,readdir} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const CAPABILITIES=Object.freeze([
 {id:'roles',label:'Comptes, cumuls et validation MFA',files:['auth.mjs','role-workflow.mjs','admin-role-moderation.mjs'],tables:['public.user_roles','public.role_requests'],rpc:['member_request_role','admin_decide_role_request','admin_revoke_member_role']},
 {id:'coaches',label:'Affectations entraîneurs',files:['admin-coach-teams.mjs'],tables:['public.staff_team_assignments'],rpc:['admin_list_team_coaches','admin_set_coach_team_assignment']},
 {id:'players',label:'Affectations joueurs',files:['admin-player-teams.mjs'],tables:['app_private.team_player_memberships'],rpc:['admin_list_team_players','admin_set_player_team_membership']},
 {id:'callups',label:'Convocations privées',files:['coach-callups.mjs','member-sports.mjs'],tables:['app_private.match_callups'],rpc:['staff_set_callup','player_my_callups','player_respond_callup']},
 {id:'sports',label:'Saisons et matchs',files:['admin-management.mjs','sport-center.mjs'],tables:['public.club_seasons','public.matches'],rpc:['admin_save_season','staff_save_match','admin_list_management_matches']},
 {id:'standings',label:'Classements',files:['league-standings.mjs','admin-league.mjs'],tables:['public.team_league_standings'],rpc:['admin_save_league_standings','admin_list_league_standings']},
 {id:'news',label:'Gestion des actualités',files:['media-center.mjs','admin-management.mjs'],tables:['public.news_posts'],rpc:['staff_save_news_article','admin_list_management_news']},
 {id:'events',label:'Catalogue événements gratuits',files:['events-center.mjs','admin-management.mjs'],tables:['public.club_events'],rpc:['admin_save_free_event','admin_list_free_events']},
 {id:'people',label:'Personnes publiables',files:['team-person-editor.mjs','team-pages.mjs'],tables:['public.team_public_people'],rpc:['admin_save_team_public_person','admin_list_team_public_people']},
 {id:'positions',label:'Postes sportifs privés',files:['team-affiliated-roster.mjs','player-position-groups.mjs'],tables:['app_private.team_player_positions'],rpc:['staff_set_affiliated_player_position']},
 {id:'reactions',label:'Réactions aux articles',files:['news-reactions.mjs'],migrations:['202610230001_member_news_reactions.sql'],tables:['public.news_reactions'],requiresApproval:true},
 {id:'media',label:'Galeries et fichiers approuvés',files:['news-media-gallery.mjs','admin-news-media.mjs'],migrations:['202610230002_verified_news_media_assets.sql'],tables:['public.news_media_assets','app_private.news_media_change_audit'],rpc:['admin_list_news_media','admin_save_news_media','admin_check_news_media_file'],buckets:['boissy-uj-approved'],requiresApproval:true},
 {id:'awards_voting',label:'Votes Awards Premium',files:['awards-center.mjs'],migrations:['202610230003_premium_awards_ballots.sql'],tables:['app_private.award_vote_entitlements','app_private.award_ballots'],rpc:['member_cast_award_vote','member_my_award_vote','member_withdraw_award_vote'],requiresApproval:true},
 {id:'stripe_test',label:'Stripe TEST',files:['supabase/functions/premium-stripe-test-checkout/index.ts','supabase/functions/premium-stripe-test-webhook/index.ts'],migrations:['202610230004_stripe_test_billing_webhook.sql'],tables:['app_private.premium_test_checkout_links','app_private.premium_test_webhook_receipts'],rpc:['billing_register_test_checkout','billing_apply_verified_test_event'],edges:['premium-stripe-test-checkout','premium-stripe-test-webhook'],requiresApproval:true},
 {id:'news_history',label:'Historique et restauration des actualités',files:['admin-news-revisions.mjs'],migrations:['202610230005_news_revision_restore.sql'],rpc:['admin_list_news_revisions','admin_restore_news_revision','admin_news_revisions_ready'],requiresApproval:true},
 {id:'free_tickets',label:'Billets gratuits avec QR',files:['admin-ticketing-readiness.mjs'],migrations:['202610240001_free_event_tickets_gated.sql'],tables:['app_private.free_ticketing_gate','app_private.free_event_tickets','app_private.free_event_ticket_audit'],rpc:['request_free_event_ticket','cancel_my_free_event_ticket','checkin_free_event_ticket'],requiresApproval:true}
].map(item=>Object.freeze(item)));

export function validateInventorySnapshot(snapshot){
 if(!snapshot||snapshot.schema_version!==1||
    !Number.isFinite(Date.parse(snapshot.observed_at))||
    typeof snapshot.project_ref!=='string'||
    !/^[a-z0-9]{20}$/.test(snapshot.project_ref))
   throw new Error('Invalid schema snapshot header.');
 for(const key of ['tables','rpc_functions','buckets','edge_functions','migration_history']){
  if(!Array.isArray(snapshot[key])||snapshot[key].some(v=>typeof v!=='string'||
       !/^[a-zA-Z_][\w.:-]{0,130}$/.test(v))||
     new Set(snapshot[key]).size!==snapshot[key].length)
   throw new Error('Invalid inventory snapshot field: '+key);
 }
 if(!Number.isInteger(snapshot.public_table_count)||snapshot.public_table_count<0||
    !Number.isInteger(snapshot.public_rls_count)||snapshot.public_rls_count<0||
    snapshot.public_rls_count>snapshot.public_table_count)
   throw new Error('Invalid public RLS inventory.');
 return snapshot;
}

export function reconcileCapabilities(snapshot,availablePaths,capabilities=CAPABILITIES){
 validateInventorySnapshot(snapshot);
 const paths=new Set(availablePaths);
 const tables=new Set(snapshot.tables);
 const rpc=new Set(snapshot.rpc_functions);
 const buckets=new Set(snapshot.buckets);
 const edges=new Set(snapshot.edge_functions);
 const results=capabilities.map(cap=>{
  const missingCode=(cap.files||[]).filter(f=>!paths.has(f));
  const missingSql=(cap.migrations||[]).filter(f=>!paths.has('supabase/migrations/'+f));
  const missingRuntime=[
   ...(cap.tables||[]).filter(t=>!tables.has(t)).map(t=>'table:'+t),
   ...(cap.rpc||[]).filter(f=>!rpc.has(f)).map(f=>'rpc:'+f),
   ...(cap.buckets||[]).filter(b=>!buckets.has(b)).map(b=>'bucket:'+b),
   ...(cap.edges||[]).filter(f=>!edges.has(f)).map(f=>'edge:'+f)
  ];
  const state=missingCode.length||missingSql.length?'source-incomplete':
   missingRuntime.length?(cap.requiresApproval?'prepared-not-deployed':'runtime-mismatch'):
   cap.requiresApproval?'deployed-awaiting-approval':'connected-schema-only';
  return {id:cap.id,label:cap.label,state,missingCode,missingSql,missingRuntime};
 });
 return {
  observed_at:snapshot.observed_at,
  scope:'inventory-only-no-real-user-test',
  publicRls:snapshot.public_rls_count+'/'+snapshot.public_table_count,
  historicalMigrationEntries:snapshot.migration_history.length,
  counts:{
   connected:results.filter(r=>r.state==='connected-schema-only').length,
   prepared:results.filter(r=>r.state==='prepared-not-deployed').length,
   awaitingApproval:results.filter(r=>r.state==='deployed-awaiting-approval').length,
   mismatch:results.filter(r=>r.state==='runtime-mismatch').length,
   missingSource:results.filter(r=>r.state==='source-incomplete').length
  },
  results
 };
}

export async function collectRepositoryPaths(root){
 const paths=new Set();
 async function walk(dir,prefix=''){
  for(const entry of await readdir(dir,{withFileTypes:true})){
   if(['.git','node_modules','dist','smoke-artifacts'].includes(entry.name))continue;
   const rel=prefix?prefix+'/'+entry.name:entry.name;
   if(entry.isDirectory())await walk(join(dir,entry.name),rel);
   else if(entry.isFile())paths.add(rel);
  }
 }
 await walk(root);
 return paths;
}

export async function createCapabilityReport(root,snapshot){
 const paths=await collectRepositoryPaths(root);
 return reconcileCapabilities(snapshot,paths);
}

async function main(){
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 const snapshot=JSON.parse(await readFile(join(root,'docs','inventaire-supabase-20261026.json'),'utf8'));
 const report=await createCapabilityReport(root,snapshot);
 const json=process.argv.includes('--json');
 if(json)console.log(JSON.stringify(report,null,2));
 else{
  console.log('Boissy UJ · INVENTAIRE SCHEMA · '+report.observed_at);
  console.log('Supabase public RLS: '+report.publicRls+
    ' · Historique de migrations: '+report.historicalMigrationEntries+' entrées (noms non corrélés automatiquement)');
  for(const row of report.results)
   console.log(row.id+' | '+row.state+
     (row.missingRuntime.length?' | '+row.missingRuntime.join(', '):'')+
     (row.missingCode.length||row.missingSql.length?' | sources manquantes: '+[...row.missingCode,...row.missingSql].join(', '):''));
  console.log('Aucun accès réseau, compte ou migration exécuté. Une présence SQL ne certifie PAS les droits utilisateur.');
 }
 if(report.counts.mismatch||report.counts.missingSource)process.exitCode=1;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))
 main().catch(()=>{console.error('Inventaire impossible : source ou snapshot invalide.');process.exitCode=1;});
