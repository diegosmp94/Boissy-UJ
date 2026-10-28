/** Public entrypoint: no application/auth modules are loaded during maintenance.
 * A static Pages mode is not a server-side access-control mechanism.
 */
const destination=new URL('./maintenance.html',import.meta.url);
try{
 const {SITE_MAINTENANCE}=await import('./site-maintenance-config.mjs?check='+Date.now());
 if(typeof SITE_MAINTENANCE?.enabled!=='boolean')throw Error('Maintenance configuration invalid');
 if(SITE_MAINTENANCE.enabled){
  window.location.replace(destination.href);
 }else{
  await import('./app.js');
 }
}catch(error){
 console.error('Boissy-UJ entrypoint unavailable',error);
 window.location.replace(destination.href);
}
