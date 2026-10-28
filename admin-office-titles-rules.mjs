/** Pure presentation rules only. Supabase rechecks all assignments with admin MFA. */
export function normalizeOfficialTitle(value){
 return String(value??'').normalize('NFC').trim().replace(/\s+/g,' ');
}
export function officeTitleDraft({label,singleHolder,active,sortOrder}={}){
 return Object.freeze({
  label:normalizeOfficialTitle(label),
  singleHolder:singleHolder===true,active:active===true,sortOrder:Number(sortOrder)
 });
}
export function validateOfficialTitle(draft){
 if(!draft||typeof draft.label!=='string'||
  draft.label.length<3||draft.label.length>80||/[\x00-\x1f\x7f]/.test(draft.label))
  return 'L’intitulé doit contenir de 3 à 80 caractères.';
 if(!Number.isSafeInteger(draft.sortOrder)||draft.sortOrder<0||draft.sortOrder>9999)
  return 'L’ordre doit être un entier entre 0 et 9999.';
 return null;
}
export function canAssignOfficialTitle(title,person,assignments=[]){
 return Boolean(title?.id&&title.active===true&&person?.user_id&&
  Array.isArray(assignments)&&
  !assignments.some(a=>a.title_id===title.id&&a.user_id===person.user_id)&&
  (!title.single_holder||!assignments.some(a=>a.title_id===title.id)));
}
