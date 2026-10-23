/** Public Premium comparison — informational only. Never creates subscriptions or charges.
 * Prices come from the validated Boissy-UJ specification; all benefits awaiting
 * club approval are described as planned, never represented as active.
 */
export const PREMIUM_TERMS=Object.freeze({
 monthly:Object.freeze({
  id:'monthly',title:'Premium mensuel',price:'10 €',period:'/ mois',
  total:'10 € facturés par mois après activation',terms:'Sans engagement · résiliation possible',
  note:'Le renouvellement mensuel devra être confirmé dans les conditions définitives.'
 }),
 annual:Object.freeze({
  id:'annual',title:'Premium 12 mois',price:'100 €',period:'/ 12 mois',
  total:'100 € pour une période de 12 mois',terms:'Sans renouvellement automatique',
  note:'Au terme des 12 mois, aucune reconduction automatique n’est prévue.'
 })
});
export const PREMIUM_BENEFITS=Object.freeze([
 {label:'Actualités et matchs publiés',free:true,premium:true,status:'public'},
 {label:'Suivi de ses équipes',free:true,premium:true,status:'public'},
 {label:'Contenus exclusifs du club',free:false,premium:true,status:'planned'},
 {label:'Priorité sur certains événements',free:false,premium:true,status:'planned'},
 {label:'Votes Awards lorsqu’ils seront autorisés',free:false,premium:true,status:'planned'},
 {label:'Avantages partenaires annoncés',free:false,premium:true,status:'planned'}
]);
export function premiumPeriod(key){
 return PREMIUM_TERMS[key]||PREMIUM_TERMS.monthly;
}
export function premiumComparison(key){
 const offer=premiumPeriod(key);
 return {...offer,entitlements:PREMIUM_BENEFITS.map(b=>({...b}))};
}

const el=(tag,cls='',content=null)=>{
 const node=document.createElement(tag);if(cls)node.className=cls;
 if(content!==null)node.textContent=String(content);
 return node;
};
/** Interactive accessible toggle, not a checkout. Data and buttons never touch
 * auth, payment, localStorage or external services.
 */
export function mountPremiumPlans(root=document.getElementById('premium-plan-selector')){
 if(!root)return;
 root.replaceChildren();
 const box=el('section','premium-stage');
 box.setAttribute('aria-labelledby','premium-stage-heading');
 box.append(el('span','tiny-label','COMPARER LES FORMULES'));
 box.append(el('h2','','Une formule selon votre rythme.'));
 box.querySelector('h2').id='premium-stage-heading';
 const lead=el('p','premium-stage-lead',
  'La présentation des formules est disponible. Les souscriptions et paiements ne sont pas encore ouverts.');
 box.append(lead);
 const toggle=el('div','premium-period-toggle');
 toggle.setAttribute('role','group');
 toggle.setAttribute('aria-label','Choisir la période du Premium');
 const buttons=new Map();
 for(const [id,label] of [['monthly','Mensuel'],['annual','12 mois']]){
  const button=el('button','premium-period-choice',label);
  button.type='button';button.dataset.period=id;
  button.setAttribute('aria-pressed',String(id==='monthly'));
  toggle.append(button);buttons.set(id,button);
 }
 const compare=el('div','premium-comparison');
 const free=el('article','premium-compare-card');
 free.append(el('span','tiny-label','SUPPORTER'));
 free.append(el('h3','','Gratuit'));
 free.append(el('p','','Pour suivre les équipes et les contenus publics du club.'));
 const features=el('ul','premium-benefit-list');
 for(const benefit of PREMIUM_BENEFITS){
  const item=el('li','');
  item.append(el('span','premium-benefit-mark',benefit.free?'✓':'—'),
   el('span','',benefit.label+(benefit.status==='planned'?' · à venir':'')));
  features.append(item);
 }
 free.append(features);
 const freeLink=el('a','btn btn-outline','Accéder à Mon espace');
 freeLink.href='#/mon-espace';free.append(freeLink);
 const paid=el('article','premium-compare-card premium-compare-featured');
 const title=el('h3','','Premium mensuel');
 const cost=el('div','premium-price-row');
 const price=el('strong','',PREMIUM_TERMS.monthly.price);
 const period=el('span','',PREMIUM_TERMS.monthly.period);
 cost.append(price,period);
 const terms=el('p','premium-terms');
 const total=el('p','premium-billing');
 const premiumFeatures=el('ul','premium-benefit-list');
 for(const benefit of PREMIUM_BENEFITS){
  const item=el('li','');
  item.append(el('span','premium-benefit-mark','✓'),
   el('span','',benefit.label+(benefit.status==='planned'?' · prévu':'')));
  premiumFeatures.append(item);
 }
 const unavailable=el('p','premium-unavailable',
  'Souscription indisponible : aucun paiement ne peut être effectué depuis cette page.');
 const details=el('p','premium-billing-note');
 paid.append(el('span','tiny-label','PREMIUM · EN PRÉPARATION'),
  title,cost,terms,total,premiumFeatures,unavailable,details);
 compare.append(free,paid);
 const foot=el('p','premium-future-note',
  'Les avantages Premium sont indicatifs jusqu’à publication des conditions définitives par le club. '+
  'Aucun achat, renouvellement ou accès payant n’est disponible.');
 function paint(id){
  const offer=premiumComparison(id);
  for(const [key,button] of buttons)button.setAttribute('aria-pressed',String(key===offer.id));
  title.textContent=offer.title;
  price.textContent=offer.price;period.textContent=offer.period;
  terms.textContent=offer.terms;total.textContent=offer.total;
  details.textContent=offer.note;
  paid.dataset.period=offer.id;
 }
 for(const [id,button] of buttons)button.addEventListener('click',()=>paint(id));
 box.append(toggle,compare,foot);root.append(box);
 paint('monthly');
}
