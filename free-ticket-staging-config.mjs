import {supabaseConfig} from './auth-config.mjs';

/** Never enable on public production; promote only on an isolated reviewed
 * staging site with a DIFFERENT Supabase project and HTTPS origin.
 */
export const FREE_TICKET_STAGING=Object.freeze({
 enabled:false,projectRef:'',origin:''
});
export function canUseFreeTickets(
 cfg=FREE_TICKET_STAGING,
 location=typeof window==='undefined'?null:window.location,
 supabase=supabaseConfig
){
 return cfg?.enabled===true&&
  typeof cfg.projectRef==='string'&&/^[a-z0-9]{20}$/.test(cfg.projectRef)&&
  cfg.projectRef!=='dahzewvbybujqhogumte'&&
  typeof cfg.origin==='string'&&cfg.origin.startsWith('https://')&&
  cfg.origin===location?.origin&&
  supabase?.url==='https://'+cfg.projectRef+'.supabase.co';
}
