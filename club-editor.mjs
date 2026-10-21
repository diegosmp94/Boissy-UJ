/**
 * Boissy-UJ — éditeur du portrait du club.
 * Le Control Center public n'offre qu'un aperçu LOCAL.
 * L'éditeur réel ne se monte que dans Mon espace, après Auth + AAL2 + rôle admin.
 * La RPC Supabase est la seule autorité pour lire les brouillons et publier.
 */
import {supabaseConfig} from './auth-config.mjs';
import {IDENTITY_SECTIONS} from './club-identity.mjs';

const make=(tag,cls='',text=null)=>{
  const n=document.createElement(tag);if(cls)n.className=cls;
  if(text!==null)n.textContent=String(text);return n;
};
const button=(label,cls='staff-action')=>{
  const b=make('button',cls,label);b.type='button';return b;
};
export function validateClubIdentityDraft(raw){
  const section=String(raw.section||'');
  const title=String(raw.title||'').trim();
  const body=String(raw.body||'').trim();
  const order=raw.sortOrder===''?NaN:Number(raw.sortOrder);
  const publish=raw.publish===true;
  const rightsConfirmed=raw.rightsConfirmed===true;
  const errors=[];
  if(!IDENTITY_SECTIONS.some(x=>x.id===section))errors.push('Sélectionne une rubrique valide.');
  if(title.length<4||title.length>160)errors.push('Le titre doit avoir entre 4 et 160 caractères.');
  if(body.length<10||body.length>6000)errors.push('Le texte doit avoir entre 10 et 6 000 caractères.');
  if(!Number.isInteger(order)||order<0||order>10000)errors.push('L’ordre doit être un entier de 0 à 10 000.');
  if(publish&&!rightsConfirmed)errors.push('Confirme les droits et l’exactitude avant publication.');
  return {valid:errors.length===0,errors,section,title,body,sortOrder:order,publish,rightsConfirmed};
}
export function canEditClubIdentity(expectedId,verifiedId,roles,aal,enabled=supabaseConfig.adminEnabled){
  return Boolean(enabled&&expectedId&&expectedId===verifiedId
    &&Array.isArray(roles)&&roles.includes('admin')&&aal==='aal2');
}
export function clubIdentityRpcArgs(review,selected=null){
  if(!review.valid)throw new Error('Validation du formulaire requise');
  return {
    p_id:selected?.id||null,
    p_section:review.section,
    p_title:review.title,
    p_body:review.body,
    p_sort_order:review.sortOrder,
    p_publish:review.publish,
    p_rights_confirmed:review.rightsConfirmed,
    p_expected_updated_at:selected?.updated_at||null
  };
}
function inputLabel(title,control){
  const l=make('label','club-editor-field',title);l.append(control);return l;
}
function fields(form){
  const section=make('select','club-editor-control');
  section.setAttribute('aria-label','Rubrique du club');
  for(const x of IDENTITY_SECTIONS){
    const option=make('option','',x.label);option.value=x.id;section.append(option);
  }
  const title=make('input','club-editor-control');
  title.maxLength=160;title.required=true;
  const body=make('textarea','club-editor-control');
  body.maxLength=6000;body.rows=7;body.required=true;
  const order=make('input','club-editor-control');
  order.type='number';order.min='0';order.max='10000';order.step='1';order.value='0';
  const publish=make('input');publish.type='checkbox';
  const rights=make('input');rights.type='checkbox';
  const publishLabel=inputLabel('Demander une publication officielle',publish);
  publishLabel.classList.add('club-editor-check');
  const rightsLabel=inputLabel('Je confirme la vérification des faits, des droits à l’image et des autorisations nécessaires.',rights);
  rightsLabel.classList.add('club-editor-check');
  form.append(
    inputLabel('Rubrique',section),inputLabel('Titre',title),
    inputLabel('Contenu vérifiable',body),inputLabel('Ordre d’affichage',order),
    publishLabel,rightsLabel
  );
  return {section,title,body,order,publish,rights};
}
function values(fields){
  return {
    section:fields.section.value,title:fields.title.value,body:fields.body.value,
    sortOrder:fields.order.value,publish:fields.publish.checked,
    rightsConfirmed:fields.rights.checked
  };
}
function fill(fields,row){
  fields.section.value=row?.section||IDENTITY_SECTIONS[0].id;
  fields.title.value=row?.title||'';
  fields.body.value=row?.body||'';
  fields.order.value=String(row?.sort_order??0);
  fields.publish.checked=row?.published===true;
  fields.rights.checked=false;
}
function preview(root,review){
  root.replaceChildren();
  if(!review.valid){
    const ul=make('ul','club-editor-errors');
    for(const error of review.errors)ul.append(make('li','',error));
    root.append(ul);return;
  }
  const article=make('article','club-editor-sample');
  article.append(
    make('span','tiny-label',IDENTITY_SECTIONS.find(x=>x.id===review.section)?.label||'Club'),
    make('h3','',review.title),make('p','',review.body),
    make('small','',review.publish?'APERÇU : publication demandée':'APERÇU : brouillon non publié')
  );
  root.append(article);
}
function showEditorFrame(root,heading,description){
  root.append(make('h2','',heading),make('p','club-editor-help',description));
  const form=make('form','club-editor-form');
  form.noValidate=true;
  const f=fields(form);
  const feedback=make('p','club-editor-feedback');
  feedback.setAttribute('role','status');
  const sample=make('div','club-editor-preview');
  sample.setAttribute('aria-live','polite');
  const action=button('Prévisualiser');
  form.append(action);
  root.append(form,feedback,sample);
  const redraw=()=>preview(sample,validateClubIdentityDraft(values(f)));
  form.addEventListener('input',redraw);
  form.addEventListener('change',redraw);
  action.addEventListener('click',redraw);
  fill(f,null);
  return {form,fields:f,feedback,sample,action,redraw};
}
/** Preview intentionally offline and non-persistent; no API keys or calls. */
export function mountClubIdentityPreview(root){
  root.replaceChildren();
  const frame=showEditorFrame(root,'Portrait du club · atelier éditorial',
    'Simulation locale. Prépare une rubrique Histoire, Valeurs, Organisation ou Projets. Rien n’est sauvegardé ni publié, même en cochant la case de publication. Ne saisis pas de données personnelles.');
  frame.feedback.textContent='Prévisualisation exclusivement locale — aucune écriture.';
  frame.redraw();
  return frame;
}
async function verifyAdmin(api,expectedId){
  if(!supabaseConfig.adminEnabled||!expectedId||!api)return false;
  const [user,mfa]=await Promise.all([
    api.auth.getUser(),api.auth.mfa.getAuthenticatorAssuranceLevel()
  ]);
  if(user.error||mfa.error||user.data?.user?.id!==expectedId
    ||mfa.data?.currentLevel!=='aal2')return false;
  const roles=await api.from('user_roles').select('role').eq('user_id',expectedId);
  if(roles.error)return false;
  return canEditClubIdentity(expectedId,user.data.user.id,
    (roles.data||[]).map(x=>x.role),mfa.data.currentLevel);
}
/** Private screen, never mounted from #/control-center. */
export async function mountAuthenticatedClubIdentityEditor(container,api,userId){
  if(!supabaseConfig.adminEnabled||!container?.isConnected||!api||!userId)return;
  const gate=await verifyAdmin(api,userId);
  if(!container.isConnected||!gate)return;
  const root=make('section','club-editor-private');
  root.setAttribute('aria-label','Gestion sécurisée du portrait du club');
  container.append(root);
  const frame=showEditorFrame(root,'Histoire & identité du club',
    'Édition réservée aux administrateurs MFA. Les brouillons restent privés ; toute publication est auditée par Supabase. Le serveur recontrôle les autorisations.');
  const selectLabel=make('label','club-editor-field','Choisir une publication');
  const selector=make('select','club-editor-control');
  selectLabel.append(selector);
  frame.form.insertBefore(selectLabel,frame.form.firstChild);
  let rows=[],loading=false,confirmation=null;
  frame.action.textContent='Enregistrer ce contenu';
  frame.form.addEventListener('input',()=>{confirmation=null;});
  frame.form.addEventListener('change',()=>{confirmation=null;});
  const selected=()=>rows.find(x=>x.id===selector.value)||null;
  function choose(id){
    const row=rows.find(x=>x.id===id)||null;
    fill(frame.fields,row);
    confirmation=null;
    frame.feedback.textContent=row?'Document chargé. Toute modification doit être enregistrée.':'Nouveau brouillon.';
    frame.redraw();
  }
  async function reload(preferredId=null){
    const current=preferredId??selector.value;
    const authorized=await verifyAdmin(api,userId);
    if(!root.isConnected)return;
    if(!authorized){
      root.replaceChildren(make('p','club-editor-feedback','Session ou MFA insuffisant. Réaccès refusé.'));
      return;
    }
    const result=await api.rpc('admin_list_club_identity');
    if(!root.isConnected)return;
    if(result.error||!Array.isArray(result.data)){
      frame.feedback.textContent='Impossible de charger les brouillons. Aucun changement enregistré.';
      frame.action.disabled=true;
      return;
    }
    rows=result.data;
    selector.replaceChildren();
    const fresh=make('option','','+ Nouveau contenu');fresh.value='new';selector.append(fresh);
    for(const row of rows){
      const option=make('option','',row.title+' · '+(row.published?'Publié':'Brouillon'));
      option.value=row.id;selector.append(option);
    }
    selector.value=rows.some(x=>x.id===current)?current:'new';
    choose(selector.value);
  }
  selector.addEventListener('change',()=>choose(selector.value));
  frame.action.addEventListener('click',async()=>{
    if(loading||!root.isConnected)return;
    const review=validateClubIdentityDraft(values(frame.fields));
    frame.redraw();
    if(!review.valid){
      frame.feedback.textContent='Corrige les points signalés avant enregistrement.';return;
    }
    const old=selected();
    const args=clubIdentityRpcArgs(review,old);
    const finger=JSON.stringify(args);
    const potentiallyPublic=review.publish||old?.published===true;
    if(potentiallyPublic&&confirmation!==finger){
      confirmation=finger;
      frame.feedback.textContent=review.publish
        ?'Publication possible : vérifie les faits et clique à nouveau sur Enregistrer pour confirmer.'
        :'Cette action retirera le contenu du site public : clique à nouveau pour confirmer.';
      return;
    }
    confirmation=null;
    loading=true;frame.action.disabled=true;
    frame.feedback.textContent='Vérification MFA et enregistrement…';
    try{
      if(!await verifyAdmin(api,userId)){
        frame.feedback.textContent='Accès refusé : rôle ou MFA non vérifié.';return;
      }
      if(!root.isConnected)return;
      const result=await api.rpc('admin_save_club_identity',args);
      if(!root.isConnected)return;
      if(result.error){
        frame.feedback.textContent=result.error.code==='40001'
          ?'Ce contenu a changé entre-temps. Recharge la liste avant de réessayer.'
          :'Enregistrement refusé. Vérifie tes droits et actualise les contenus.';
        return;
      }
      await reload(result.data);
      if(root.isConnected)frame.feedback.textContent='Contenu enregistré. Publication contrôlée par Supabase.';
    }catch{
      if(root.isConnected)frame.feedback.textContent='Service indisponible. Aucun succès confirmé.';
    }finally{
      loading=false;
      if(frame.action.isConnected)frame.action.disabled=false;
    }
  });
  frame.feedback.textContent='Chargement des brouillons réservés à l’administration…';
  await reload();
}
