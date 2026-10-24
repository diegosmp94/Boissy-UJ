import { supabaseConfig } from './auth-config.mjs';
import {boundedPublicRequest} from './public-catalog-timeout.mjs';

const ENDPOINT = supabaseConfig.url + '/rest/v1/club_events';
let abortRequest = null;
let activeGeneration = 0;

function el(tag, cls = '', text = null) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== null) node.textContent = String(text);
  return node;
}

export function normalizeEventSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR');
}
export function publicPrice(event) {
  return event.booking_kind === 'free'
    ? 'Gratuit'
    : new Intl.NumberFormat('fr-FR', {style: 'currency', currency: 'EUR'}).format(event.price_cents / 100);
}
export function premiumPrice(event) {
  if (event.premium_price_cents === null || event.premium_price_cents === undefined) return null;
  return event.premium_price_cents === 0
    ? 'Gratuit pour Premium'
    : new Intl.NumberFormat('fr-FR', {style: 'currency', currency: 'EUR'}).format(event.premium_price_cents / 100) + ' pour Premium';
}
export function dateStatus(event, now = Date.now()) {
  const start = Date.parse(event.starts_at);
  const end = event.ends_at ? Date.parse(event.ends_at) : start;
  if (Number.isNaN(start)) return 'undated';
  if (end < now) return 'past';
  return 'upcoming';
}
export function filterEvents(events, {period = 'upcoming', kind = 'all', query = '', now = Date.now()} = {}) {
  const normalized = normalizeEventSearch(query.trim());
  return events
    .filter(event => (kind === 'all' || event.category === kind)
      && (period === 'all' || dateStatus(event, now) === period)
      && (!normalized || [event.title, event.description, event.location_label]
        .some(v => normalizeEventSearch(v).includes(normalized))))
    .sort((a,b) => {
      const diff = Date.parse(a.starts_at) - Date.parse(b.starts_at);
      return period === 'past' ? -diff : diff;
    });
}
function formatDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Date à confirmer';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Paris'
  }).format(new Date(value));
}
function statusLabel(value) {
  return {not_open:'Réservations à venir',open:'Réservations non activées sur ce site',
    full:'Complet selon le club',closed:'Réservations closes'}[value] || 'Billetterie en préparation';
}
function buildEventCard(event) {
  const card = el('article','event-card');
  const badges = el('div','event-badges');
  badges.append(el('span','event-type',({
    club:'Vie du club',sport:'Sport',community:'Communauté',other:'Événement'
  })[event.category] || 'Événement'));
  badges.append(el('span','event-price',publicPrice(event)));
  card.append(badges);
  card.append(el('h3','',event.title));
  if (event.description) card.append(el('p','event-description',event.description));
  const details = el('dl','event-details');
  for (const [key,value] of [
    ['Date',formatDate(event.starts_at)],
    ['Lieu',event.location_label || 'À confirmer'],
    ['Billetterie',statusLabel(event.booking_status)]
  ]) {
    details.append(el('dt','',key),el('dd','',value));
  }
  card.append(details);
  const premium = premiumPrice(event);
  if (premium || event.priority_kind === 'premium') {
    const extras = el('div','event-premium-info');
    if (premium) extras.append(el('span','',premium));
    if (event.priority_kind === 'premium') extras.append(el('span','','Priorité Premium prévue · modalités à confirmer'));
    card.append(extras);
  }
  const reminder = el('p','event-notice',
    'Réservation en ligne indisponible dans cette préversion. Aucun billet QR n’est délivré depuis le site.');
  card.append(reminder);
  return card;
}

function populate(root, rows, online) {
  root.replaceChildren();
  if (!online) {
    const warning = el('p','events-warning',
      'Le calendrier dynamique est en préparation. Aucune date ni réservation non vérifiée n’est affichée.');
    warning.setAttribute('role','status');
    root.append(warning);
  }
  const controls = el('div','event-controls');
  const periodLabel = el('label','event-control-label','Période');
  const period = el('select','event-select');
  period.setAttribute('aria-label','Filtrer les événements par période');
  for (const [value,name] of [['upcoming','À venir'],['past','Passés'],['all','Tous']]){
    const o=el('option','',name);o.value=value;period.append(o);
  }
  periodLabel.append(period);
  const kindLabel=el('label','event-control-label','Catégorie');
  const kind=el('select','event-select');
  kind.setAttribute('aria-label','Filtrer les événements par catégorie');
  for(const [value,name] of [['all','Toutes'],['club','Vie du club'],['sport','Sport'],['community','Communauté'],['other','Autre']]){
    const o=el('option','',name);o.value=value;kind.append(o);
  }
  kindLabel.append(kind);
  const queryLabel=el('label','event-control-label','Recherche');
  const query=el('input','event-search');
  query.type='search';query.placeholder='Chercher un événement';query.maxLength=100;
  query.setAttribute('aria-label','Rechercher un événement');
  queryLabel.append(query);
  controls.append(periodLabel,kindLabel,queryLabel);
  const count=el('p','event-count');
  const list=el('div','event-grid');
  root.append(controls,count,list);
  function redraw(){
    list.replaceChildren();
    const filtered=filterEvents(rows,{period:period.value,kind:kind.value,query:query.value});
    count.textContent=filtered.length+' événement(s) correspondant aux filtres';
    if (filtered.length) filtered.forEach(event=>list.append(buildEventCard(event)));
    else {
      list.append(el('div','event-empty',online
        ? 'Aucun événement publié ne correspond à ces critères pour le moment.'
        : 'Les prochains événements seront affichés après vérification et publication par le club.'));
    }
  }
  for(const input of [period,kind,query]) input.addEventListener(
    input === query ? 'input' : 'change',redraw
  );
  redraw();
}

export function unmountEvents(){
  activeGeneration += 1;
  abortRequest?.abort();
  abortRequest = null;
}
export async function mountEvents(){
  unmountEvents();
  const gen=activeGeneration;
  const root=document.querySelector('#events-public-catalog');
  if(!root)return;
  const ctrl=new AbortController();
  abortRequest=ctrl;
  const deadline=boundedPublicRequest(ctrl.signal);
  root.replaceChildren(el('p','events-loading','Chargement des événements publiés…'));
  try{
    const params=new URLSearchParams({
      select:'id,slug,title,description,category,starts_at,ends_at,location_label,booking_kind,price_cents,premium_price_cents,booking_status,priority_kind',
      published:'eq.true',access_kind:'eq.public',order:'starts_at.asc',limit:'75'
    });
    const response=await fetch(ENDPOINT+'?'+params,{signal:deadline.signal,method:'GET',
      cache:'no-store',headers:{apikey:supabaseConfig.publishableKey,Accept:'application/json'}});
    if(!response.ok)throw new Error('Catalog not available');
    const result=await response.json();
    if(!Array.isArray(result))throw new Error('Unexpected event data');
    if(ctrl.signal.aborted||gen!==activeGeneration||!root.isConnected)return;
    populate(root,result,true);
  }catch{
    if(ctrl.signal.aborted||gen!==activeGeneration||!root.isConnected)return;
    populate(root,[],false);
  }finally{deadline.dispose();}
}
