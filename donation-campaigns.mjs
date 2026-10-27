/** Published Boissy-UJ campaigns: read only, no checkout or pledge forms. */
import {supabaseConfig} from './auth-config.mjs';
import {boundedPublicRequest} from './public-catalog-timeout.mjs';
const ENDPOINT=supabaseConfig.url+'/rest/v1/donation_campaigns';
const el=(tag,cls='',value=null)=>{
 const node=document.createElement(tag);if(cls)node.className=cls;
 if(value!==null)node.textContent=String(value);return node;
};
export function publicDonationCampaigns(rows,now=Date.now()){
 if(!Array.isArray(rows))return [];
 return rows.filter(c=>c&&c.published===true&&
  ['open','closed'].includes(c.status)&&
  ['general','project'].includes(c.fund_type)&&
  typeof c.title==='string'&&c.title.trim()&&
  c.starts_at&&Number.isFinite(Date.parse(c.starts_at)))
 .map(c=>({...c,availability:c.status==='closed'?'closed':
  Date.parse(c.starts_at)>now?'scheduled':
  c.ends_at&&Date.parse(c.ends_at)<=now?'ended':'open'}))
 .sort((a,b)=>Date.parse(b.starts_at)-Date.parse(a.starts_at))
 .slice(0,60);
}
export function donationGoalText(goal){
 if(!Number.isSafeInteger(goal)||goal<100)return null;
 return new Intl.NumberFormat('fr-FR',{style:'currency',
  currency:'EUR',maximumFractionDigits:0}).format(goal/100);
}
let current=0,abort=null;
export function unmountDonationCampaigns(){
 current++;abort?.abort();abort=null;
}
export async function mountDonationCampaigns(){
 unmountDonationCampaigns();const generation=current;
 const root=document.getElementById('donation-campaigns-public');
 if(!root)return;
 const ctrl=new AbortController();abort=ctrl;
 const deadline=boundedPublicRequest(ctrl.signal);
 root.replaceChildren(el('p','campaign-empty','Chargement des projets publiés…'));
 try{
  const query=new URLSearchParams({
   select:'id,title,description,fund_type,goal_cents,status,published,starts_at,ends_at',
   published:'eq.true',status:'in.(open,closed)',order:'starts_at.desc',limit:'60'
  });
  const response=await fetch(ENDPOINT+'?'+query,{method:'GET',cache:'no-store',
   signal:deadline.signal,headers:{apikey:supabaseConfig.publishableKey,
    Accept:'application/json'}});
  if(!response.ok)throw new Error('Campaign catalog unavailable');
  const data=await response.json();
  if(!Array.isArray(data))throw new Error('Campaign list unavailable');
  if(ctrl.signal.aborted||generation!==current||!root.isConnected)return;
  const rows=publicDonationCampaigns(data);
  root.replaceChildren();
  if(!rows.length){root.append(el('p','campaign-empty',
   'Aucune campagne publiée pour le moment. Les projets seront présentés après validation par le club.'));return;}
  const grid=el('div','campaign-grid');
  for(const c of rows){
   const card=el('article','campaign-public-card');
   card.append(el('span','tiny-label',c.fund_type==='general'
    ?'FONDS GÉNÉRAL':'PROJET DU CLUB'));
   card.append(el('h3','',c.title.trim()));
   if(c.description)card.append(el('p','',c.description));
   if(donationGoalText(c.goal_cents))card.append(el('p','campaign-goal',
    'Objectif annoncé : '+donationGoalText(c.goal_cents)+
    '. Le montant réellement collecté n’est pas communiqué.'));
   card.append(el('p','campaign-state',({
    open:'Campagne présentée · dons en ligne désactivés',
    closed:'Campagne clôturée · dons indisponibles',
    scheduled:'Ouverture annoncée ultérieurement · dons indisponibles',
    ended:'Période terminée · dons indisponibles'
   })[c.availability]));
   grid.append(card);
  }
  root.append(grid);
 }catch{
  if(ctrl.signal.aborted||generation!==current||!root.isConnected)return;
  root.replaceChildren(el('p','campaign-empty',
   'Impossible de vérifier les campagnes publiées pour le moment. Aucun objectif ou montant de collecte n’est inventé.'));
 }finally{deadline.dispose();}
}
