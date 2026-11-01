/** Defensive CI-only validation of the HTML CSP meta tag.
 * This does not inspect HTTP CSP headers and cannot enforce frame-ancestors.
 * Rejects accidental weakening of a few critical directives.
 */
export function validateEntrypointCsp(html){
 if(typeof html!=='string')throw Error('Invalid HTML for CSP inspection');
 const tag=html.match(/<meta\b[^>]*http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*>/i)?.[0];
 if(!tag)throw Error('Entrypoint CSP meta tag missing');
 const value=tag.match(/\bcontent\s*=\s*(["'])(.*?)\1/i)?.[2];
 if(!value)throw Error('Entrypoint CSP meta content missing');
 const directives=new Map();
 for(const raw of value.split(';')){
  const tokens=raw.trim().split(/\s+/).filter(Boolean);
  if(!tokens.length)continue;
  const name=tokens.shift().toLowerCase();
  if(directives.has(name))throw Error('Duplicate CSP directive: '+name);
  directives.set(name,tokens);
 }
 const requireExact=(name,values)=>{
  const actual=directives.get(name);
  if(!actual||actual.join(' ')!==values.join(' '))
   throw Error('Entrypoint CSP directive requires review: '+name);
 };
 requireExact('default-src',["'self'"]);
 requireExact('object-src',["'none'"]);
 requireExact('base-uri',["'self'"]);
 requireExact('form-action',["'self'"]);
 requireExact('frame-src',["'none'"]);
 if(!directives.has('upgrade-insecure-requests'))
  throw Error('Entrypoint CSP upgrade-insecure-requests missing');
 for(const name of ['script-src','script-src-elem']){
  const sources=directives.get(name);
  if(name==='script-src'&&!sources)throw Error('Entrypoint CSP script-src missing');
  if(!sources)continue;
  if(!sources.includes("'self'")||sources.some(x=>["'unsafe-inline'","'unsafe-eval'","*"].includes(x)||/^http:/i.test(x)))
   throw Error('Entrypoint CSP script policy requires review: '+name);
 }
 return Object.freeze({checked:true,scope:'HTML meta CSP guard only; HTTP headers and frame-ancestors not certified'});
}
