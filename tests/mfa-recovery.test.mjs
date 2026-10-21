import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ADMIN_FACTOR_NAME,findAdminTotpFactors,mfaErrorMessage} from '../mfa-recovery.mjs';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const security=read('admin-security.mjs');

test('Supabase listFactors stores unverified enrollments in .all, not .totp',()=>{
 const data={
  totp:[],
  all:[{id:'pending-123',factor_type:'totp',status:'unverified',
    friendly_name:ADMIN_FACTOR_NAME}]
 };
 assert.deepEqual(findAdminTotpFactors(data),{
  verified:null,pending:data.all[0]
 });
});
test('already verified TOTP must never be unenrolled even with an unfinished factor',()=>{
 const verified={id:'valid',factor_type:'totp',status:'verified',friendly_name:'Téléphone'};
 const pending={id:'pending',factor_type:'totp',status:'unverified',friendly_name:ADMIN_FACTOR_NAME};
 assert.deepEqual(findAdminTotpFactors({all:[verified,pending],totp:[verified]}),{
  verified,pending
 });
 assert.match(security,/if\(verified\)\{/);
 assert.match(security,/api.auth.mfa.unenroll\(\{factorId:pending.id\}\)/);
 assert.doesNotMatch(security,/unenroll\(\{factorId:verified.id\}\)/);
});
test('an unrelated pending factor is never removed by the Boissy-UJ recovery',()=>{
 const other={id:'foreign',factor_type:'totp',status:'unverified',friendly_name:'Autre appareil'};
 assert.deepEqual(findAdminTotpFactors({all:[other],totp:[]}),{
  verified:null,pending:null
 });
});
test('MFA factor-name conflicts are diagnosed and can be recovered by a confirmed restart',()=>{
 assert.match(mfaErrorMessage({code:'mfa_factor_name_conflict'}),/inachevée/i);
 assert.match(security,/restartApproved=true/);
 assert.match(security,/begin.textContent='Recommencer la configuration MFA'/);
 assert.match(security,/if\(!restartApproved\)\{/);
 assert.match(security,/stage='remove'/);
 assert.match(security,/stage='enroll'/);
 assert.match(security,/api.auth.mfa.listFactors\(\)/);
 assert.match(security,/findAdminTotpFactors\(existing.data\)/);
 assert.match(security,/api.auth.mfa.enroll\(\{factorType:'totp',friendlyName:ADMIN_FACTOR_NAME\}\)/);
});
test('session errors and rate limits produce safe actionable messages',()=>{
 assert.match(mfaErrorMessage({status:401}),/Reconnecte-toi/);
 assert.match(mfaErrorMessage({code:'mfa_totp_enroll_disabled'}),/Supabase Auth/);
 assert.match(mfaErrorMessage({status:429}),/Trop de tentatives/);
 assert.match(mfaErrorMessage({code:'mfa_verification_failed'},'verify'),/code est incorrect/);
 assert.doesNotMatch(mfaErrorMessage({message:'secret-server-string'},'setup'),/secret-server-string/);
});
test('verified enrollment remains protected by AAL2, no client-side admin bypass',()=>{
 assert.match(security,/secured.status!=='admin'/);
 assert.match(security,/api.auth.mfa.verify\(\{factorId,challengeId:challenge.data.id,code:value\}\)/);
 assert.match(read('admin-center.mjs'),/canOpenAdmin\(verified,supabaseConfig.adminEnabled\)/);
 assert.doesNotMatch(security,/localStorage|document.cookie|service_role|sb_secret_/);
 assert.match(read('auth-config.mjs'),/adminEnabled:\s*true/);
});
