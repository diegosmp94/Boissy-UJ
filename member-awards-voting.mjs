/** Member Awards Premium: personal ballot, no client-computed tallies.
 * Voting must be enabled by a manually approved SERVER gate; production OFF.
 */
const el=(tag,cls='',text=null)=>{const n=document.createElement(tag);
 if(cls)n.className=cls;if(text!==null)n.textContent=String(text);return n;};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validAwardsVotingCapability(x){
 return x&&typeof x==='object'&&!Array.isArray(x)&&
  typeof x.enabled==='boolean'&&typeof x.premium_active==='boolean'
  ?{enabled:x.enabled,premiumActive:x.premium_active}:null;
}
export function eligibleAwardForVoting(a,now=Date.now()){
 return Boolean(a&&UUID.test(a.id)&&a.published===true&&
  a.voting_status==='open'&&a.results_published===false&&
  Number.isFinite(Date.parse(a.opens_at))&&
  Number.isFinite(Date.parse(a.closes_at))&&
  Date.parse(a.opens_at)<=now&&now<Date.parse(a.closes_at));
}
export function eligibleAwardsNominees(rows,awardId){
 return Array.isArray(rows)?rows.filter(n=>n&&UUID.test(n.id)&&
  n.award_id===awardId&&n.published===true&&n.consent_reviewed===true&&
  typeof n.display_label==='string'&&n.display_label.trim().length>=2)
  .sort((a,b)=>a.sort_order-b.sort_order):[];
}
export async function mountMemberAwardsVoting(root,api,userId,alive){
 const section=el('section','member-awards');
 const h=el('h3','','Mes votes Awards · Premium');
 const status=el('p','auth-footnote','Vérification du droit Premium…');
 status.setAttribute('role','status');
 const list=el('div','member-awards-list');
 section.append(h,status,list);root.append(section);
 const active=()=>root.isConnected&&section.isConnected&&
   typeof alive==='function'&&alive();
 let generation=0,working=false;
 const verified=async()=>{
  if(!active())return false;
  const u=await api.auth.getUser();
  return active()&&!u.error&&u.data?.user?.id===userId&&
   Boolean(u.data?.user?.email_confirmed_at);
 };
 async function load(){
  const run=++generation;
  list.replaceChildren();
  if(!await verified()){
   if(active())status.textContent='Compte vérifié nécessaire.';
   return;
  }
  try{
   const gate=await api.rpc('member_awards_voting_capability');
   if(!active()||run!==generation)return;
   const cap=gate.error?null:validAwardsVotingCapability(gate.data);
   if(!cap||!cap.enabled){
    status.textContent='Les votes Awards ne sont pas encore ouverts sur ce site.';
    return;
   }
   if(!cap.premiumActive){
    status.textContent='Le vote nécessite un abonnement Premium vérifié et actif.';
    return;
   }
   const awards=await api.from('club_awards')
    .select('id,title,published,voting_status,results_published,opens_at,closes_at')
    .eq('published',true).limit(90);
   if(!active()||run!==generation)return;
   if(awards.error||!Array.isArray(awards.data))throw Error('Awards unavailable');
   const current=awards.data.filter(a=>eligibleAwardForVoting(a));
   if(!current.length){
    status.textContent='Aucune catégorie n’est actuellement ouverte aux votes.';
    return;
   }
   status.textContent='Un seul bulletin actif par catégorie ; votre choix reste privé. Vous pouvez le modifier ou le retirer avant la clôture.';
   for(const award of current){
    const pane=el('article','member-awards-card');
    pane.append(el('h4','',award.title));
    const hint=el('p','auth-footnote','Chargement de vos candidatures officielles…');
    const choose=el('select','admin-form-control');
    choose.setAttribute('aria-label','Choisir un candidat pour '+award.title);
    const save=el('button','auth-text-button','Enregistrer mon vote');
    const withdraw=el('button','auth-text-button','Retirer mon vote');
    save.type='button';withdraw.type='button';
    save.disabled=true;withdraw.disabled=true;
    pane.append(hint,choose,save,withdraw);list.append(pane);
    try{
     const [nominees,own]=await Promise.all([
      api.from('club_award_nominees')
       .select('id,award_id,display_label,published,consent_reviewed,sort_order')
       .eq('award_id',award.id).eq('published',true).eq('consent_reviewed',true).limit(100),
      api.rpc('member_my_award_vote',{p_award_id:award.id})
     ]);
     if(!active()||run!==generation)return;
     if(nominees.error||own.error)throw Error('Nominee or own vote unavailable');
     const candidates=eligibleAwardsNominees(nominees.data,award.id);
     choose.replaceChildren();
     const blank=el('option','','Sélectionnez un nominé');blank.value='';
     choose.append(blank);
     for(const n of candidates){
      const opt=el('option','',n.display_label);opt.value=n.id;choose.append(opt);
     }
     if(candidates.some(n=>n.id===own.data))choose.value=own.data;
     hint.textContent=own.data?'Votre bulletin est enregistré en privé.':
      'Aucun vote enregistré pour cette catégorie.';
     save.disabled=candidates.length<2;
     withdraw.disabled=!own.data;
     const transact=async(kind)=>{
      if(working||!active())return;
      if(kind==='cast'&&!candidates.some(n=>n.id===choose.value)){
       hint.textContent='Sélectionnez un nominé publié et validé.';return;
      }
      if(kind==='withdraw'&&!window.confirm('Retirer votre vote pour cette catégorie ?'))return;
      working=true;save.disabled=true;withdraw.disabled=true;
      hint.textContent='Enregistrement sécurisé auprès du serveur…';
      try{
       if(!await verified())throw Error('Identity changed');
       const operation=kind==='cast'?'member_cast_award_vote':'member_withdraw_award_vote';
       const args=kind==='cast'
        ?{p_award_id:award.id,p_nominee_id:choose.value}
        :{p_award_id:award.id};
       const result=await api.rpc(operation,args);
       if(result.error||result.data!==true)throw Error('Vote refused');
       if(active())await load();
      }catch{
       if(active()){
        hint.textContent='Modification refusée : droits Premium, clôture ou connexion à vérifier.';
        save.disabled=false;withdraw.disabled=false;
       }
      }finally{working=false;}
     };
     save.addEventListener('click',()=>void transact('cast'));
     withdraw.addEventListener('click',()=>void transact('withdraw'));
    }catch{
     if(active()&&run===generation){
      hint.textContent='Nominations indisponibles. Aucun bulletin envoyé.';
      save.disabled=true;withdraw.disabled=true;
     }
    }
   }
  }catch{
   if(active()&&run===generation){
    list.replaceChildren();
    status.textContent='Service de votes momentanément indisponible. Aucun bulletin présumé.';
   }
  }
 }
 await load();
}
