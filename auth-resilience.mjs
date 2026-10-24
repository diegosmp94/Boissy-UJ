/**
 * A finite deadline for supporter-facing Supabase network/CDN actions.
 * This changes no server requests and cannot certify backend availability.
 * Timeout rejects with a generic error; do not ever expose the credentials
 * or server response body in notices or CI.
 */
export const AUTH_SERVICE_DEADLINE_MS=12000;
export class AuthServiceTimeout extends Error{
 constructor(){super('Service momentanément indisponible. Réessaie.');this.name='AuthServiceTimeout';}
}
export function withAuthDeadline(operation,deadline=AUTH_SERVICE_DEADLINE_MS){
 if(!Number.isSafeInteger(deadline)||deadline<1||deadline>60000)
  throw new Error('Invalid authentication timeout');
 let handle;
 const fail=new Promise((_,reject)=>{
  handle=setTimeout(()=>reject(new AuthServiceTimeout()),deadline);
 });
 // Promise.resolve assimilates Supabase/PostgREST thenables and JS imports.
 return Promise.race([Promise.resolve(operation),fail]).finally(()=>clearTimeout(handle));
}
