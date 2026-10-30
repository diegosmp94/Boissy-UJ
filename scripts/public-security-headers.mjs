/** Read-only summary of HTTP response header presence on the public entrypoint.
 * No header values, cookies, URLs or visitor data are stored or logged.
 * A present header is NOT proof of a safe directive or full compliance.
 */
export function summarizePublicSecurityHeaders(headers){
 const get=name=>{
  if(!headers||typeof headers.get!=='function')return '';
  const value=headers.get(name);
  return typeof value==='string'?value.trim():'';
 };
 return Object.freeze({
  checked:Boolean(headers&&typeof headers.get==='function'),
  hstsPresent:Boolean(get('strict-transport-security')),
  cspHttpHeaderPresent:Boolean(get('content-security-policy')),
  referrerPolicyHeaderPresent:Boolean(get('referrer-policy')),
  nosniffPresent:get('x-content-type-options').toLowerCase()==='nosniff',
  frameOptionsHeaderPresent:Boolean(get('x-frame-options')),
  scope:'presence-only; CSP meta checked separately; no security certification'
 });
}
