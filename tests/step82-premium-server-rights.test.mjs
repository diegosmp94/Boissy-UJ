import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 normalizePremiumStatus,premiumStatusText,mountMemberPremiumStatus,PREMIUM_STATUS_STATES
} from '../member-premium-status.mjs';

const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=file('supabase/migrations/202610260019_premium_server_entitlements.sql');
const member=file('member-premium-status.mjs');
const auth=file('auth.mjs');
const now=Date.parse('2026-10-26T15:00:00Z');
const end='2026-12-26T15:00:00.000Z';
test('statuses distinguish active, revoked, expired and future periods',()=>{
 assert.deepEqual(PREMIUM_STATUS_STATES,
  ['active','none','expired','revoked','upcoming','unverified']);
 assert.deepEqual(normalizePremiumStatus({state:'active',active:true,plan:'monthly',valid_until:end},now),
  {state:'active',active:true,plan:'monthly',valid_until:end});
 assert.equal(normalizePremiumStatus({state:'active',active:true,plan:'monthly',valid_until:end},
  Date.parse('2027-01-01T00:00:00Z')).state,'expired');
 for(const state of ['revoked','upcoming','expired']){
  assert.equal(normalizePremiumStatus({state,active:false,plan:'annual',valid_until:end},now).state,state);
 }
 assert.deepEqual(normalizePremiumStatus({state:'none',active:false,plan:null,valid_until:null}),
  {state:'none',active:false,plan:null,valid_until:null});
});
test('unknown or contradictory server payload never displays an active badge',()=>{
 for(const fake of [
  {state:'active',active:false,plan:'monthly',valid_until:end},
  {state:'active',active:true,plan:null,valid_until:end},
  {state:'active',active:true,plan:'monthly',valid_until:'bad'},
  {state:'paid',active:true,plan:'monthly',valid_until:end},
  {state:'none',active:true,plan:null,valid_until:null},
  {state:'none',active:false,plan:'annual',valid_until:end},
  null,[],
 ]){
  const result=normalizePremiumStatus(fake,now);
  assert.equal(result?.active===true,false);
  assert.doesNotMatch(premiumStatusText(result),/Premium actif/);
 }
 assert.match(premiumStatusText(null),/indisponible/);
 assert.match(premiumStatusText({state:'none'}),/Aucun droit/);
 assert.match(premiumStatusText({state:'active',plan:'annual',valid_until:end}),/12 mois/);
});
test('only a verified billing TEST source may be stored; multiple grants are independent',()=>{
 for(const source of [
  "source_kind='verified_stripe_test'",
  "source_reference text not null unique",
  "plan_kind text not null check (plan_kind in ('monthly','annual'))",
  "source_reference ~ '^in_",
  "source_reference ~ '^cs_test_",
  "check (valid_until>valid_from)",
  "revoked_at timestamptz",
  "verified_at<=now()",
  "g.revoked_at is null",
  "g.valid_from<=now() and now()<g.valid_until",
  "app_private.member_has_active_premium()",
  "app_private.premium_access_grants",
  "grant select,insert,update on app_private.premium_access_grants to service_role",
 ])assert.ok(sql.includes(source),source);
 assert.match(sql,/create table if not exists app_private\.premium_access_grants/);
 assert.match(sql,/user_id uuid not null references auth\.users\(id\)/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on app_private\.premium_access_grants from public,anon,authenticated/);
 assert.doesNotMatch(sql,/grant\s+(?:select|insert|update|delete)\s+on app_private\.premium_access_grants\s+to (?:anon|authenticated)/i);
 assert.doesNotMatch(sql,/insert into\s+app_private\.premium_access_grants|update\s+app_private\.premium_access_grants/i);
 assert.doesNotMatch(sql,/sk_live_|pk_live_|verified_stripe_live/i);
});
test('self-only SQL RPC uses auth.uid() and never exposes raw Stripe references',()=>{
 assert.match(sql,/create or replace function public\.member_my_premium_status\(\)/);
 assert.match(sql,/v_user uuid:=\(select auth\.uid\(\)\)/);
 assert.match(sql,/where g\.user_id=v_user/);
 assert.match(sql,/and u\.email_confirmed_at is not null/);
 assert.match(sql,/order by g\.valid_until desc/);
 assert.match(sql,/when v_latest\.revoked_at is not null then 'revoked'/);
 assert.match(sql,/when v_latest\.valid_from>v_now then 'upcoming'/);
 assert.match(sql,/revoke all on function public\.member_my_premium_status\(\)/);
 assert.match(sql,/grant execute on function public\.member_my_premium_status\(\) to authenticated/);
 assert.doesNotMatch(sql,/grant execute on function public\.member_my_premium_status\(\) to anon/);
 const functionBody=sql.split('create or replace function public.member_my_premium_status()')[1];
 assert.ok(functionBody);
 const projection=functionBody.split('$fn$;')[0];
 assert.doesNotMatch(projection,/jsonb_build_object\([^)]*(?:source_reference|checkout_id|customer_id)/);
 assert.doesNotMatch(projection,/select\s+\*\s+from\s+public\.profiles/);
});
test('Mon espace mounts only a read-only owner-scoped Supabase RPC',()=>{
 assert.match(auth,/mountMemberPremiumStatus\(account,api,user\.id/);
 assert.match(auth,/view===sessionViewGeneration&&root\.isConnected&&account\.isConnected/);
 assert.match(member,/api\.auth\.getUser\(\)/);
 assert.match(member,/user\.data\?\.user\?\.id!==expectedUserId/);
 assert.match(member,/api\.rpc\('member_my_premium_status'\)/);
 assert.doesNotMatch(member,/getSession\(|localStorage|sessionStorage|\.insert\(|\.upsert\(|service_role|secret|checkout\.sessions\.create/i);
});
