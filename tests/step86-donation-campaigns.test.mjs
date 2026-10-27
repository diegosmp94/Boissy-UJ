import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicDonationCampaigns,donationGoalText}
 from '../donation-campaigns.mjs';
import {euroGoalToCents,donationCampaignDraftError,campaignSaveArgs}
 from '../admin-donation-campaigns.mjs';
import {checkTestDonationLine,checkDonationCharge,
 requireSingleTestInvoicePayment,acceptTestDonationReversal}
 from '../supabase/functions/_shared/donation-test-verification.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schema=read('supabase/migrations/202610270004_step86_public_donation_campaigns.sql');
const ledger=read('supabase/migrations/202610270005_step86_stripe_test_donation_ledger.sql');
const checkout=read('supabase/functions/donation-stripe-test-checkout/index.ts');
const webhook=read('supabase/functions/donation-stripe-test-webhook/index.ts');
const config=read('supabase/config.toml');
const app=read('app.js');
const admin=read('admin-center.mjs');
const publicUi=read('donation-campaigns.mjs');
const now=Date.parse('2026-10-27T10:00:00Z');
const row=(patch={})=>({
 id:'4e88e5fa-f708-42f9-b837-2cc0a0436fb4',title:'Projet approuvé',
 description:'Pour la formation',fund_type:'project',published:true,
 status:'open',starts_at:'2026-10-20T12:00:00Z',
 ends_at:null,goal_cents:50000,...patch
});
test('stage86 campaign catalog excludes unpublished/draft entries and handles schedules correctly',()=>{
 const result=publicDonationCampaigns([
  row(),row({published:false}),row({status:'draft'}),
  row({fund_type:'other'}),row({status:'closed'}),
  row({starts_at:'2026-11-20T12:00:00Z'}),
  row({ends_at:'2026-10-24T12:00:00Z'}),
  row({starts_at:'not date'})
 ],now);
 assert.deepEqual(new Set(result.map(x=>x.availability)),
  new Set(['open','closed','scheduled','ended']));
 assert.equal(result.length,4);
 assert.equal(publicDonationCampaigns(null,now).length,0);
 assert.match(donationGoalText(50000),/500/);
 assert.equal(donationGoalText(null),null);
 assert.equal(donationGoalText(-1),null);
});
test('stage86 currency goal parsing is precise and admin draft prevents invalid publishing',()=>{
 assert.equal(euroGoalToCents('500,99'),50099);
 assert.equal(euroGoalToCents('500.5'),50050);
 assert.equal(euroGoalToCents(''),null);
 for(const n of ['0.5','1.123','123abc','999999999','-1','1e9'])
  assert.throws(()=>euroGoalToCents(n));
 const data={title:'Projet sport',description:'Équipement prévu',
  fund_type:'project',goal_euros:'600',status:'open',published:true,
  starts_at:'2026-10-27T12:00',ends_at:'2026-12-01T12:00'};
 assert.equal(donationCampaignDraftError(data),null);
 const args=campaignSaveArgs(data,{id:row().id,updated_at:'2026-10-26T12:00:00Z'});
 assert.equal(args.p_goal_cents,60000);
 assert.equal(args.p_id,row().id);
 assert.equal(args.p_published,true);
 for(const invalid of [
  {...data,status:'draft'},
  {...data,starts_at:''},
  {...data,ends_at:'2026-10-01T00:00'},
  {...data,goal_euros:'0.1'},
  {...data,fund_type:'unknown'}
 ])assert.ok(donationCampaignDraftError(invalid));
});
test('stage86 public campaigns are RLS filtered, never writable directly by browsers',()=>{
 for(const s of [
  'create table if not exists public.donation_campaigns',
  "fund_type in ('general','project')",
  "status in ('draft','open','closed')",
  'published boolean not null default false',
  'goal_cents bigint',
  'alter table public.donation_campaigns enable row level security',
  'revoke all on public.donation_campaigns from public,anon,authenticated',
  'grant select on public.donation_campaigns to anon,authenticated',
  "using (published=true and status in ('open','closed'))",
 ])assert.ok(schema.includes(s),s);
 assert.doesNotMatch(schema,/grant (insert|update|delete) on public\.donation_campaigns to (anon|authenticated)/i);
 assert.doesNotMatch(schema,/insert into public\.donation_campaigns[^;]*values\s*\([^;]*don fictif/i);
});
test('stage86 admin edits enforce MFA, draft lock, publication confirmation and private audit',()=>{
 for(const s of [
  "app_private.is_admin()",
  'public.admin_list_donation_campaigns',
  'public.admin_save_donation_campaign',
  "errcode='42501'",
  "errcode='40001'",
  'p_expected_updated_at is distinct from v_old.updated_at',
  "v_action:='created'",
  'app_private.donation_campaign_audit',
  'before_snapshot,after_snapshot',
  'revoke all on app_private.donation_campaign_audit',
 ])assert.ok(schema.includes(s),s);
 assert.match(schema,/grant execute on function public\.admin_save_donation_campaign\([\s\S]+?\)\s+to authenticated/);
 assert.match(admin,/case 'donations':void mountAdminDonationCampaigns/);
 assert.match(read('admin-donation-campaigns.mjs'),/const confirmed=|confirmation!==key/);
 assert.match(read('admin-donation-campaigns.mjs'),/adminSessionStatus\(api,expectedUserId\)/);
});
test('stage86 public Soutenir page never claims money already raised or offers card checkout',()=>{
 assert.match(app,/mountDonationCampaigns\(\)/);
 assert.match(app,/unmountDonationCampaigns\(\)/);
 assert.match(app,/id="donation-campaigns-public"/);
 assert.match(publicUi,/donation_campaigns/);
 assert.match(publicUi,/cache:'no-store'/);
 assert.match(publicUi,/boundedPublicRequest/);
 assert.match(publicUi,/Aucun objectif ou montant de collecte n’est inventé/);
 assert.doesNotMatch(publicUi,/checkout\.sessions\.create|stripe\.redirectToCheckout|sk_live_|service_role|donation_test_receipts/);
});
test('stage86 staging ledger privately tracks TEST one-time and recurring donations with targeted reversal',()=>{
 for(const s of [
  'TEST ONLY. ISOLATED STAGING REQUIRED',
  'app_private.donation_test_checkouts',
  'app_private.donation_test_receipts',
  'app_private.donation_test_reversal_inbox',
  "frequency in ('once','monthly')",
  "status in ('settled','reversed')",
  'source_reference text primary key',
  'charge_id text not null unique',
  'payment_intent_id text not null unique',
  'p_source_reference<>p_checkout_id',
  "p_frequency='monthly'",
  'r.charge_id=p_charge_id',
  "set applied_at=coalesce(applied_at,v_now)",
  'where charge_id=p_charge_id and status=',
  'admin_test_donation_campaign_totals'
 ])assert.ok(ledger.includes(s),s);
 for(const table of ['donation_test_checkouts','donation_test_receipts',
  'donation_test_reversal_inbox']){
  assert.ok(ledger.includes('alter table app_private.'+table+' enable row level security'));
  assert.ok(ledger.includes('revoke all on app_private.'+table+' from public,anon,authenticated'));
 }
 assert.doesNotMatch(ledger,/grant (select|insert|update|delete) on app_private\./i);
 assert.match(ledger,/grant execute on function public\.billing_apply_verified_test_donation\([^;]*?\)\s+to service_role/);
 assert.doesNotMatch(ledger,/grant execute on function public\.billing_apply_verified_test_donation\([^;]*?\)\s+to authenticated/);
});
const pi={id:'pi_intent123456',livemode:false,status:'succeeded',
 currency:'eur',customer:'cus_cust123456',amount_received:1000,
 latest_charge:'ch_charge123456'};
const charge={id:'ch_charge123456',livemode:false,paid:true,currency:'eur',
 amount:1000,customer:pi.customer,payment_intent:pi.id,
 refunded:false,disputed:false,amount_refunded:0};
const line=(kind='monthly',patch={})=>({
 quantity:1,price:{id:'price_test123456',product:'prod_product123456',
 livemode:false,currency:'eur',unit_amount:1000,
 type:kind==='monthly'?'recurring':'one_time',
 ...(kind==='monthly'?{recurring:{interval:'month',interval_count:1}}:{}),
 ...patch}
});
test('stage86 strict Stripe TEST donation price and charge validation accepts only exact amount',()=>{
 assert.equal(checkTestDonationLine([line()],'prod_product123456',1000,'monthly'),true);
 assert.equal(checkTestDonationLine([line('once')],'prod_product123456',1000,'once'),true);
 for(const [lines,product,amount,frequency] of [
  [[line()], 'prod_wrong123456',1000,'monthly'],
  [[line(),line()],'prod_product123456',1000,'monthly'],
  [[line()], 'prod_product123456',999,'monthly'],
  [[line('once')],'prod_product123456',1000,'monthly'],
  [[line('monthly',{livemode:true})],'prod_product123456',1000,'monthly'],
 ])assert.throws(()=>checkTestDonationLine(lines,product,amount,frequency));
 assert.deepEqual(checkDonationCharge(pi,charge,1000,pi.customer),{
  paymentIntentId:pi.id,chargeId:charge.id,reversed:false
 });
 assert.equal(checkDonationCharge(pi,{...charge,amount_refunded:1},1000,pi.customer).reversed,true);
 assert.throws(()=>checkDonationCharge({...pi,livemode:true},charge,1000,pi.customer));
 assert.throws(()=>checkDonationCharge(pi,{...charge,amount:999},1000,pi.customer));
});
test('stage86 invoice payment requires a unique paid TEST PaymentIntent',()=>{
 const invoice='in_invoice123456';
 const paid={has_more:false,data:[{status:'paid',invoice,
  payment:{type:'payment_intent',payment_intent:pi.id}}]};
 assert.equal(requireSingleTestInvoicePayment(paid,invoice),pi.id);
 for(const candidate of [{...paid,has_more:true},{...paid,data:[]},
  {...paid,data:[...paid.data,...paid.data]},
  {...paid,data:[{...paid.data[0],status:'open'}]}]){
  assert.throws(()=>requireSingleTestInvoicePayment(candidate,invoice));
 }
});
test('stage86 donation reversals require verified refund/dispute references and settled charge',()=>{
 const event=(type,obj)=>({id:'evt_event123456',livemode:false,type,
  data:{object:{livemode:false,...obj}}});
 assert.equal(acceptTestDonationReversal(event('charge.refunded',{id:charge.id}),
  {...charge,amount_refunded:100}),true);
 assert.equal(acceptTestDonationReversal(event('refund.updated',{
  id:'re_refund123456',charge:charge.id}),charge),false);
 assert.equal(acceptTestDonationReversal(event('charge.dispute.created',{
  id:'du_dispute123456',charge:charge.id}),{...charge,disputed:true}),true);
 assert.throws(()=>acceptTestDonationReversal(event('refund.updated',{
  id:'re_refund123456',charge:'ch_other123456'}),charge));
});
test('stage86 signed donation checkout and webhook cannot process LIVE or arbitrary members',()=>{
 for(const s of [
  'BOISSY_STAGING_PROJECT_REF',
  'verifiedStripeTestProjectOrigin',
  'STRIPE_TEST_DONATION_PRODUCT_ID',
  'STRIPE_TEST_RESTRICTED_KEY',
  "body.amount_cents<100",
  "body.amount_cents>100000",
  'email_confirmed_at',
  "billing_register_test_donation_checkout",
  "session.id?.startsWith('cs_test_')",
  "stripe.checkout.sessions.create"
 ])assert.ok(checkout.includes(s),s);
 for(const s of [
  "stripe.webhooks.constructEventAsync",
  "raw,signature,cfg.secret",
  "event.livemode!==false",
  'stripe.invoicePayments.list',
  'stripe.paymentIntents.retrieve',
  'stripe.charges.retrieve',
  'billing_apply_verified_test_donation',
  'billing_record_verified_test_donation_reversal',
  "return reply('retry_later',503)"
 ])assert.ok(webhook.includes(s),s);
 assert.match(config,/\[functions\.donation-stripe-test-checkout\]\s*verify_jwt = true/);
 assert.match(config,/\[functions\.donation-stripe-test-webhook\]\s*verify_jwt = false/);
 assert.doesNotMatch(checkout+webhook,/rk_live_|sk_live_|pk_live_|console\.log\(|console\.error\(/);
});
