/** Update only the reviewed public toggle; no credentials or database writes. */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const SOURCE_PATTERN=/^export const SITE_MAINTENANCE=Object\.freeze\(\{enabled:(?:true|false)\}\);\n$/;
export function maintenanceSourceForAction(source,action){
 if(action!=='activer'&&action!=='desactiver')throw Error('Expected activer or desactiver');
 if(typeof source!=='string'||!SOURCE_PATTERN.test(source))
  throw Error('Refusing to modify an unexpected maintenance configuration');
 return 'export const SITE_MAINTENANCE=Object.freeze({enabled:'+(action==='activer')+'});\n';
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const sourcePath=resolve(process.cwd(),'site-maintenance-config.mjs');
 const next=maintenanceSourceForAction(readFileSync(sourcePath,'utf8'),process.env.BOISSY_MAINTENANCE_ACTION);
 writeFileSync(sourcePath,next);
 console.log('Boissy-UJ maintenance switch: '+(next.includes('enabled:true')?'ACTIVÉ':'DÉSACTIVÉ'));
}
