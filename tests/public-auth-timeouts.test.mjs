import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {withAuthDeadline,AuthServiceTimeout,AUTH_SERVICE_DEADLINE_MS} from '../auth-resilience.mjs';

const source=readFileSync(new URL('../auth.mjs',import.meta.url),'utf8');
test('supporter sign-in and CDN calls have a finite deadline',()=>{
 assert.equal(AUTH_SERVICE_DEADLINE_MS,12000);
 assert.match(source,/clientPromise = withAuthDeadline\(/);
 assert.match(source,/import\("https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.118\.0\/\+esm"\)/);
 assert.match(source,/clientPromise = null; throw error;/);
 assert.match(source,/withAuthDeadline\(api\.auth\.signInWithPassword\(\{ email, password \}\)\)/);
 assert.match(source,/withAuthDeadline\(api\.auth\.signUp\(/);
 assert.match(source,/withAuthDeadline\(api\.auth\.resetPasswordForEmail\(/);
 assert.match(source,/withAuthDeadline\(api\.auth\.resend\(/);
 assert.match(source,/withAuthDeadline\(api\.auth\.updateUser\(/);
 assert.match(source,/withAuthDeadline\(api\.auth\.signOut\(\)\)/);
});
test('a responsive Supabase result is returned unmodified, including PostgREST thenables',async()=>{
 const value={data:{user:{id:'test'}},error:null};
 assert.strictEqual(await withAuthDeadline(Promise.resolve(value),200),value);
 assert.deepEqual(await withAuthDeadline({
  then(resolve){resolve(value);}
 },200),value);
});
test('offline service fails safely rather than leaving Mon espace loading forever',async()=>{
 const stuck=new Promise(()=>{});
 await assert.rejects(withAuthDeadline(stuck,20),error=>{
  assert.equal(error instanceof AuthServiceTimeout,true);
  assert.equal(error.name,'AuthServiceTimeout');
  assert.doesNotMatch(error.message,/token|sb_secret_|password|email/i);
  return true;
 });
});
test('late account responses cannot turn a timeout into a second result',async()=>{
 let respond;
 const pending=new Promise(resolve=>{respond=resolve;});
 const operation=withAuthDeadline(pending,10);
 await assert.rejects(operation,AuthServiceTimeout);
 respond({data:{user:{id:'late'}},error:null});
 await new Promise(r=>setTimeout(r,0));
});
test('unavailable/rejected backend propagates to visible guarded error UI',async()=>{
 await assert.rejects(withAuthDeadline(Promise.reject(Error('offline')),100),/offline/);
 assert.match(source,/function renderAuthRetry\(root\)/);
 assert.match(source,/Connexion temporairement indisponible/);
 assert.match(source,/Le service de compte ne répond pas\. Tes informations ne sont pas modifiées\./);
 assert.match(source,/if\(root\.isConnected\)void mountAuth\(\)/);
 assert.match(source,/if\(view===sessionViewGeneration\)renderAuthRetry\(root\)/);
 assert.match(source,/renderAuthRetry\(root\);/);
});
test('auth deadlines reject invalid config instead of silently waiting',()=>{
 for(const timeout of [-1,0,100000,1.4,'10000',null,NaN]){
  assert.throws(()=>withAuthDeadline(Promise.resolve('ok'),timeout),/Invalid authentication timeout/);
 }
});
test('protected account view bounds getUser/profile/roles and ignores obsolete navigation',()=>{
 assert.match(source,/identity=await withAuthDeadline\(api\.auth\.getUser\(\)\)/);
 assert.match(source,/await withAuthDeadline\(Promise\.all\(\[/);
 assert.match(source,/api\.from\("profiles"\)\.select\("display_name"\)\.eq\("id", user.id\)\.maybeSingle\(\)/);
 assert.match(source,/api\.from\("user_roles"\)\.select\("role"\)\.eq\("user_id", user.id\)/);
 assert.match(source,/if \(!root\.isConnected\|\|view!==sessionViewGeneration\) return/);
 assert.match(source,/if\(view===sessionViewGeneration\)renderAuthRetry\(root\)/);
});
test('no server write, payment or privileged account bypass was introduced',()=>{
 const helper=readFileSync(new URL('../auth-resilience.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(helper,/service_role|sk_live_|\.rpc\(|\.insert\(|\.update\(|\.delete\(|fetch\(/);
 assert.doesNotMatch(helper,/console\.log|localStorage|sessionStorage|document\.cookie/);
 assert.match(source,/adminEnabled/);
 assert.match(source,/mountAdminMfaSetup\(account,api,user\.id\)/);
});
