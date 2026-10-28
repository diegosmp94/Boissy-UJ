/** Private club office titles. Display labels never alter technical permissions. */
import {adminSessionStatus} from './admin-security.mjs';
import {validateOfficialTitle,normalizeOfficialTitle,officeTitleDraft,canAssignOfficialTitle} from './admin-office-titles-rules.mjs';

const el=(tag,klass='',value=null)=>{
 const node=document.createElement(tag);
 if(klass)node.className=klass;
 if(value!==null)node.textContent=String(value);
 return node;
};
const option=(id,name)=>{const node=el('option','',name);node.value=id;return node;};
const field=(name,node)=>{const label=el('label','admin-form-field',name);label.append(node);return label;};
const control=(type='text')=>{const x=el('input','admin-form-control');x.type=type;return x;};
const action=(label,style='admin-secondary-btn')=>{
 const b=el('button',style,label);b.type='button';return b;
};

/** Available only after the control-center has verified admin + MFA AAL2. */
export async function mountAdminOfficeTitles(root,api,userId){
 root.replaceChildren(el('h2','','Fonctions et titres des dirigeants'));
 root.append(el('p','admin-workflow-status',
  'Définis les intitulés de ton choix (Président, Directeur sportif, Dirigeant…). '
  +'Chaque titre est nominatif, réservé à un administrateur validé, et ne donne aucun droit technique.'));
 const status=el('p','admin-workflow-status','Chargement des fonctions du club…');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const refresh=action('Actualiser les fonctions');
 const form=el('form','admin-operation-form');
 const titleSelect=el('select','admin-form-control');
 titleSelect.setAttribute('aria-label','Fonction à créer ou modifier');
 const titleLabel=control();titleLabel.maxLength=80;titleLabel.placeholder='Ex. Directeur sportif';
 const single=control('checkbox'),enabled=control('checkbox'),sort=control('number');
 enabled.checked=true;sort.min='0';sort.max='9999';sort.step='1';sort.value='100';
 const save=el('button','admin-primary-btn','Enregistrer la fonction');save.type='submit';
 const formFeedback=el('p','admin-workflow-status','');formFeedback.setAttribute('role','status');
 form.append(field('Créer une fonction ou modifier un titre existant',titleSelect),
  field('Intitulé officiel',titleLabel),
  field('Un seul titulaire possible (ex. Président)',single),
  field('Fonction active',enabled),field('Ordre d’affichage',sort),save,formFeedback);
 const assignTitle=el('select','admin-form-control');
 const assignPerson=el('select','admin-form-control');
 const assign=action('Attribuer ce titre','admin-primary-btn');
 const assignFeedback=el('p','admin-workflow-status','');assignFeedback.setAttribute('role','status');
 const assignPanel=el('div','admin-operation-form');
 assignPanel.append(el('h3','','Attribuer une fonction nominative'),
  field('Fonction officielle active',assignTitle),
  field('Administrateur du club',assignPerson),assign,assignFeedback);
 const listing=el('div','admin-office-title-list');
 listing.setAttribute('aria-label','Titres et titulaires actuels');
 root.append(status,refresh,form,assignPanel,el('h3','','Attributions actuelles'),listing);
 let titles=[],admins=[],assignments=[],busy=false,confirmed=null,request=0;
 const alive=()=>root.isConnected;
 const verified=async()=>{
  const v=await adminSessionStatus(api,userId);
  return alive()&&v.status==='admin'&&v.level==='aal2';
 };
 const blocked=message=>{
  status.textContent=message;
  listing.replaceChildren();titles=[];admins=[];assignments=[];
  save.disabled=true;assign.disabled=true;
 };
 const resetConfirmation=()=>{confirmed=null;assign.textContent='Attribuer ce titre';};
 const selected=()=>titles.find(t=>t.id===titleSelect.value)||null;
 const resetForm=()=>{
  const t=selected();
  titleLabel.value=t?.title_label||'';
  single.checked=t?.single_holder||false;enabled.checked=t?.active??true;
  sort.value=String(t?.sort_order??100);
  save.textContent=t?'Mettre à jour la fonction':'Créer la fonction';
  formFeedback.textContent='';
 };
 const resetSelect=(node,rows,makeLabel,placeholder='Sélectionner…',wanted='')=>{
  node.replaceChildren(option('',placeholder));
  for(const row of rows)node.append(option(row.id||row.user_id,makeLabel(row)));
  node.value=rows.some(x=>(x.id||x.user_id)===wanted)?wanted:'';
 };
 const draw=()=>{
  if(!alive())return;
  const keepTitle=titleSelect.value,keepAssign=assignTitle.value,keepPerson=assignPerson.value;
  resetSelect(titleSelect,titles,t=>(t.active?'● ':'○ ')+t.title_label,'+ Nouvelle fonction',keepTitle);
  resetForm();
  resetSelect(assignTitle,titles.filter(t=>t.active),t=>t.title_label,
   'Choisir une fonction…',keepAssign);
  resetSelect(assignPerson,admins,p=>p.display_name,'Choisir un administrateur…',keepPerson);
  assign.disabled=!assignTitle.value||!assignPerson.value;
  listing.replaceChildren();
  if(!titles.length)listing.append(el('p','admin-empty',
   'Aucune fonction créée. Tu peux définir tes premiers titres ci-dessus.'));
  for(const t of titles){
   const card=el('article','admin-member-card');
   card.append(el('strong','',t.title_label),
    el('small','',t.active?'Fonction active':'Fonction désactivée'));
   card.append(el('p','admin-workflow-status',
    (t.single_holder?'Titulaire unique':'Plusieurs titulaires possibles')
    +' · '+t.holder_count+' attribution(s)'));
   const people=assignments.filter(a=>a.title_id===t.id);
   if(!people.length)card.append(el('p','admin-empty','Aucun titulaire actuellement.'));
   for(const person of people){
    const row=el('div','admin-office-holder');
    row.append(el('span','',person.display_name),
     el('small','',person.user_id===userId?'Votre compte':'Administrateur validé'));
    const remove=action('Retirer ce titre');
    let armed=false;
    remove.addEventListener('click',async()=>{
     if(busy||!alive())return;
     if(!armed){armed=true;remove.textContent='Confirmer le retrait';return;}
     busy=true;remove.disabled=true;status.textContent='Retrait en vérification…';
     try{
      if(!await verified()){blocked('Accès MFA expiré.');return;}
      const result=await api.rpc('admin_office_set_assignment',{
       p_title_id:t.id,p_user_id:person.user_id,p_assign:false
      });
      if(!alive())return;
      if(result.error||result.data!==true){
       status.textContent='Retrait non confirmé. Actualise la liste.';return;
      }
      await reload();if(alive())status.textContent='Titre retiré et changement journalisé.';
     }catch{if(alive())status.textContent='Connexion indisponible. Actualise avant de réessayer.';}
     finally{busy=false;if(remove.isConnected)remove.disabled=false;}
    });
    row.append(remove);card.append(row);
   }
   listing.append(card);
  }
 };
 async function reload(){
  if(loading)return;
  const ticket=++request;loading=true;refresh.disabled=true;
  try{
   if(!await verified()){if(alive())blocked('Accès administrateur MFA AAL2 nécessaire.');return;}
   const results=await Promise.all([
    api.rpc('admin_office_list_titles'),
    api.rpc('admin_office_list_administrators'),
    api.rpc('admin_office_list_assignments')
   ]);
   if(!alive()||ticket!==request)return;
   if(results.some(x=>x.error||!Array.isArray(x.data))){
    blocked('Le registre des fonctions est indisponible. Vérifie la migration Supabase.');
    return;
   }
   if(!await verified()){if(alive())blocked('Droits administrateur ou MFA expirés.');return;}
   titles=results[0].data;admins=results[1].data;assignments=results[2].data;
   save.disabled=false;
   status.textContent=titles.length+' fonction(s) créée(s) · '+admins.length
    +' administrateur(s) habilité(s).';
   draw();
  }catch{if(alive())blocked('Lecture sécurisée indisponible. Réessaie plus tard.');}
  finally{loading=false;if(refresh.isConnected)refresh.disabled=false;}
 }
 let loading=false;
 titleSelect.addEventListener('change',resetForm);
 for(const node of [titleLabel,single,enabled,sort])
  node.addEventListener('input',()=>{formFeedback.textContent='';});
 for(const node of [assignTitle,assignPerson])node.addEventListener('change',()=>{
  resetConfirmation();assignFeedback.textContent='';
  assign.disabled=!assignTitle.value||!assignPerson.value;
 });
 refresh.addEventListener('click',()=>{if(!busy&&!loading)void reload();});
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy||save.disabled||!alive())return;
  const row=selected();
  const draft=officeTitleDraft({
   label:titleLabel.value,singleHolder:single.checked,
   active:enabled.checked,sortOrder:sort.value
  });
  const problem=validateOfficialTitle(draft);
  if(problem){formFeedback.textContent=problem;return;}
  if(row&&(!draft.active||draft.label!==row.title_label)&&
    confirmed!==JSON.stringify(draft)){
   confirmed=JSON.stringify(draft);
   formFeedback.textContent='Modification nominative : vérifie et clique une seconde fois pour confirmer.';
   return;
  }
  busy=true;save.disabled=true;formFeedback.textContent='Vérification MFA et enregistrement…';
  try{
   if(!await verified()){blocked('Droits ou MFA expirés.');return;}
   const result=await api.rpc('admin_office_save_title',{
    p_id:row?.id||null,p_label:draft.label,p_single_holder:draft.singleHolder,
    p_active:draft.active,p_sort_order:draft.sortOrder,
    p_expected_updated_at:row?.updated_at||null
   });
   if(!alive())return;
   if(result.error||!result.data){
    formFeedback.textContent=result.error?.code==='23505'?'Ce titre existe déjà.':
     result.error?.code==='40001'?'La fonction a changé : actualise avant de modifier.':
     'Enregistrement refusé. Vérifie les droits, le nombre de titulaires et les champs.';
    return;
   }
   confirmed=null;titleSelect.value=result.data;
   await reload();
   if(alive())formFeedback.textContent='Fonction enregistrée et journalisée.';
  }catch{if(alive())formFeedback.textContent='Échec réseau. Vérifie l’état avant de réessayer.';}
  finally{busy=false;if(save.isConnected)save.disabled=false;}
 });
 assign.addEventListener('click',async()=>{
  if(busy||assign.disabled||!alive())return;
  const title=titles.find(x=>x.id===assignTitle.value),person=admins.find(x=>x.user_id===assignPerson.value);
  if(!canAssignOfficialTitle(title,person,assignments)){
   assignFeedback.textContent='Choisis une fonction active disponible et un administrateur sans attribution identique.';
   return;
  }
  const intent=title.id+'|'+person.user_id;
  if(confirmed!==intent){confirmed=intent;assign.textContent='Confirmer l’attribution';return;}
  resetConfirmation();busy=true;assign.disabled=true;assignFeedback.textContent='Attribution sécurisée…';
  try{
   if(!await verified()){blocked('Droits ou MFA expirés.');return;}
   const result=await api.rpc('admin_office_set_assignment',{
    p_title_id:title.id,p_user_id:person.user_id,p_assign:true
   });
   if(!alive())return;
   if(result.error||result.data!==true){
    assignFeedback.textContent='Attribution refusée. Actualise la liste ou vérifie la règle de titulaire unique.';
    return;
   }
   await reload();
   if(alive())assignFeedback.textContent='Fonction nominative attribuée et journalisée.';
  }catch{if(alive())assignFeedback.textContent='Réponse indisponible. Actualise avant de répéter.';}
  finally{busy=false;if(assign.isConnected)assign.disabled=false;}
 });
 await reload();
}
