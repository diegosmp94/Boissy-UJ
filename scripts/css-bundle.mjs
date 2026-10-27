/** Step 95: bundle local styles preserving exact link order and same-origin URLs.
 * Operates on a STATIC trusted index.html; no arbitrary external CSS or code.
 */
export const PUBLIC_CSS_BUNDLE='site-bundle.css';
const CSS_LINK=/<link\s+rel="stylesheet"\s+href="\.\/([a-z0-9-]+\.css)"\s*\/>/g;
export function findLocalStylesheets(html){
 if(typeof html!=='string'||html.length>300000)
  throw Error('Invalid public HTML');
 const matches=[...html.matchAll(CSS_LINK)];
 const names=matches.map(m=>m[1]);
 if(names.length<15||names.length>60||new Set(names).size!==names.length||
  names.includes(PUBLIC_CSS_BUNDLE))
  throw Error('Unexpected public CSS link manifest');
 // No third-party stylesheet, preload-as-style or CSS import may escape CSP.
 const all=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/gi)];
 if(all.length!==matches.length)
  throw Error('Stylesheet source outside local allowlist');
 return names;
}
export function buildPublicCssBundle(html,contents){
 const names=findLocalStylesheets(html);
 if(!(contents instanceof Map)||contents.size!==names.length)
  throw Error('Missing or unexpected CSS source');
 let bundle='/* Boissy-UJ combined local stylesheet. Source order retained. */\n';
 for(const name of names){
  const source=contents.get(name);
  if(typeof source!=='string'||source.length>300000||
   /@import\s/i.test(source)||/url\(\s*['"]?https?:/i.test(source))
   throw Error('Unsupported CSS content');
  bundle+='\n/* SOURCE '+name+' */\n'+source+'\n';
 }
 let count=0;
 const updated=html.replace(CSS_LINK,()=>{
  count++;
  return count===1?'<link rel="stylesheet" href="./'+PUBLIC_CSS_BUNDLE+'" />':'';
 });
 if(count!==names.length||!updated.includes('href="./'+PUBLIC_CSS_BUNDLE+'"')||
  findLocalStylesheetsSafely(updated)!==1)
  throw Error('CSS bundle replacement incomplete');
 return Object.freeze({html:updated,css:bundle,names});
}
function findLocalStylesheetsSafely(html){
 return [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/gi)].length;
}
