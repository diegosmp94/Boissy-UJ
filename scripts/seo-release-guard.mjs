/** Step 97: compile-time SEO preflight. No network, no private credentials.
 * Passing this gate means public Pages remains non-indexable; it does NOT
 * certify legal readiness or server-side financial permissions.
 */
import {BOISSY_PUBLIC_URL,PUBLIC_RELEASE_LOCKS,PUBLIC_RELEASE_MODE}
 from '../public-release-locks.mjs';
import {FFF_FEED_STATUS} from '../fff-provider.mjs';
import {FREE_TICKET_STAGING} from '../free-ticket-staging-config.mjs';
export const LOCKED_ROBOTS_TEXT='User-agent: *\nDisallow: /\n';
const META_DESCRIPTION_MIN=65;
const required=[
 'property="og:type" content="website"',
 'property="og:site_name" content="Boissy-UJ"',
 'property="og:locale" content="fr_FR"',
 'property="og:title" content="Boissy-UJ — Union Jeunes"',
 'property="og:url" content="'+BOISSY_PUBLIC_URL+'"',
 'property="og:image" content="'+BOISSY_PUBLIC_URL+'assets/ecusson-boissy-uj.webp"',
 'property="og:image:alt" content="Écusson du club Boissy-UJ"',
 'name="twitter:card" content="summary"',
 'name="twitter:title" content="Boissy-UJ — Union Jeunes"',
 'name="referrer" content="no-referrer"',
 'name="robots" content="noindex, nofollow"',
 'rel="canonical" href="'+BOISSY_PUBLIC_URL+'"':true
];
const count=(source,fragment)=>source.split(fragment).length-1;
export function verifyLockedPublicSeo({html,robots,locks=PUBLIC_RELEASE_LOCKS,
 feedStatus=FFF_FEED_STATUS,ticketConfig=FREE_TICKET_STAGING}={}){
 if(typeof html!=='string'||html.length<2000||html.length>400000||
  typeof robots!=='string'||robots!==LOCKED_ROBOTS_TEXT)
  throw Error('Public Pages robots must remain fully disallowed');
 if(PUBLIC_RELEASE_MODE!=='technical-preview-noindex'||!locks||
  Object.keys(PUBLIC_RELEASE_LOCKS).length!==Object.keys(locks).length||
  Object.keys(PUBLIC_RELEASE_LOCKS).some(k=>locks[k]!==false))
  throw Error('Sensitive production release flag cannot be enabled by Pages build');
 if(feedStatus!=='access-not-granted'||ticketConfig?.enabled!==false)
  throw Error('FFF or ticketing gate unexpectedly enabled on public Pages');
 for(const fragment of required){
  if(count(html,fragment)!==1)throw Error('Missing or repeated controlled SEO metadata: '+fragment);
 }
 const title=html.match(/<title>([^<]{12,120})<\/title>/i)?.[1];
 const description=html.match(/<meta name="description" content="([^"]+)"\s*\/>/i)?.[1];
 if(!title||!description||description.length<META_DESCRIPTION_MIN||
  description.length>185||count(html,'name="description"')!==1)
  throw Error('Public title/description not validated');
 if(count(html,'name="robots"')!==1||
  count(html,'rel="canonical"')!==1||
  count(html,'property="og:url"')!==1||
  count(html,'property="og:image"')!==1||
  !html.includes('property="og:description"'))
  throw Error('Canonical, description, image or robots metadata inconsistent');
 if(/<link\b[^>]*rel=["'](?:alternate|amphtml)["']/i.test(html)||
  /<script\b[^>]*type=["']application\/ld\+json["']/i.test(html))
  throw Error('Unapproved structured data or alternate indexing surfaces');
 if(!html.includes('content="noindex, nofollow"')||
  /<meta\s+name=["']googlebot["']\s+content=["']index/i.test(html))
  throw Error('Indexing allowed unexpectedly');
 if(count(html,BOISSY_PUBLIC_URL+'assets/ecusson-boissy-uj.webp')!==1)
  throw Error('Unexpected metadata image reference');
 return Object.freeze({
  status:'locked-preview',indexingAllowed:false,
  canonical:BOISSY_PUBLIC_URL,descriptionLength:description.length,
  externalServicesChecked:false,paymentPermissionConfirmed:false,
  fffLicenseConfirmed:false,serverFeatureGatesVerified:false
 });
}
