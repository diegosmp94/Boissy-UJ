import {adminSessionStatus} from './admin-security.mjs';
const el=(tag,cls='',txt=null)=>{const e=document.createElement(tag);
 if(cls)e.className=cls;if(txt!==null)e.textContent=String(txt);return e;};
const input=(type='text')=>{const e=el('input','admin-form-control');e.type=type;return e;};
const field=(label,node)=>{const x=el('label','admin-form-field',label);x.append(node);return x;};
const option=(value,label)=>{const x=el('option','',label);x.value=value;return x;};
export function euroGoalToCents(text){
 if(text===''||text===null||text===undefined)return null;
 const cleaned=String(text).trim().replace(',','.');
 if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(cleaned))throw new Error('Objectif : montant en euros invalide.');
 const [integer,decimal='']=cleaned.split('.');
 const cents=Number(integer)*100+Number(decimal.padEnd(2,'0'));
 if(cents<100||cents>1000000000)throw new Error('Objectif hors limites.');
 return cents;
}
export function donationCampaignDraftError(d){
 if(typeof d.title!=='string'||d.title.trim().length<4||d.title.trim().length>120)
  return 'Titre requis : 4 à 120 caractères.';
 if(typeof d.description!=='string'||d.description.length>2400)
  return 'Description limitée à 2 400 caractères.';
 if(!['general','project'].includes(d.fund_type))return 'Catégorie invalide.';
 if(!['draft','open','closed'].includes(d.status))return 'Statut invalide.';
 if(typeof d.published!=='boolean')return 'Publication invalide.';
 if(d.published&&(d.status==='draft'||!d.starts_at))
  return 'Pour publier, renseignez une date de début et un statut ouvert ou clôturé.';
 if(d.starts_at&&!Number.isFinite(Date.parse(d.starts_at)))
  return 'Date de début incorrecte.';
 if(d.ends_at&&(!d.starts_at||!Number.isFinite(Date.parse(d.ends_at))
  ||Date.parse(d.ends_at)<=Date.parse(d.starts_at)))
  return 'Date de fin incorrecte.';
 try{euroGoalToCents(d.goal_euros);}catch(e){return e.message;}
 return null;
}
export function campaignSaveArgs(d,original=null){
 const err=donationCampaignDraftError(d);
 if(err)throw new Error(err);
 return {
  p_id:original?.id||null,p_title:d.title.trim(),
  p_description:d.description,p_fund_type:d.fund_type,
  p_goal_cents:euroGoalToCents(d.goal_euros),p_status:d.status,
  p_starts_at:d.starts_at?new Date(d.starts_at).toISOString():null,
  p_ends_at:d.ends_at?new Date(d.ends_at).toISOString():null,
  p_published:d.published===true,
  p_expected_updated_at:original?.updated_at||null
 };
}
const localTime=value=>{
 if(!value||!Number.isFinite(Date.parse(value)))return '';
 const date=new Date(value);
 return new Date(date.getTime()-date.getTimezoneOffset()*60000)
  .toISOString().slice(0,16);
};
export async function mountAdminDonationCampaigns(root,api,expectedUserId){
 root.replaceChildren();
 const heading=el('h2','','Dons et campagnes — publication des projets');
 const banner=el('p','admin-workflow-status',
  'Gestion des campagnes uniquement. Aucun encaissement ni reçu fiscal disponible.');
 const status=el('p','admin-workflow-status','Vérification MFA et chargement…');
 status.setAttribute('role','status');
 const choices=el('select','admin-form-control');
 choices.setAttribute('aria-label','Choisir une campagne à modifier');
 const refresh=el('button','admin-secondary-btn','Actualiser les campagnes');
 refresh.type='button';
 const form=el('form','admin-operation-form');
 const title=input(),description=el('textarea','admin-form-control');
 description.rows=4;
 const fund=el('select','admin-form-control');
 fund.append(option('general','Fonds général'),option('project','Projet dédié'));
 const goal=input();goal.inputMode='decimal';goal.placeholder='Objectif en euros, facultatif';
 const state=el('select','admin-form-control');
 state.append(option('draft','Brouillon'),option('open','Ouverte'),option('closed','Clôturée'));
 const start=input('datetime-local'),end=input('datetime-local');
 const published=input('checkbox');
 const publishLabel=field('Publier cette campagne sur le site',published);
 for(const [caption,node] of [
  ['Titre officiel',title],['Description du projet',description],
  ['Fonds',fund],['Objectif € (facultatif)',goal],['Statut',state],
  ['Début de la campagne',start],['Fin (facultatif)',end]
 ])form.append(field(caption,node));
 form.append(publishLabel);
 const save=el('button','admin-primary-btn','Enregistrer la campagne');
 save.type='submit';form.append(save);
 root.append(heading,banner,status,field('Sélectionner une campagne',choices),
  refresh,form);
 let rows=[],busy=false,confirmation=null,serial=0;
 const selected=()=>rows.find(x=>x.id===choices.value)||null;
 const draft=()=>({title:title.value,description:description.value,
  fund_type:fund.value,goal_euros:goal.value,status:state.value,
  starts_at:start.value,ends_at:end.value,published:published.checked});
 function paint(){
  const c=selected();
  title.value=c?.title||'';description.value=c?.description||'';
  fund.value=c?.fund_type||'general';
  goal.value=Number.isSafeInteger(c?.goal_cents)?
   (c.goal_cents/100).toFixed(2):'';
  state.value=c?.status||'draft';start.value=localTime(c?.starts_at);
  end.value=localTime(c?.ends_at);published.checked=c?.published===true;
  confirmation=null;
  status.textContent=c?'Campagne enregistrée — modification protégée par version.':
   'Nouvelle campagne, aucun contenu publié.';
 }
 const permitted=async()=>{
  const v=await adminSessionStatus(api,expectedUserId);
  return root.isConnected&&v.status==='admin'&&
    v.level==='aal2'&&v.userId===expectedUserId;
 };
 async function reload(focus=null){
  const run=++serial;
  save.disabled=true;refresh.disabled=true;
  if(!await permitted()){status.textContent='Accès administrateur MFA requis.';return;}
  const response=await api.rpc('admin_list_donation_campaigns');
  if(run!==serial||!root.isConnected)return;
  if(response.error||!Array.isArray(response.data)){
   status.textContent='Lecture impossible. Actualisez après vérification de Supabase.';
   return;
  }
  rows=response.data;
  choices.replaceChildren(option('new','+ Nouvelle campagne'));
  for(const item of rows)choices.append(option(item.id,
   item.title+' · '+({draft:'Brouillon',open:'Ouverte',closed:'Clôturée'})[item.status]));
  choices.value=rows.some(x=>x.id===focus)?focus:'new';
  paint();save.disabled=false;refresh.disabled=false;
 }
 choices.addEventListener('change',paint);
 refresh.addEventListener('click',()=>{if(!busy)void reload(selected()?.id);});
 for(const node of [title,description,fund,goal,state,start,end,published])
  node.addEventListener('input',()=>{confirmation=null;});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||save.disabled)return;
  const prev=selected();let args;
  try{args=campaignSaveArgs(draft(),prev);}catch(e){
   status.textContent=e.message;return;
  }
  const key=JSON.stringify(args);
  if((args.p_published||prev?.published||prev?.status==='open')&&confirmation!==key){
   confirmation=key;
   status.textContent='Publication ou modification sensible : vérifiez, puis confirmez en cliquant une seconde fois.';
   return;
  }
  busy=true;save.disabled=true;refresh.disabled=true;
  try{
   if(!await permitted()){status.textContent='MFA ou rôle administrateur expiré.';return;}
   const result=await api.rpc('admin_save_donation_campaign',args);
   if(!root.isConnected)return;
   if(result.error){status.textContent='Enregistrement refusé : vérifiez les droits et la version du dossier.';return;}
   status.textContent='Campagne enregistrée sur le serveur.';
   await reload(result.data);
  }catch{if(root.isConnected)status.textContent='Enregistrement indisponible. Aucune campagne publiée.';}
  finally{busy=false;if(root.isConnected){save.disabled=false;refresh.disabled=false;}}
 });
 await reload();
}
