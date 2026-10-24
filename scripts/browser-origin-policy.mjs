/**
 * Anonymous Chromium navigation-network allowlist.
 *
 * Reads only origin strings from DevTools, NEVER full URLs or request bodies.
 * A newly introduced provider must be reviewed in code + legal notices first.
 * This is not a guarantee about real-user browsers or third-party CDN code.
 */
const ALLOWED_PUBLIC_ORIGINS=Object.freeze([
 'https://cdn.jsdelivr.net',
 'https://dahzewvbybujqhogumte.supabase.co'
]);
export const publicOriginAllowlist=ALLOWED_PUBLIC_ORIGINS;
export function assessAnonymousPublicOrigins(values){
 if(!Array.isArray(values)||values.some(x=>typeof x!=='string'))
  throw new Error('Anonymous origin inventory must contain strings only.');
 const origins=[...new Set(values)];
 const allowed=new Set(ALLOWED_PUBLIC_ORIGINS);
 const blocked=[];
 for(const origin of origins){
  let parsed;
  try{parsed=new URL(origin);}catch{blocked.push('[invalid-origin]');continue;}
  if(parsed.origin!==origin||!allowed.has(origin)||
    parsed.protocol!=='https:')blocked.push(parsed.origin||'[invalid-origin]');
 }
 return Object.freeze({
  reviewedOrigins:Object.freeze(origins.sort()),
  unreviewedOrigins:Object.freeze(blocked.sort()),
  passed:blocked.length===0,
  containsPersonalData:false,
  realDeviceAudit:false
 });
}
