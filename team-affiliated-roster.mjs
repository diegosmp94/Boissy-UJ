/** Private squad organisation by coach or AAL2 admin.
 * Opens only on explicit interaction; SQL RPC remains sole authorization gate.
 * Never exposes a private affiliated player on the public roster.
 */
import {CLUB_TEAMS} from './club-teams.mjs';
import {PLAYER_POSITION_GROUPS,validPrivatePosition,safeShirtNumber} from './player-position-groups.mjs';

const el=(tag,cls='',value=null)=>{
 const node=document.createElement(tag);if(cls)node.className=cls;
 if(value!==null)node.textContent=String(value);
 return node;
};
export function affiliatedPlayerDraft(row,position,number){
 if(!row||typeof row.player_user_id!=='string'||!validPrivatePosition(position))return null;
 const parsed=safeShirtNumber(number);
 if(parsed===null)return null;
 return {p_player_user_id:row.player_user_id,p_position_group:position,
  p_shirt_number:parsed,p_expected_updated_at:row.updated_at||null};
}
let generation=0;
export function unmountTeamAffiliatedRoster(){generation++;}
export function mountTeamAffiliatedRoster(team,getAuthClient){
 unmountTeamAffiliatedRoster();
 const serial=generation;
 const root=document.getElementById('team-affiliated-roster-root');
 const known=CLUB_TEAMS.find(t=>t.code===team?.code&&t.discipline===team?.discipline);
 if(!root||!known)return;
 const disclosure=el('details','team-affiliated-disclosure');
 disclosure.append(el('summary','','Gérer les joueurs affiliés (administrateur / éducateur)'));
 const panel=el('div','team-affiliated-panel');
 const intro=el('p','',
  'Espace privé : sélectionne un joueur déjà affilié à cette équipe, sa catégorie et son numéro. Ces changements ne publient jamais son nom ou sa photo.');
 const status=el('p','team-affiliated-status','');
 status.setAttribute('role','status');
 const retry=el('button','team-affiliated-reload','Réessayer la vérification');
 retry.type='button';retry.hidden=true;
 panel.append(intro,status,retry);
 disclosure.append(panel);root.replaceChildren(disclosure);
 let opened=false,busy=false,loading=false,teamId=null,api=null,rows=[];
 let emptyNotice=null;
 const alive=()=>serial===generation&&root.isConnected&&disclosure.isConnected;
 const label=(name,input)=>{
  const wrap=el('label','team-affiliated-label',name);wrap.append(input);return wrap;
 };
 const option=(value,name)=>{const o=el('option','',name);o.value=value;return o;};
 async function verify(){
  api=await getAuthClient();
  const auth=await api.auth.getUser();
  if(auth.error||!auth.data?.user?.id)throw new Error('Connexion requise');
  return auth.data.user.id;
 }
 async function load(){
  if(!alive()||busy||loading)return;
  loading=true;retry.disabled=true;retry.hidden=true;
  status.textContent='Vérification des droits et de l’affiliation…';
  try{
   await verify();
   if(!alive())return;
   const teams=await api.from('club_teams').select('id,code,discipline')
    .eq('code',known.code).limit(1);
   const found=teams.data?.find(t=>t.code===known.code&&t.discipline===known.discipline);
   if(teams.error||!found)throw new Error('Équipe indisponible');
   teamId=found.id;
   const listing=await api.rpc('staff_list_affiliated_players',{p_team_id:teamId});
   if(!alive())return;
   if(listing.error||!Array.isArray(listing.data))throw new Error('Accès non autorisé ou module indisponible');
   rows=listing.data.filter(p=>typeof p.player_user_id==='string'&&
      typeof p.display_name==='string');
   if(!alive())return;
   render();
  }catch{
   if(alive()){
    rows=[];teamId=null;
    emptyNotice?.remove();emptyNotice=null;
    panel.querySelector('form')?.remove();
    status.textContent='Gestion réservée aux éducateurs affectés à cette équipe et aux administrateurs MFA. Connecte-toi dans Mon espace ou réessaie après activation du module.';
    if(!panel.querySelector('.team-affiliated-account-link')){
     const a=el('a','team-affiliated-account-link','Accéder à Mon espace');
     a.href='#/mon-espace';panel.append(a);
    }
    retry.hidden=false;
   }
  }finally{
   loading=false;
   if(alive())retry.disabled=false;
  }
 }
 retry.addEventListener('click',()=>void load());
 function render(){
  if(!alive())return;
  panel.querySelector('form')?.remove();
  panel.querySelector('.team-affiliated-account-link')?.remove();
  emptyNotice?.remove();emptyNotice=null;
  retry.hidden=true;
  status.textContent=rows.length+' joueur(s) officiellement affilié(s) à '+known.name+'.';
  if(!rows.length){
   const note=el('p','team-affiliated-status',
    'Aucun joueur affilié. L’administrateur doit d’abord attribuer le rôle Joueur et rattacher son compte à cette équipe dans Administration > Affectations joueurs.');
   emptyNotice=note;panel.append(note);return;
  }
  const form=el('form','team-affiliated-form');
  const select=el('select','team-affiliated-control');
  select.required=true;
  for(const p of rows){
   const name=String(p.display_name).slice(0,100);
   select.append(option(p.player_user_id,name));
  }
  const position=el('select','team-affiliated-control');
  position.required=true;
  for(const p of PLAYER_POSITION_GROUPS)position.append(option(p.id,p.label));
  const number=el('input','team-affiliated-control');
  number.type='number';number.min='1';number.max='99';number.step='1';number.required=true;
  const button=el('button','team-affiliated-save','Enregistrer la catégorie et le numéro');
  button.type='submit';
  const refresh=el('button','team-affiliated-reload','Actualiser les joueurs');refresh.type='button';
  const feedback=el('p','team-affiliated-status','');
  feedback.setAttribute('role','status');
  const update=()=>{
   const p=rows.find(item=>item.player_user_id===select.value);
   position.value=validPrivatePosition(p?.position_group)?p.position_group:'goalkeeper';
   number.value=p?.shirt_number==null?'':String(p.shirt_number);
   feedback.textContent=p?.position_group
    ?'Affectation privée existante. Tu peux la modifier.':'Joueur à répartir : sélectionne une catégorie et un numéro.';
  };
  select.addEventListener('change',update);update();
  form.append(label('Joueur affilié',select),label('Catégorie',position),
   label('Numéro de maillot',number),button,refresh,feedback);
  panel.append(form);
  refresh.addEventListener('click',()=>{if(!busy)void load();});
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   if(busy||!alive()||!teamId)return;
   const chosen=rows.find(x=>x.player_user_id===select.value);
   const draft=affiliatedPlayerDraft(chosen,position.value,number.value);
   if(!draft){feedback.textContent='Choisis une catégorie et un numéro de 1 à 99.';return;}
   if(rows.some(r=>r.player_user_id!==chosen.player_user_id&&r.shirt_number===draft.p_shirt_number)){
    feedback.textContent='Ce numéro est déjà attribué à un joueur de l’équipe.';return;
   }
   busy=true;button.disabled=true;refresh.disabled=true;select.disabled=true;
   feedback.textContent='Vérification des droits et enregistrement privé…';
   try{
    await verify();
    if(!alive())return;
    const result=await api.rpc('staff_set_affiliated_player_position',{
     p_team_id:teamId,...draft
    });
    if(!alive())return;
    if(result.error||result.data!==true){
     feedback.textContent=result.error?.code==='23505'?'Numéro déjà attribué.':
      result.error?.code==='40001'?'Une modification existe déjà. Actualise la liste.':
      'Enregistrement refusé. Vérifie ton affectation à l’équipe et réessaie.';
     return;
    }
    status.textContent='Catégorie et numéro enregistrés dans l’effectif privé. Aucune publication automatique.';
    // Avoid nested load while busy and always refresh the optimistic lock state.
    const list=await api.rpc('staff_list_affiliated_players',{p_team_id:teamId});
    if(!alive())return;
    if(!list.error&&Array.isArray(list.data)){
     rows=list.data.filter(p=>typeof p.player_user_id==='string'&&typeof p.display_name==='string');
     render();
     status.textContent='Effectif privé actualisé. Publication publique soumise à validation du club.';
    }else feedback.textContent='Enregistrement réussi, mais actualisation impossible. Recharge la liste.';
   }catch{
    if(alive())feedback.textContent='Connexion indisponible. Vérifie l’état avant de réessayer.';
   }finally{
    busy=false;if(button.isConnected)button.disabled=false;
    if(refresh.isConnected)refresh.disabled=false;
    if(select.isConnected)select.disabled=false;
   }
  });
 }
 disclosure.addEventListener('toggle',()=>{
  if(disclosure.open&&!opened&&alive()){opened=true;void load();}
 });
}
