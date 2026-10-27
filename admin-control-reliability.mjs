/**
 * Bounded, fail-closed checks for the private Control Center.
 * Pure helpers keep permission checks server-authoritative and testable.
 * No network calls until an explicit caller invokes the supplied function.
 */
import {withAuthDeadline,AUTH_SERVICE_DEADLINE_MS} from './auth-resilience.mjs';
import {canUseFreeTickets} from './free-ticket-staging-config.mjs';

/** Failure to contact Auth is never interpreted as an authorized admin. */
export async function boundedAdminStatus(readStatus,deadline=AUTH_SERVICE_DEADLINE_MS){
 try{
  const status=await withAuthDeadline(Promise.resolve().then(readStatus),deadline);
  if(status?.status==='admin'&&status?.level==='aal2'
      &&Array.isArray(status.roles)&&status.roles.includes('admin'))
   return status;
  // A malformed admin claim must never survive as "admin" for callers.
  if(status?.status==='admin'||!status)
   return {status:'unverified',roles:[],level:null};
  return status;
 }catch{
  return {status:'unverified',roles:[],level:null};
 }
}

/** A missing/slow optional backend must disable only its own navigation entry. */
export async function adminCapability(call,valid=Array.isArray,deadline=AUTH_SERVICE_DEADLINE_MS){
 try{
  const result=await withAuthDeadline(Promise.resolve().then(call),deadline);
  return Boolean(result&&!result.error&&valid(result.data));
 }catch{return false;}
}

/** Reads all optional module capabilities independently, in parallel. */
export async function adminCapabilities(api,deadline=AUTH_SERVICE_DEADLINE_MS){
 const [eventsReady,eventRulesReady,scannerReady,awardsReady,privacyReady,operationsReady,coachTeamsReady,mediaReady,newsRevisionsReady]=await Promise.all([
  adminCapability(()=>api.rpc('admin_list_free_events'),Array.isArray,deadline),
  adminCapability(()=>api.rpc('admin_list_advanced_events'),Array.isArray,deadline),
  canUseFreeTickets()?adminCapability(()=>api.rpc('admin_free_ticket_scan_status'),
   value=>value?.enabled===true&&value.mode==='staging_test_only',deadline):Promise.resolve(false),
  adminCapability(()=>api.rpc('admin_list_awards'),Array.isArray,deadline),
  adminCapability(()=>api.rpc('admin_list_privacy_requests'),Array.isArray,deadline),
  adminCapability(()=>api.rpc('admin_ops_snapshot'),
    x=>x?.version===1&&x.scope==='aggregates_only'&&Array.isArray(x.checks),deadline),
  (async()=>{
   try{
    const candidates=await withAuthDeadline(Promise.resolve().then(
     ()=>api.from('club_teams').select('id').limit(1)),deadline);
    const candidate=candidates?.data?.[0]?.id;
    if(candidates?.error||!candidate)return false;
    return adminCapability(
     ()=>api.rpc('admin_list_team_coaches',{p_team_id:candidate}),Array.isArray,deadline);
   }catch{return false;}
  })(),
  adminCapability(()=>api.rpc('admin_list_news_media'),Array.isArray,deadline),
  adminCapability(()=>api.rpc('admin_news_revisions_ready'),value=>value===true,deadline)
 ]);
 return {eventsReady,eventRulesReady,scannerReady,awardsReady,privacyReady,operationsReady,coachTeamsReady,mediaReady,newsRevisionsReady};
}

/** Public generic message. Never surface backend responses or PII. */
export function adminFailureLabel(kind){
 if(kind==='authorization')return 'Accès suspendu : droits administrateur ou MFA à renouveler.';
 if(kind==='module')return 'Le module est momentanément indisponible. Tu peux réessayer après vérification de la session.';
 return 'Service administratif temporairement indisponible. Aucune donnée privée n’a été conservée à l’écran.';
}
