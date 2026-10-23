/** Pure helpers for the actual admin modules; no permissions inferred in the UI.
 * The secured admin-center still verifies getUser + role + MFA AAL2 on every mount.
 */
export const ADMIN_GROUP_ORDER=Object.freeze(['Pilotage','Sport','Contenu']);
export function normalizeAdminSearch(value){
 return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLocaleLowerCase('fr').trim();
}
export function filterAdminModules(modules,query=''){
 const needle=normalizeAdminSearch(query);
 if(!needle)return [...modules];
 return modules.filter(item=>
  [item.name,item.caption,item.group].some(v=>normalizeAdminSearch(v).includes(needle))
 );
}
export function groupAdminModules(modules){
 const groups=[];
 for(const title of ADMIN_GROUP_ORDER){
  const items=modules.filter(m=>m.group===title);
  if(items.length)groups.push({title,items});
 }
 // Unknown groups are still shown rather than silently discarding a future module.
 for(const title of new Set(modules.map(m=>m.group))){
  if(ADMIN_GROUP_ORDER.includes(title))continue;
  const items=modules.filter(m=>m.group===title);
  if(items.length)groups.push({title,items});
 }
 return groups;
}
export function availableAdminModules(modules,{eventsReady=false,coachTeamsReady=false,mediaReady=false,newsRevisionsReady=false}={}){
 return modules.filter(module=>
  (module.id!=='events'||eventsReady===true)&&
  (module.id!=='coach-teams'||coachTeamsReady===true)&&
  (module.id!=='news-media'||mediaReady===true)&&
  (module.id!=='news-revisions'||newsRevisionsReady===true));
}
