import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizePremiumStatus,normalizePremiumRenewalStatus,premiumLifecycleText}
 from '../member-premium-status.mjs';
import {premiumTestMemberConfig,canUseTestPremiumManagement}
 from '../premium-test-member-config.mjs';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const sql=read('supabase/migrations/202610270003_step85_premium_renewal_management.sql');
const cancel=read('supabase/functions/premium-stripe-test-cancel/index.ts');
const config=read('supabase/config.toml');
const frontend=read('member-premium-status.mjs');
const base={renewal:'renews',can_cancel:true,
 monthly_paid_until:'2026-11-27T12:00:00Z',annual_paid_until:null};
const staging={enabled:true,projectRef:'abcdefghijklmnopqrst',origin:'https://staging.example.org'};
const location={origin:staging.origin};
const supa={url:'https://'+staging.projectRef+'.supabase.co'};
test('step85: cancellation UI is disabled for every main-production configuration',()=>{
 assert.equal(premiumTestMemberConfig.enabled,false);
 assert.equal(canUseTestPremiumManagement(),false);
 assert.equal(canUseTestPremiumManagement(staging,location,supa),true);
 for(const [cfg,loc,project] of [
  [{...staging,enabled:false},location,supa],
  [{...staging,projectRef:'dahzewvbybujqhogumte'},location,
   {url:'https://dahzewvbybujqhogumte.supabase.co'}],
  [staging,{origin:'https://attacker.example.org'},supa],
  [staging,location,{url:'https://dahzewvbybujqhogumte.supabase.co'}],
  [{...staging,origin:'http://staging.example.org'},location,supa],
  [{...staging,projectRef:'invalid'},location,supa]
 ])assert.equal(canUseTestPremiumManagement(cfg,loc,project),false);
});
test('step85: server renewal projection refuses inconsistent and unknown cancellation states',()=>{
 assert.deepEqual(normalizePremiumRenewalStatus(base),{
  ...base,cancellation_effective_at:null
 });
 assert.equal(normalizePremiumRenewalStatus({...base,
  renewal:'cancel_scheduled',can_cancel:false,
  cancellation_effective_at:'2026-11-27T12:00:00Z'}).renewal,'cancel_scheduled');
 for(const payload of [
  {...base,can_cancel:false},
  {...base,renewal:'cancel_scheduled',can_cancel:true},
  {...base,renewal:'multiple_monthly',can_cancel:true},
  {...base,monthly_paid_until:null},
  {...base,renewal:'unknown'},null,[]
 ])assert.equal(normalizePremiumRenewalStatus(payload),null);
});
test('step85: member explanations never imply annual auto-renewal or already cancelled payments',()=>{
 const annual=normalizePremiumStatus({
  state:'active',active:true,plan:'annual',valid_until:'2027-12-01T00:00:00Z'
 },Date.parse('2026-10-27T00:00:00Z'));
 const monthly=normalizePremiumStatus({
  state:'active',active:true,plan:'monthly',valid_until:'2026-12-01T00:00:00Z'
 },Date.parse('2026-10-27T00:00:00Z'));
 assert.match(premiumLifecycleText(annual),/pas de reconduction automatique/);
 assert.match(premiumLifecycleText(annual,base),/mensuel TEST distinct/);
 assert.match(premiumLifecycleText(monthly,base),/renouvellement/i);
 assert.match(premiumLifecycleText(monthly,{...base,renewal:'cancel_scheduled',can_cancel:false}),
  /reste valable/);
 assert.match(premiumLifecycleText(null),/paiements et renouvellements ne sont pas encore disponibles/);
});
test('step85: service RPC derives only an active monthly grant with charge proof and refuses ambiguity',()=>{
 for(const part of [
  'app_private.premium_test_charge_proofs p',
  "l.plan_kind='monthly'",
  "g.revoked_at is null",
  "g.valid_from<=now() and now()<g.valid_until",
  'count(distinct l.checkout_id)',
  "if v_count<>1 then",
  'No unique active monthly TEST subscription',
  'v_link.customer_id',
  "'subscription_id',v_target.subscription_id",
  "'customer_id',v_target.customer_id",
  "'price_id',v_target.price_id"
 ])assert.ok(sql.includes(part),part);
 assert.match(sql,/grant execute on function public\.billing_get_member_test_renewal_target\(uuid\)\s+to service_role/);
 assert.doesNotMatch(sql,/grant execute on function public\.billing_get_member_test_renewal_target\(uuid\)\s+to authenticated/);
});
test('step85: cancellation is at paid period end, never revokes grants',()=>{
 for(const part of [
  'cancel_at_period_end boolean not null default false',
  'cancellation_requested_at timestamptz',
  'cancellation_effective_at timestamptz',
  "p_effective_at<=clock_timestamp()",
  "p_effective_at>clock_timestamp()+interval '45 days'",
  "and plan_kind='monthly' and closed_at is null for update",
  "s.source_reference",
  'set cancel_at_period_end=true',
  "cancellation_requested_at=coalesce(cancellation_requested_at,clock_timestamp())",
  "cancellation_effective_at=p_effective_at",
  "return true;"
 ])assert.ok(sql.includes(part),part);
 assert.doesNotMatch(sql,/update app_private\.premium_access_grants\s+set revoked_at/);
 assert.match(sql,/grant execute on function public\.billing_confirm_member_test_cancellation\([\s\S]*?to service_role/);
});
test('step85: member renewal status is own-only and hides Stripe identifiers',()=>{
 const projection=sql.split('create or replace function public.member_my_premium_renewal()')[1];
 assert.match(projection,/v_user uuid:=\(select auth\.uid\(\)\)/);
 assert.match(projection,/l.user_id=v_user/);
 assert.match(projection,/g.user_id=v_user/);
 assert.match(projection,/cancellation_effective_at/);
 assert.match(projection,/annual_no_renewal/);
 assert.match(projection,/multiple_monthly/);
 assert.match(projection,/cancel_scheduled/);
 assert.match(projection,/not v_monthly.cancel_at_period_end/);
 const body=projection.split('$fn$;')[0];
 assert.doesNotMatch(body,/jsonb_build_object\([^)]*subscription_id/);
 assert.doesNotMatch(body,/jsonb_build_object\([^)]*customer_id/);
 assert.match(sql,/grant execute on function public\.member_my_premium_renewal\(\)\s+to authenticated/);
});
test('step85: Edge cancellation authenticates owner, TEST price and Stripe item-level billing period',()=>{
 for(const part of [
  "BOISSY_STAGING_PROJECT_REF",
  "YES_ALLOW_VERIFIED_TEST_MONTHLY_CANCEL_ON_ISOLATED_STAGING",
  "verifiedStripeTestProjectOrigin",
  "/auth/v1/user",
  "user.email_confirmed_at",
  "Object.keys(body).length!==1",
  "body.action!=='cancel_renewal'",
  "p_user_id:user.id",
  "billing_get_member_test_renewal_target",
  "stripe.subscriptions.retrieve(target.subscription_id)",
  "item.price.unit_amount!==1000",
  "item.price.recurring?.interval!=='month'",
  "item.current_period_end",
  "stripe.subscriptions.update(target.subscription_id",
  "cancel_at_period_end:true",
  "billing_confirm_member_test_cancellation",
  "p_effective_at:new Date(unix*1000).toISOString()",
  "return reply('renewal_cancellation_scheduled',200,cfg.origin)"
 ])assert.ok(cancel.includes(part),part);
 assert.match(config,/\[functions\.premium-stripe-test-cancel\]\s*verify_jwt = true/);
 assert.doesNotMatch(cancel,/sk_live_|rk_live_|pk_live_|\.subscriptions\.cancel\(|stripe\.redirectToCheckout/);
});
test('step85: browser checks its identity and never sends Stripe/customer/member references',()=>{
 for(const part of [
  "api.rpc('member_my_premium_status')",
  "api.rpc('member_my_premium_renewal')",
  "canUseTestPremiumManagement()",
  "window.confirm(",
  "api.auth.getUser()",
  "api.functions.invoke('premium-stripe-test-cancel'",
  "body:{action:'cancel_renewal'}",
  "response.data?.status!=='renewal_cancellation_scheduled'",
  "support.href='#/contact'"
 ])assert.ok(frontend.includes(part),part);
 assert.doesNotMatch(frontend,/service_role|stripe\.subscriptions|customer_id|subscription_id|sk_live_/);
});
