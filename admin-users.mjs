/** Administrative member directory. Existing RLS exposes these rows only to admin AAL2.
 * This UI does NOT create or delete Auth users. Role revocation uses audited server RPC.
 */
import {adminSessionStatus} from './admin-security.mjs';
const el=(tag,cls='',t=null)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(t!==null)n.textContent=String(t);return n;};
export function canRevokeRole(currentId,subjectId,role){
 return Boolean(currentId&&subjectId&&currentId!==subjectId&&['player','coach','admin'].includes(role));
}
export function filterMembers(items,query){
 const normalized=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
 const q=normalized(query).trim();return !q?items:items.filter(p=>normalized(p.display_name).includes(q));
}
export async function mountAdminMembers(root,api,userId){
 root.replaceChildren(el('h2','','Gestion des utilisateurs'));
 const status=el('p','admin-workflow-status','Vérification du périmètre de gestion…');
 status.setAttribute('role','status');
 const search=el('input','admin-form-control');search.type='search';
 search.maxLength=80;search.placeholder='Rechercher un membre…';
 search.setAttribute('aria-label','Rechercher un membre');
 const list=el('div','admin-member-list');root.append(status,search,list);
 let profiles=[],roles=[];
 const verified=async()=> (await adminSessionStatus(api,userId)).status==='admin';
 async function reload(){
  if(!await verified()){status.textContent='Accès administratif refusé. Un MFA AAL2 est obligatoire.';list.replaceChildren();return;}
  const [p,r]=await Promise.all([
   api.from('profiles').select('id,display_name,created_at').order('created_at',{ascending:false}).limit(100),
   api.from('user_roles').select('user_id,role').limit(300)
  ]);
  if(!root.isConnected)return;
  if(p.error||r.error){status.textContent='Impossible de vérifier les utilisateurs. Aucune opération possible.';list.replaceChildren();return;}
  profiles=p.data||[];roles=r.data||[];redraw();
 }
 function redraw(){
  list.replaceChildren();
  const chosen=filterMembers(profiles,search.value);
  status.textContent=profiles.length+' profils disponibles en gestion · '+chosen.length+' affichés.';
  if(!chosen.length){list.append(el('p','admin-empty','Aucun compte correspondant.'));return;}
  for(const profile of chosen){
   const card=el('article','admin-member-card');
   card.append(el('strong','',profile.display_name||'Membre'),el('small','',profile.id===userId?'Votre compte':'Compte membre'));
   const ownRoles=roles.filter(x=>x.user_id===profile.id).map(x=>x.role);
   const tags=el('div','admin-member-roles');
   for(const role of ownRoles){
    const item=el('span','admin-role-pill',role);
    tags.append(item);
    if(!canRevokeRole(userId,profile.id,role))continue;
    let confirmed=false;
    const revoke=el('button','admin-secondary-btn','Retirer '+role);
    revoke.type='button';
    revoke.addEventListener('click',async()=>{
     if(!confirmed){confirmed=true;revoke.textContent='Confirmer le retrait '+role;return;}
     confirmed=false;revoke.disabled=true;revoke.textContent='Vérification MFA…';
     try{
      if(!await verified()){status.textContent='Session MFA expirée. Retrait annulé.';return;}
      const result=await api.rpc('admin_revoke_member_role',{
       p_user_id:profile.id,p_role:role,p_team_id:null
      });
      if(!root.isConnected)return;
      if(result.error){status.textContent='Le serveur a refusé ce retrait. Il est interdit de retirer son propre rôle ou le dernier administrateur.';return;}
      status.textContent='Retrait confirmé par le serveur et journalisé.';
      await reload();
     }catch{if(root.isConnected)status.textContent='Opération momentanément indisponible.';}
     finally{if(revoke.isConnected){revoke.disabled=false;revoke.textContent='Retirer '+role;}}
    });
    tags.append(revoke);
   }
   card.append(tags);list.append(card);
  }
 }
 search.addEventListener('input',redraw);
 await reload();
}
