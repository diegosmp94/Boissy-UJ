/**
 * Step 64. Public-only, read-only release health verification.
 * Does not log cookies, full navigation URLs, emails or response contents.
 * The manifest must match main's exact commit when BOISSY_EXPECTED_COMMIT
 * is provided. A valid manifest without that input is NOT "current main".
 */
export const PUBLIC_SITE_HOST='diegosmp94.github.io';
export const PUBLIC_SITE_PATH='/Boissy-UJ/';
const SHA=/^[0-9a-f]{40}$/;
const types=Object.freeze({
 html:/^text\/html(?:\s*;|$)/i,
 script:/^(?:text|application)\/javascript(?:\s*;|$)/i,
 css:/^text\/css(?:\s*;|$)/i,
 json:/^application\/json(?:\s*;|$)/i,
 txt:/^text\/plain(?:\s*;|$)/i
});
export function checkPublicSiteBase(input){
 let url;
 try{url=new URL(String(input));}catch{throw Error('Invalid publication base URL');}
 const official=url.protocol==='https:'&&url.hostname===PUBLIC_SITE_HOST&&
   url.pathname===PUBLIC_SITE_PATH&&!url.port;
 const local=url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&
   url.pathname==='/';
 if(!official&&!local)throw Error('Only official Boissy-UJ GitHub Pages or loopback test origin allowed');
 if(url.username||url.password||url.search||url.hash)
  throw Error('Publication URL cannot carry credentials or query parameters');
 return url;
}
export function validatePublicReleaseRecord(raw,expected=''){
 let record;
 try{record=JSON.parse(raw);}catch{throw Error('Public release JSON malformed');}
 if(!record||typeof record!=='object'||Array.isArray(record)||
   Object.keys(record).sort().join(',')!=='commit,source'||
   record.source!=='main'||!SHA.test(record.commit))
  throw Error('Public release manifest is missing a valid main commit');
 if(expected!==''&&(!SHA.test(expected)||record.commit!==expected))
  throw Error('Published commit does not match the requested main commit');
 return Object.freeze({commit:record.commit,mainMatched:expected!==''});
}
export function inspectPublicAsset({base,file,type,expected=[],responseUrl,mime,body,expectedCommit=''}){
 if(!Array.isArray(expected)||!types[type]||typeof body!=='string')
  throw Error('Invalid live asset inspection input');
 const root=checkPublicSiteBase(base);
 const target=new URL(file,root);
 let arrived;
 try{arrived=new URL(responseUrl);}catch{throw Error('Invalid public asset response URL');}
 if(arrived.origin!==root.origin)throw Error('Unexpected cross-site redirect');
 if(arrived.pathname!==target.pathname||arrived.search||arrived.hash)
  throw Error('Unexpected route redirect in public assets');
 if(!types[type].test(String(mime||'')))
  throw Error('Unexpected MIME type for public '+type+' asset');
 const missing=expected.filter(x=>!body.includes(x));
 if(missing.length)throw Error('Missing expected markers: '+missing.join(', '));
 if(type==='json'&&file==='release.json')
  return validatePublicReleaseRecord(body,expectedCommit);
 if(type==='html'&&file===''){
  if(!body.includes('http-equiv="Content-Security-Policy"')||
     !body.includes('name="referrer" content="no-referrer"')||
     !body.includes('name="robots" content="noindex, nofollow"'))
    throw Error('Public legal/security guard absent from entrypoint');
 }
 return Object.freeze({checked:true});
}
