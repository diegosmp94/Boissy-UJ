/** Browser-side validation mirrors public.admin_save_free_event SQL. */
export function eventDateInput(value){
 if(!value)return '';
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))return '';
 const local=new Date(date.getTime()-date.getTimezoneOffset()*60000);
 return local.toISOString().slice(0,16);
}
export function validateFreeEventDraft(d){
 if(String(d.title||'').trim().length<4||String(d.title||'').trim().length>150)
  return 'Le titre doit contenir entre 4 et 150 caractères.';
 if(String(d.description||'').length>4000)
  return 'La description ne doit pas dépasser 4 000 caractères.';
 if(!['club','sport','community','other'].includes(d.category))
  return 'Choisis une catégorie valide.';
 if(String(d.location||'').length>160)
  return 'Le lieu ne doit pas dépasser 160 caractères.';
 if(d.capacity!==''&&( !/^[0-9]+$/.test(String(d.capacity))
   ||Number(d.capacity)<1||Number(d.capacity)>100000))
  return 'La capacité doit être un nombre entier entre 1 et 100 000, ou rester vide.';
 if(Boolean(d.start)!==Boolean(d.end))
  return 'Renseigne les deux dates, ou laisse-les vides pour un brouillon.';
 if(d.publish&&(!d.start||!d.end))
  return 'Une publication nécessite une date de début et de fin.';
 if(d.start&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d.start)
   ||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d.end)
   ||!Number.isFinite(Date.parse(d.start))||!Number.isFinite(Date.parse(d.end))
   ||Date.parse(d.end)<=Date.parse(d.start)))
  return 'La fin de l’événement doit être postérieure au début.';
 return null;
}
export function eventRpcArgs(d,row=null){
 const invalid=validateFreeEventDraft(d);
 if(invalid)throw new Error(invalid);
 return {
  p_id:row?.id||null,p_title:d.title.trim(),p_description:d.description,
  p_category:d.category,p_starts_at:d.start?new Date(d.start).toISOString():null,
  p_ends_at:d.end?new Date(d.end).toISOString():null,
  p_location_label:d.location.trim(),p_capacity:d.capacity===''?null:Number(d.capacity),
  p_publish:d.publish===true,p_expected_updated_at:row?.updated_at||null
 };
}
