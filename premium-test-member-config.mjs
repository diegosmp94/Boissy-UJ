import {supabaseConfig} from './auth-config.mjs';
/**
 * Production remains READ-ONLY. An isolated staging deployment must explicitly
 * replace this public, non-secret configuration after security approval.
 */
export const premiumTestMemberConfig=Object.freeze({
 enabled:false,projectRef:'',origin:''
});
export function canUseTestPremiumManagement(
 settings=premiumTestMemberConfig,
 location=typeof window==='undefined'?null:window.location,
 supabase=supabaseConfig
){
 if(!settings?.enabled||typeof settings.projectRef!=='string'||
    !/^[a-z0-9]{20}$/.test(settings.projectRef)||
    settings.projectRef==='dahzewvbybujqhogumte'||
    typeof settings.origin!=='string'||
    settings.origin!==location?.origin||!settings.origin.startsWith('https://')||
    supabase?.url!=='https://'+settings.projectRef+'.supabase.co')
  return false;
 return true;
}
