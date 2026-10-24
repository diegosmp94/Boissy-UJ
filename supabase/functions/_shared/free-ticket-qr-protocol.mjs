/**
 * Server-only protocol for planned FREE Boissy-UJ tickets.
 *
 * An opaque 256-bit bearer secret is presented by an attendee at check-in.
 * The server stores only SHA-256(token), never the plaintext ticket secret.
 * IMPORTANT: parsing or digesting a QR NEVER proves admission: the gate must
 * atomically update a server-side issued ticket after capacity and cancellation
 * checks. Do not distribute this module in the public web bundle.
 */
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TOKEN=/^[a-f0-9]{64}$/;
export const BOISSY_QR_VERSION='BUJ1';
export const BOISSY_QR_LENGTH=5+36+1+64; // BUJ1:<uuid>:<64 hex>
export function prepareFreeTicketCode(eventId,secretHex){
 if(typeof eventId!=='string'||!UUID.test(eventId)||
    typeof secretHex!=='string'||!TOKEN.test(secretHex))
  throw new Error('Invalid opaque free-ticket reference');
 return BOISSY_QR_VERSION+':'+eventId+':'+secretHex;
}
export function createServerOnlyFreeTicketCode(eventId){
 if(!UUID.test(String(eventId)))throw new Error('Invalid event ID');
 const secret=randomBytes(32);
 if(!Buffer.isBuffer(secret)||secret.length!==32)
  throw new Error('Secure 256-bit server randomness is required');
 return prepareFreeTicketCode(eventId,secret.toString('hex'));
}
export function parseFreeTicketCode(scanned){
 if(typeof scanned!=='string'||scanned.length!==BOISSY_QR_LENGTH)
  return null;
 const parts=scanned.split(':');
 if(parts.length!==3||parts[0]!==BOISSY_QR_VERSION||
    !UUID.test(parts[1])||!TOKEN.test(parts[2]))return null;
 return Object.freeze({eventId:parts[1],secret:parts[2]});
}
export function digestFreeTicketSecret(secret){
 if(typeof secret!=='string'||!TOKEN.test(secret))
  throw new Error('Invalid ticket secret');
 return createHash('sha256').update(Buffer.from(secret,'hex')).digest('hex');
}
/** This compares recorded hashes only, never plaintext or an external account. */
export function equalsRecordedTicketDigest(expected,actual){
 if(typeof expected!=='string'||typeof actual!=='string'||
    !TOKEN.test(expected)||!TOKEN.test(actual))return false;
 return timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(actual,'hex'));
}
/**
 * Planning-only helper. Never authorizes ticket issue or validates capacity:
 * only the atomic database transaction can decide that.
 */
export function freeEventTicketEligibility(event,now=Date.now()){
 if(!event||event.booking_kind!=='free'||event.access_kind!=='public'||
    event.published!==true||event.booking_status!=='open')
  return Object.freeze({eligible:false,reason:'event_not_open'});
 if(!Number.isSafeInteger(event.capacity)||event.capacity<=0)
  return Object.freeze({eligible:false,reason:'capacity_unverified'});
 const starts=Date.parse(event.starts_at||'');
 const ends=Date.parse(event.ends_at||'');
 if(!Number.isFinite(starts)||!Number.isFinite(ends)||
    ends<=starts||starts<=now)
  return Object.freeze({eligible:false,reason:'event_not_future'});
 return Object.freeze({eligible:true,reason:'server_authorization_still_required'});
}
/** A scanner's display-only state, not admission: signed-in authorized staff
 * and an atomic server-side state transition are still mandatory.
 */
export function freeTicketScanLabel(status){
 return {
  issued:'Contrôle serveur obligatoire avant entrée',
  checked_in:'Billet déjà utilisé · accès refusé',
  cancelled:'Billet annulé · accès refusé',
  expired:'Billet expiré · accès refusé'
 }[status]||'Billet inconnu · accès refusé';
}
