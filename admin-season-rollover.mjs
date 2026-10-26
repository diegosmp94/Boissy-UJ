/** Admin-only manual season rollover. Copies dates/label only, never team or fixture data. */
import {adminSessionStatus} from './admin-security.mjs';
import {nextSeasonPlan,SEASON_STATE_LABELS} from './season-lifecycle-rules.mjs';
import {withAuthDeadline} from './auth-resilience.mjs';
const el=(tag,cls='',text=null)=>{
 const n=document.createElement(tag);
 if(cls)n.className=cls;
 if(text!==null)n.textContent=String(text);
 return n;
};
export async function mountAdminSeasonRollover(root,api,userId){
 if(!root?.isConnected||!api||!userId)return;
 const section=el('section','admin-season-rollover');
 section.setAttribute('aria-label','Reconduction des saisons');
 const h=el('h3','','Préparer la saison suivante');
 const info=el('p','admin-workflow-status','La reconduction crée uniquement une saison prévue avec les dates décalées d’un an. Aucun match, score, classement, joueur ni rôle n’est repris.');
 const field=el('label','admin-form-field','Saison terminée ou archivée');
 const select=el('select','admin-form-control');
 select.setAttribute('aria-label','Saison à reconduire');field.append(select);
 const preview=el('p','admin-workflow-status','Chargement des saisons éligibles…');
 const buttons=el('div','admin-editor-list-actions');
 const refresh=el('button','admin-secondary-btn','Actualiser les saisons');
 const submit=el('button','admin-primary-btn','Préparer la reconduction');
 refresh.type='button';submit.type='button';submit.disabled=true;
 buttons.append(refresh,submit);
 const status=el('p','admin-workflow-status');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 section.append(h,info,field,preview,buttons,status);root.append(section);
 let seasons=[],busy=false,serial=0,confirmed=null;
 const current=()=>seasons.find(x=>x.id===select.value);
 const authorized=async()=>{
  const s=await adminSessionStatus(api,userId);
  return s.status==='admin'&&s.level==='aal2';
 };
 const update=()=>{
  confirmed=null;
  const plan=nextSeasonPlan(current());
  preview.textContent=plan
   ?plan.label+' · '+plan.start+' au '+plan.end+' · statut Prévue. Aucune donnée sportive copiée.'
   :'Aucune saison terminée ou archivée reconductible.';
  submit.disabled=!plan||busy;
  submit.textContent='Préparer la reconduction';
 };
 const reload=async(preferred=null)=>{
  const ticket=++serial;
  submit.disabled=true;select.replaceChildren();
  status.textContent='Vérification des droits et lecture des saisons…';
  try{
   if(!await authorized())throw new Error('denied');
   const {data,error}=await withAuthDeadline(api.rpc('admin_list_management_seasons'));
   if(ticket!==serial||!section.isConnected)return;
   if(error||!Array.isArray(data))throw new Error('unavailable');
   seasons=data.filter(s=>nextSeasonPlan(s));
   for(const season of seasons){
    const opt=el('option','',season.label+' · '+(SEASON_STATE_LABELS[season.state]||season.state));
    opt.value=season.id;select.append(opt);
   }
   if(preferred&&seasons.some(s=>s.id===preferred))select.value=preferred;
   status.textContent=seasons.length+' saison(s) reconductible(s), sous validation MFA AAL2.';
   update();
  }catch{
   if(ticket!==serial||!section.isConnected)return;
   seasons=[];select.replaceChildren();submit.disabled=true;
   preview.textContent='Impossible de vérifier les saisons.';
   status.textContent='Aucune reconduction possible sans validation du rôle administrateur et MFA.';
  }
 };
 select.addEventListener('change',update);
 refresh.addEventListener('click',()=>{if(!busy)void reload(select.value);});
 submit.addEventListener('click',async()=>{
  if(busy||!section.isConnected)return;
  const plan=nextSeasonPlan(current());
  if(!plan)return;
  const key=JSON.stringify(plan);
  if(confirmed!==key){
   confirmed=key;submit.textContent='Confirmer la reconduction de '+plan.label;
   status.textContent='Confirmation nécessaire : création d’une saison vide, sans rencontre ni effectif.';
   return;
  }
  confirmed=null;busy=true;submit.disabled=true;refresh.disabled=true;select.disabled=true;
  try{
   if(!await authorized()){
    status.textContent='Accès administrateur ou MFA non valide. Aucune création.';return;
   }
   const result=await withAuthDeadline(api.rpc('admin_reconduct_season',{p_source_season_id:plan.sourceId}));
   if(!section.isConnected)return;
   if(result.error||!result.data){
    status.textContent=result.error?.code==='23505'
     ?'La saison suivante existe déjà. Actualise la liste.'
     :'Reconduction refusée par Supabase. Aucun résultat confirmé.';
    return;
   }
   status.textContent='Saison '+plan.label+' créée en état Prévue, sans copier les données sportives.';
   root.querySelector('.admin-editor-list-actions button')?.click();
   await reload(plan.sourceId);
  }catch{
   if(section.isConnected)status.textContent='Résultat de reconduction non confirmé. Actualise avant de renouveler une demande.';
  }finally{
   busy=false;
   if(section.isConnected){refresh.disabled=false;select.disabled=false;update();}
  }
 });
 await reload();
}
