/** Limits only public catalog requests so an unreachable backend never leaves a
 * loading screen stuck indefinitely. Route unmount still owns its AbortController.
 * A timeout cancels network work, not the route, allowing clear empty/error UI.
 */
export const PUBLIC_CATALOG_TIMEOUT_MS=12000;
export function boundedPublicSignal(routeSignal,timeoutMs=PUBLIC_CATALOG_TIMEOUT_MS){
 if(!routeSignal||typeof routeSignal.addEventListener!=='function')
  throw new Error('An existing route AbortSignal is required.');
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)
  throw new Error('Public request timeout must be finite.');
 const controller=new AbortController();
 if(routeSignal.aborted)controller.abort();
 else routeSignal.addEventListener('abort',()=>controller.abort(),{once:true});
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 controller.signal.addEventListener('abort',()=>clearTimeout(timer),{once:true});
 // On success the timer is still allowed to expire harmlessly; callers retain
 // the original route signal to distinguish navigation from a network timeout.
 return controller.signal;
}
