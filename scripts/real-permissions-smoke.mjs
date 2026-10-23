/**
 * Live, read-only account and permission recipe for an isolated Boissy-UJ
 * Supabase test project. It never signs up users or writes application rows.
 * Auth sessions are created only for the supplied test accounts and logged
 * out locally at the end. Never point this script at the production project.
 */
import {createHmac} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const PRODUCTION_PROJECT_REF='dahzewvbybujqhogumte';
const REQUIRED_PERSONAS=['supporter','playerA','playerB','coachA','coachB','admin','tripleRole'];
const ACK='YES_RUN_READ_ONLY_PERMISSION_TESTS_ON_STAGING';

export function decodeJwtPayload(token){
  const part=String(token||'').split('.')[1];
  if(!part)throw new Error('Supabase returned an invalid access token.');
  try{return JSON.parse(Buffer.from(part,'base64url').toString('utf8'));}
  catch{throw new Error('Supabase returned an invalid access token.');}
}

function base32Bytes(value){
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized=String(value||'').toUpperCase().replace(/[=\s-]/g,'');
  if(!normalized||!/^[A-Z2-7]+$/.test(normalized))throw new Error('TOTP secret is missing or malformed.');
  let bits='';
  for(const char of normalized)bits+=alphabet.indexOf(char).toString(2).padStart(5,'0');
  const bytes=[];
  for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));
  return Buffer.from(bytes);
}

export function totpCode(secret,now=Date.now()){
  const counter=Math.floor(now/30000),counterBytes=Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));
  const digest=createHmac('sha1',base32Bytes(secret)).update(counterBytes).digest();
  const offset=digest[digest.length-1]&0x0f;
  const binary=digest.readUInt32BE(offset)&0x7fffffff;
  return String(binary%1000000).padStart(6,'0');
}

export function validateTarget(env){
  if(env.BOISSY_TEST_ENVIRONMENT!=='test')throw new Error('Set BOISSY_TEST_ENVIRONMENT=test.');
  if(env.BOISSY_TEST_ACK!==ACK)throw new Error('Set BOISSY_TEST_ACK='+ACK+' to confirm the isolated test target.');
  const ref=String(env.BOISSY_TEST_PROJECT_REF||'');
  if(!/^[a-z0-9]{20}$/.test(ref))throw new Error('BOISSY_TEST_PROJECT_REF must be a Supabase project reference.');
  if(ref===PRODUCTION_PROJECT_REF)throw new Error('Refusing to run live permission tests against Boissy-UJ production.');
  let url;
  try{url=new URL(env.BOISSY_TEST_SUPABASE_URL||'');}catch{throw new Error('BOISSY_TEST_SUPABASE_URL must be a valid Supabase URL.');}
  if(url.protocol!=='https:'||url.hostname!==ref+'.supabase.co'||url.username||url.password||url.search||url.hash||url.pathname!=='/')
    throw new Error('The HTTPS Supabase URL must match BOISSY_TEST_PROJECT_REF exactly.');
  const key=String(env.BOISSY_TEST_PUBLISHABLE_KEY||'');
  if(!key||key.startsWith('sb_secret_'))throw new Error('Provide only a publishable/anon key; secret and service-role keys are forbidden.');
  if(key.startsWith('eyJ')){
    let claims;
    try{claims=decodeJwtPayload(key);}catch{throw new Error('The API key is not a valid publishable/anon key.');}
    if(claims.role!=='anon'||claims.ref&&claims.ref!==ref)
      throw new Error('The API key must be an anon key for the isolated test project.');
  }else if(!key.startsWith('sb_publishable_')){
    throw new Error('The API key must be a publishable key or a legacy anon key.');
  }
  let personas,fixtures;
  try{personas=JSON.parse(env.BOISSY_TEST_PERSONAS_JSON||'');}
  catch{throw new Error('BOISSY_TEST_PERSONAS_JSON must contain the authorized test personas.');}
  try{fixtures=JSON.parse(env.BOISSY_TEST_FIXTURES_JSON||'');}
  catch{throw new Error('BOISSY_TEST_FIXTURES_JSON must contain existing test-project team fixtures.');}
  for(const name of REQUIRED_PERSONAS){
    const persona=personas?.[name];
    if(!persona||typeof persona.email!=='string'||!persona.email.includes('@')||
       typeof persona.password!=='string'||persona.password.length<8||
       !Array.isArray(persona.roles)||persona.roles.some(role=>!['supporter','player','coach','admin'].includes(role)))
      throw new Error('Test persona configuration is incomplete: '+name+'.');
  }
  // Distinct test identities are essential: a shared account cannot prove RLS isolation.
  const emails=REQUIRED_PERSONAS.map(name=>personas[name].email.trim().toLocaleLowerCase('en-US'));
  if(new Set(emails).size!==REQUIRED_PERSONAS.length)
    throw new Error('Each staging persona must use a different verified test account.');
  for(const name of ['admin','tripleRole'])if(!personas[name].totpSecret)
    throw new Error('A verified TOTP secret is required for test persona '+name+'.');
  for(const code of [fixtures.teamA,fixtures.teamB])if(typeof code!=='string'||!/^[a-z0-9_-]{1,40}$/i.test(code))
    throw new Error('Fixture configuration requires existing teamA and teamB codes.');
  if(fixtures.teamA===fixtures.teamB)throw new Error('Team A and Team B must be different existing teams.');
  // A full recipe must prove actual row separation; silent SKIP is not sufficient.
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const a=fixtures.playerAExclusiveMatchId,b=fixtures.playerBExclusiveMatchId;
  if(!uuid.test(a)||!uuid.test(b)||a===b)
    throw new Error('Two distinct existing exclusive player callup match UUIDs are required.');
  return {url:url.origin,ref,key,personas,fixtures};
}

function safeCode(payload){return typeof payload?.code==='string'?payload.code:'HTTP_ERROR';}

async function createApi(config){
  async function request(path,{method='GET',token,body}={}){
    const headers={apikey:config.key,Accept:'application/json'};
    if(token)headers.Authorization='Bearer '+token;
    if(body!==undefined)headers['Content-Type']='application/json';
    let response;
    try{
      response=await fetch(new URL(path,config.url+'/'),{
        method,headers,body:body===undefined?undefined:JSON.stringify(body),
        signal:AbortSignal.timeout(15000)
      });
    }catch{throw new Error('Supabase test endpoint is unreachable.');}
    const raw=await response.text();
    let payload=null;
    if(raw){try{payload=JSON.parse(raw);}catch{payload=null;}}
    return {ok:response.ok,status:response.status,payload};
  }
  return {request};
}

function requireSuccess(result,label){
  if(!result.ok)throw new Error(label+' failed (HTTP '+result.status+', '+safeCode(result.payload)+').');
  return result.payload;
}

function requireDenied(result,label){
  const postgresDenied=result.payload?.code==='42501';
  const apiDenied=[401,403].includes(result.status);
  if(result.ok||(!postgresDenied&&!apiDenied))
    throw new Error(label+' was not denied as expected (HTTP '+result.status+', '+safeCode(result.payload)+').');
}

function record(state,label){state.passed++;console.log('PASS '+label);}
export function assertDistinctSessions(sessions){
  const ids=REQUIRED_PERSONAS.map(name=>sessions[name]?.userId);
  if(ids.some(id=>typeof id!=='string'||!id))
    throw new Error('Not all test personas have a verified user id.');
  if(new Set(ids).size!==REQUIRED_PERSONAS.length)
    throw new Error('Staging personas resolved to the same Auth user; RLS isolation is invalid.');
}

/** Test row-level separation directly through PostgREST with a real AAL1 bearer token.
 * Use a foreign user ID and request only identifying columns. No row contents
 * or account identifiers are printed or persisted in the recipe.
 */
export const CROSS_ACCOUNT_SCOPES=Object.freeze([
  {table:'profiles',column:'id'},
  {table:'user_roles',column:'user_id'},
  {table:'role_requests',column:'user_id'},
  {table:'staff_team_assignments',column:'coach_user_id'}
]);
export async function verifyCrossAccountPrivacy(api,state,session,foreignUserId,label){
  if(!session?.token||!session.userId||!foreignUserId||
    session.userId===foreignUserId)
    throw new Error('A cross-account RLS check requires two distinct signed-in users.');
  if(session.claims?.aal!=='aal1')
    throw new Error('Cross-account privacy checks must run at the initial AAL1 level.');
  for(const scope of CROSS_ACCOUNT_SCOPES){
    const params=new URLSearchParams({
      select:scope.column,[scope.column]:'eq.'+foreignUserId,limit:'1'
    });
    const result=await api.request('rest/v1/'+scope.table+'?'+params.toString(),{
      token:session.token
    });
    const rows=requireSuccess(result,label+' protected '+scope.table+' lookup');
    if(!Array.isArray(rows)||rows.length!==0)
      throw new Error(label+' could read another member in '+scope.table+'.');
    record(state,label+' cannot read another account in '+scope.table+'.');
  }
}

async function signIn(api,state,persona,label){
  const result=await api.request('auth/v1/token?grant_type=password',{
    method:'POST',body:{email:persona.email,password:persona.password}
  });
  const session=requireSuccess(result,'Password sign-in for '+label);
  if(!session.access_token||!session.user?.id)throw new Error('Password sign-in for '+label+' returned no authenticated session.');
  const token=session.access_token,claims=decodeJwtPayload(token);
  if(claims.aal!=='aal1')throw new Error(label+' password sign-in did not begin at AAL1.');
  const verified=requireSuccess(await api.request('auth/v1/user',{token}),'Verified user lookup for '+label);
  if(verified.id!==session.user.id)throw new Error('Authenticated user identity changed for '+label+'.');
  if(!(verified.email_confirmed_at||verified.confirmed_at))throw new Error(label+' test account has no confirmed e-mail.');
  const roleRows=requireSuccess(await api.request(
    'rest/v1/user_roles?select=role&user_id=eq.'+encodeURIComponent(verified.id),{token}
  ),'Own-role lookup for '+label);
  const actual=[...new Set((roleRows||[]).map(row=>row.role))].sort();
  const expected=[...new Set(persona.roles)].sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))
    throw new Error('Configured roles do not match the live test account '+label+'.');
  record(state,label+' sign-in, confirmed e-mail and exact role set ('+actual.join('+')+').');
  return {token,claims,userId:verified.id,persona};
}

async function stepUpTotp(api,session,label){
  const factors=requireSuccess(await api.request('auth/v1/factors',{token:session.token}),label+' MFA factor lookup');
  const verified=(factors.totp||[]).filter(factor=>factor.status==='verified');
  if(!verified.length)throw new Error(label+' has no verified TOTP factor.');
  const preferred=session.persona.factorId;
  const factor=preferred?verified.find(item=>item.id===preferred):verified.length===1?verified[0]:null;
  if(!factor)throw new Error(label+' must specify factorId when more than one verified TOTP factor exists.');
  const challenge=requireSuccess(await api.request('auth/v1/factors/'+encodeURIComponent(factor.id)+'/challenge',{
    method:'POST',token:session.token,body:{}
  }),label+' MFA challenge');
  if(!challenge.id)throw new Error(label+' MFA challenge returned no challenge id.');
  const verification=requireSuccess(await api.request('auth/v1/factors/'+encodeURIComponent(factor.id)+'/verify',{
    method:'POST',token:session.token,body:{challenge_id:challenge.id,code:totpCode(session.persona.totpSecret)}
  }),label+' MFA verification');
  if(!verification.access_token||decodeJwtPayload(verification.access_token).aal!=='aal2')
    throw new Error(label+' TOTP verification did not produce an AAL2 session.');
  session.token=verification.access_token;
  session.claims=decodeJwtPayload(session.token);
  record(state,label+' TOTP challenge issued a real AAL2 session.');
}

async function rpc(api,session,name,args={}){
  return api.request('rest/v1/rpc/'+name,{method:'POST',token:session?.token,body:args});
}

async function getTeamIds(api,fixtures){
  const codes=[fixtures.teamA,fixtures.teamB];
  const query=new URLSearchParams({select:'id,code',code:'in.('+codes.join(',')+')'});
  const result=requireSuccess(await api.request('rest/v1/club_teams?'+query.toString()),'Public test-team lookup');
  const ids=Object.fromEntries((result||[]).map(row=>[row.code,row.id]));
  if(!ids[fixtures.teamA]||!ids[fixtures.teamB])throw new Error('Both configured test teams must already exist in the test project.');
  return ids;
}

async function testCoachScope(api,state,session,ownTeam,otherTeam,label){
  const own=requireSuccess(await rpc(api,session,'staff_list_squad_fixtures',{p_team_id:ownTeam}),label+' own-team fixture read');
  if(!Array.isArray(own))throw new Error(label+' own-team fixture result is not a list.');
  record(state,label+' can read only its assigned team fixtures (returned '+own.length+' rows).');
  requireDenied(await rpc(api,session,'staff_list_squad_fixtures',{p_team_id:otherTeam}),label+' cross-team fixture read');
  record(state,label+' is denied access to the other team.');
}

export async function runPermissionRecipe(env=process.env){
  const config=validateTarget(env),api=await createApi(config),state={passed:0,skipped:0,failed:0};
  const sessions={};
  try{
    const teamIds=await getTeamIds(api,config.fixtures);
    record(state,'test project and both pre-existing test teams verified.');
    for(const name of REQUIRED_PERSONAS)sessions[name]=await signIn(api,state,config.personas[name],name);
    assertDistinctSessions(sessions);
    record(state,'seven distinct verified Auth identities confirmed.');

    // Check account isolation at AAL1 for the actual sensitive public tables.
    // Admin AAL1 and triple-role AAL1 must not inherit the MFA admin exception.
    for(const label of ['supporter','playerA','playerB','coachA','coachB','admin','tripleRole']){
      await verifyCrossAccountPrivacy(
        api,state,sessions[label],sessions[label==='playerB'?'playerA':'playerB'].userId,label
      );
    }

    requireDenied(await rpc(api,null,'staff_list_squad_fixtures',{p_team_id:teamIds[config.fixtures.teamA]}),'Anonymous coach fixture RPC');
    record(state,'anonymous session is denied private coach RPC.');

    requireDenied(await rpc(api,sessions.supporter,'admin_list_management_matches'),'Supporter admin read');
    record(state,'supporter cannot read administrator match management.');
    requireDenied(await rpc(api,sessions.supporter,'staff_list_squad_fixtures',{p_team_id:teamIds[config.fixtures.teamA]}),'Supporter coach fixture read');
    record(state,'supporter cannot read a team roster/fixture RPC.');
    const supporterCallups=requireSuccess(await rpc(api,sessions.supporter,'player_my_callups'),'Supporter callup isolation');
    if(!Array.isArray(supporterCallups)||supporterCallups.length!==0)
      throw new Error('Supporter unexpectedly received player callups.');
    record(state,'supporter receives no player callups.');

    const playerA=requireSuccess(await rpc(api,sessions.playerA,'player_my_callups'),'Player A own callups');
    const playerB=requireSuccess(await rpc(api,sessions.playerB,'player_my_callups'),'Player B own callups');
    if(!Array.isArray(playerA)||!Array.isArray(playerB))throw new Error('Player callup RPC did not return lists.');
    record(state,'both player accounts can read their own callup view.');
    const onlyA=config.fixtures.playerAExclusiveMatchId,onlyB=config.fixtures.playerBExclusiveMatchId;
    const idsA=new Set(playerA.map(item=>item.match_id));
    const idsB=new Set(playerB.map(item=>item.match_id));
    if(!idsA.has(onlyA)||idsA.has(onlyB)||!idsB.has(onlyB)||idsB.has(onlyA))
      throw new Error('Player A/B callups are not isolated to their configured exclusive test matches.');
    record(state,'player A and B callups are isolated by account.');

    await testCoachScope(api,state,sessions.coachA,teamIds[config.fixtures.teamA],teamIds[config.fixtures.teamB],'Coach A');
    await testCoachScope(api,state,sessions.coachB,teamIds[config.fixtures.teamB],teamIds[config.fixtures.teamA],'Coach B');

    requireDenied(await rpc(api,sessions.admin,'admin_list_management_matches'),'Admin AAL1 match-management read');
    record(state,'admin role at AAL1 is insufficient for protected administration.');
    await stepUpTotp(api,sessions.admin,'Admin');
    const adminMatches=requireSuccess(await rpc(api,sessions.admin,'admin_list_management_matches'),'Admin AAL2 match-management read');
    if(!Array.isArray(adminMatches))throw new Error('Admin AAL2 match-management result is not a list.');
    record(state,'admin AAL2 can read the protected management list.');
    // Positive control: the same table denied to AAL1 must be readable by AAL2 admin.
    const otherRoles=requireSuccess(await api.request(
      'rest/v1/user_roles?'+new URLSearchParams({
        select:'role',user_id:'eq.'+sessions.playerA.userId
      }).toString(),{token:sessions.admin.token}
    ),'Admin AAL2 can read a different staging member role');
    if(!Array.isArray(otherRoles)||otherRoles.length<1)
      throw new Error('Admin AAL2 did not get the expected cross-account role read.');
    record(state,'admin AAL2 can read authorized member roles, unlike AAL1.');

    if(!['supporter','player','coach','admin'].every(role=>sessions.tripleRole.persona.roles.includes(role)))
      throw new Error('Triple-role persona must be configured with supporter, player, coach and admin roles.');
    const tripleCallups=requireSuccess(await rpc(api,sessions.tripleRole,'player_my_callups'),'Triple-role player context');
    if(!Array.isArray(tripleCallups))throw new Error('Triple-role player context did not return a list.');
    record(state,'triple-role account retains its player context.');
    requireDenied(await rpc(api,sessions.tripleRole,'admin_list_management_matches'),'Triple-role admin AAL1 read');
    record(state,'triple-role admin context remains blocked at AAL1.');
    await testCoachScope(api,state,sessions.tripleRole,teamIds[config.fixtures.teamA],teamIds[config.fixtures.teamB],'Triple-role coach A');
    await stepUpTotp(api,sessions.tripleRole,'Triple-role admin');
    requireSuccess(await rpc(api,sessions.tripleRole,'admin_list_management_matches'),'Triple-role admin AAL2 read');
    record(state,'triple-role account retains admin access only after AAL2.');

    console.log('Real permission recipe: '+state.passed+' passed, '+state.skipped+' skipped, '+state.failed+' failed.');
    if(state.skipped)process.exitCode=2;
    return state;
  }catch(error){
    state.failed++;
    console.error('FAIL '+String(error?.message||'Permission recipe failed.'));
    console.error('Real permission recipe: '+state.passed+' passed, '+state.skipped+' skipped, '+state.failed+' failed.');
    process.exitCode=1;
    return state;
  }finally{
    for(const [name,session] of Object.entries(sessions)){
      if(!session?.token)continue;
      try{
        const result=await api.request('auth/v1/logout?scope=local',{method:'POST',token:session.token});
        if(!result.ok)console.warn('WARN local test-session cleanup was not confirmed for '+name+'.');
      }catch{console.warn('WARN local test-session cleanup was not confirmed for '+name+'.');}
    }
  }
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  runPermissionRecipe().catch(error=>{
    console.error('BLOCKED '+String(error?.message||'Permission recipe configuration is invalid.'));
    process.exitCode=1;
  });
}
