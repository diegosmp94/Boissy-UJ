/** Defensive operational diagnostics. Never accepts raw logs or personal rows. */
export const OPS_CHECKS=Object.freeze({
 media_purge_delayed:'Purges médias en retard (> 2 h)',
 privacy_overdue:'Demandes RGPD hors délai',
 privacy_due_soon:'Demandes RGPD proches de leur échéance (< 7 jours)',
 role_review_delayed:'Demandes de rôle non traitées depuis 7 jours',
 event_booking_expired:'Réservations encore ouvertes après l’événement',
 event_windows_expired:'Créneaux programmés après leur fin',
 awards_expired:'Scrutins non clôturés après la date prévue',
 media_unreviewed_visible:'Médias visibles sans droits vérifiés',
 retention_unapproved:'Conservations non approuvées par le club'
});
export const OPS_SERVICES=Object.freeze({
 postgres_rpc:'Base et diagnostic SQL',
 admin_mfa:'Droits administrateur MFA',
 public_site:'Site public',
 storage_api:'API Storage et objets',
 stripe_test:'Stripe TEST',
 fff_import:'Import fédéral',
 email_delivery:'Envoi des emails'
});
export const OPS_COMPONENTS=Object.freeze({
 authentication:'Authentification',admin_console:'Administration',
 media_purge:'Purge des médias',privacy_requests:'Dossiers RGPD',
 events:'Événements',awards:'Awards',sports_import:'Imports sportifs',
 web_public:'Site public',storage:'Storage',billing_test:'Billetterie TEST'
});
export const OPS_CATEGORIES=Object.freeze({
 timeout:'Délai dépassé',unavailable:'Service inaccessible',
 permission_denied:'Accès refusé',deferred_job:'Traitement en retard',
 inconsistent_state:'Données incohérentes',manual_review:'Vérification manuelle'
});
export const OPS_SEVERITIES=Object.freeze({low:'Faible',medium:'Modérée',high:'Élevée'});
export const OPS_RESOLUTIONS=Object.freeze({
 recovered:'Service rétabli',investigated:'Traitement vérifié',
 not_reproducible:'Non reproduit',superseded:'Remplacé par un autre incident'
});
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function safeOpsSnapshot(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||
  value.version!==1||value.scope!=='aggregates_only'||
  !Number.isFinite(Date.parse(value.checked_at))||
  !Array.isArray(value.checks)||value.checks.length!==Object.keys(OPS_CHECKS).length||
  !Array.isArray(value.incidents)||value.incidents.length>30||
  !value.services||typeof value.services!=='object'||
  !Number.isSafeInteger(value.open_incidents)||value.open_incidents<0||
  !Number.isSafeInteger(value.high_incidents)||value.high_incidents<0||
  value.high_incidents>value.open_incidents)return null;
 const codes=new Set(),checks=[];
 for(const c of value.checks){
  if(!c||!Object.hasOwn(OPS_CHECKS,c.code)||codes.has(c.code)||
   !Number.isSafeInteger(c.count)||c.count<0||
   !['ok','attention','review'].includes(c.state)||
   c.observed!=='database_now')return null;
  codes.add(c.code);
  checks.push({code:c.code,label:OPS_CHECKS[c.code],count:c.count,state:c.state});
 }
 const services={};
 for(const k of Object.keys(OPS_SERVICES)){
  const status=value.services[k];
  if(!['verified_now','not_checked'].includes(status))return null;
  services[k]=status;
 }
 const incidents=[];
 for(const i of value.incidents){
  if(!i||!ID.test(i.id)||
   !Object.hasOwn(OPS_COMPONENTS,i.component)||
   !Object.hasOwn(OPS_CATEGORIES,i.category)||
   !Object.hasOwn(OPS_SEVERITIES,i.severity)||
   !Number.isFinite(Date.parse(i.opened_at))||
   !(i.resolved_at===null||Number.isFinite(Date.parse(i.resolved_at)))||
   !(i.resolution===null||Object.hasOwn(OPS_RESOLUTIONS,i.resolution))||
   (i.resolved_at===null)!==(i.resolution===null))return null;
  incidents.push({id:i.id,component:i.component,category:i.category,
   severity:i.severity,openedAt:i.opened_at,resolvedAt:i.resolved_at,
   resolution:i.resolution});
 }
 return Object.freeze({checkedAt:value.checked_at,checks,services,incidents,
  openIncidents:value.open_incidents,highIncidents:value.high_incidents});
}
export function safeOpsReportInput(component,category,severity){
 return Object.hasOwn(OPS_COMPONENTS,component)&&
  Object.hasOwn(OPS_CATEGORIES,category)&&
  Object.hasOwn(OPS_SEVERITIES,severity);
}
export function safeOpsResolutionInput(id,reason,openedAt){
 return typeof id==='string'&&ID.test(id)&&
  Object.hasOwn(OPS_RESOLUTIONS,reason)&&
  Number.isFinite(Date.parse(openedAt));
}
