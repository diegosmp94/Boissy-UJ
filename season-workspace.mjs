import {supabaseConfig} from './auth-config.mjs';

/** Validation frontend uniquement. La base de données effectue les mêmes contrôles. */
export function validateSeason(values) {
  const label=String(values.label||'').trim();
  const status=String(values.status||'planned');
  const start=String(values.start||''),end=String(values.end||'');
  const errors=[];
  const parts=/^(\d{4})\/(\d{4})$/.exec(label);
  if(!parts||Number(parts[2])!==Number(parts[1])+1||
     Number(parts?.[1])<2020||Number(parts?.[1])>2100){
    errors.push('Indique une saison consécutive : AAAA/AAAA+1 (ex. 2026/2027).');
  }
  if(!['planned','active','completed'].includes(status))
    errors.push('Statut de saison inconnu.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||
     Number.isNaN(Date.parse(start))||Number.isNaN(Date.parse(end))||
     Date.parse(end)<=Date.parse(start)){
    errors.push('Les dates de début et de fin doivent être valides et ordonnées.');
  } else if(parts &&(Number(start.slice(0,4))!==Number(parts[1])
    ||Number(end.slice(0,4))!==Number(parts[2]))) {
    errors.push('Les dates doivent correspondre aux années de la saison.');
  }
  return {valid:errors.length===0,errors,label,status,start,end};
}

const el=(tag,cls='',content=null)=>{
  const n=document.createElement(tag);
  if(cls)n.className=cls;
  if(content!==null)n.textContent=String(content);
  return n;
};
function field(name,labelText,type='text'){
  const label=el('label','staff-label',labelText);
  const input=el('input','staff-input');
  input.name=name;input.type=type;input.required=true;
  label.append(input);
  return {label,input};
}

/** Safe public GET: lists configured seasons without exposing private team data. */
export async function loadPublicSeasons(signal,fetcher=fetch) {
  const params=new URLSearchParams({select:'id,label,state,starts_on,ends_on',order:'label.desc',limit:'30'});
  const response=await fetcher(
    supabaseConfig.url+'/rest/v1/club_seasons?'+params,
    {method:'GET',signal,cache:'no-store',
      headers:{apikey:supabaseConfig.publishableKey,Accept:'application/json'}}
  );
  if(!response.ok)throw new Error('Saisons indisponibles');
  const data=await response.json();
  if(!Array.isArray(data))throw new Error('Réponse inattendue');
  return data;
}
export function mountSeasonPreview(container) {
  const section=el('section','staff-seasons');
  section.append(el('h3','','Saisons du club'),
    el('p','staff-muted','Lecture des saisons réellement configurées dans Supabase. La création et la modification restent réservées à un administrateur avec MFA validé.'));
  const list=el('div','staff-season-list');
  list.setAttribute('aria-live','polite');
  list.append(el('p','staff-muted','Chargement des saisons…'));
  section.append(list);
  const form=el('form','staff-form');
  form.noValidate=true;
  form.append(el('h4','','Préparer une nouvelle saison (sans sauvegarde)'));
  const label=field('season_label','Saison (ex. 2026/2027)');
  label.input.maxLength=9;label.input.placeholder='2026/2027';
  const status=el('select','staff-input');
  status.name='state';status.setAttribute('aria-label','Statut de la saison');
  for(const [id,name] of [['planned','Prévue'],['active','En cours'],['completed','Terminée']]){
    const option=el('option','',name);option.value=id;status.append(option);
  }
  const stateLabel=el('label','staff-label','Statut');
  stateLabel.append(status);
  const start=field('start','Début','date');
  const end=field('end','Fin','date');
  const dates=el('div','staff-goals');
  dates.append(start.label,end.label);
  const submit=el('button','staff-action','Prévisualiser la saison');
  submit.type='submit';
  form.append(label.label,stateLabel,dates,submit);
  const errors=el('div','staff-feedback');
  errors.setAttribute('aria-live','polite');
  const preview=el('div','staff-preview');
  preview.setAttribute('aria-live','polite');
  form.addEventListener('submit',event=>{
    event.preventDefault();errors.replaceChildren();preview.replaceChildren();
    const result=validateSeason({label:label.input.value,status:status.value,start:start.input.value,end:end.input.value});
    if(!result.valid){
      errors.className='staff-feedback staff-feedback-error';
      const ul=el('ul');
      result.errors.forEach(msg=>ul.append(el('li','',msg)));
      errors.append(ul);return;
    }
    errors.className='staff-feedback';
    preview.append(
      el('span','staff-preview-kicker','PRÉVISUALISATION · NON ENREGISTRÉE'),
      el('h4','',result.label),
      el('p','',({planned:'Prévue',active:'En cours',completed:'Terminée'})[result.status]),
      el('p','',result.start+' → '+result.end),
      el('small','','Aucune saison créée ou modifiée dans Supabase.')
    );
  });
  section.append(form,errors,preview);
  container.append(section);
  const ctrl=new AbortController();
  // Replace the list only while it is still mounted.
  void loadPublicSeasons(ctrl.signal).then(rows=>{
    if(!list.isConnected)return;
    list.replaceChildren();
    if(!rows.length)list.append(el('p','staff-muted','Aucune saison configurée pour le moment.'));
    else rows.forEach(row=>{
      const item=el('div','staff-season-item');
      item.append(el('strong','',row.label),
        el('span','',({planned:'Prévue',active:'En cours',completed:'Terminée'})[row.state]||'À vérifier'));
      list.append(item);
    });
  }).catch(()=>{
    if(list.isConnected)list.replaceChildren(el('p','staff-muted','Impossible de récupérer les saisons pour le moment.'));
  });
}
