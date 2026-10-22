/** Fail-closed recovery target guard. This script never opens a DB connection or logs DSNs.
 * The actual restore is intentionally a separate, human-controlled command.
 */
const source=process.env.SOURCE_DATABASE_URL;
const target=process.env.RECOVERY_DATABASE_URL;
if(!source||!target){
 console.error('Recovery safety gate: set SOURCE_DATABASE_URL and RECOVERY_DATABASE_URL privately.');
 process.exitCode=1;
}else{
 try{
  const src=new URL(source),dst=new URL(target);
  const local=new Set(['localhost','127.0.0.1','::1','[::1]']);
  if(!['postgres:','postgresql:'].includes(src.protocol)||
     !['postgres:','postgresql:'].includes(dst.protocol)||
     !local.has(dst.hostname)||
     src.href===dst.href||
     dst.hostname===src.hostname){
   throw new Error('unsafe-target');
  }
  console.log('Recovery target verified: distinct, local PostgreSQL only. No connection attempted.');
 }catch{
  console.error('Recovery safety gate refused target. Check local isolated PostgreSQL and DSN formats.');
  process.exitCode=1;
 }
}
