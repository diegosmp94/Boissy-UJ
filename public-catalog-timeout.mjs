/** Public GET requests have a finite deadline. A timed-out request renders the
 * existing unavailable UI, but route navigation aborts render the next route.
 */
export const PUBLIC_CATALOG_TIMEOUT_MS=12000;
export function boundedPublicRequest(routeSignal,timeoutMs=PUBLIC_CATALOG_TIMEOUT_MS){
 if(!routeSignal||typeof routeSignal.addEventListener!=='function')
  throw new Error('A route AbortSignal is required.');
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)
  throw new Error('Public request timeout must be finite.');
 const controller=new AbortController();
 const relay=()=>controller.abort();
 if(routeSignal.aborted)controller.abort();
 else routeSignal.addEventListener('abort',relay,{once:true});
 const timer=controller.signal.aborted?null:setTimeout(relay,timeoutMs);
 const dispose=()=>{
  if(timer!==null)clearTimeout(timer);
  routeSignal.removeEventListener('abort',relay);
 };
 controller.signal.addEventListener('abort',dispose,{once:true});
 return {signal:controller.signal,dispose};
}
