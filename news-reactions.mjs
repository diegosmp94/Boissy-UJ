/** Reactions du Media Center : aucun commentaire, aucune information d'identite publique. */
import {getAuthClient} from './auth.mjs';

export function reactionLabel(liked){
  return liked ? 'Retirer mon j’aime' : 'J’aime';
}

function el(tag, className='', text=null){
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!==null)node.textContent=String(text);
  return node;
}

function guestReaction(article){
  const note=el('p','news-reaction-guest','Connecte-toi pour réagir : ');
  const link=el('a','','Mon espace');
  link.href='#/mon-espace';
  note.append(link);
  article.append(note);
}

export async function loadNewsReactions(posts){
  const ids=[...new Set(posts.map(post=>post.id).filter(id=>
    typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id)))].slice(0,50);
  if(!ids.length)return {render(){}};
  let api,user;
  try{
    api=await getAuthClient();
    const result=await api.auth.getUser();
    user=result.data?.user;
    if(result.error||!user)return {render:(_,article)=>guestReaction(article)};
    const current=await api.from('news_reactions').select('post_id')
      .eq('user_id',user.id).in('post_id',ids);
    if(current.error||!Array.isArray(current.data))return {render(){}};
    const liked=new Set(current.data.map(row=>row.post_id));
    return {
      render(postId,article){
        if(!ids.includes(postId))return;
        const wrap=el('div','news-reaction');
        const button=el('button','news-reaction-button');
        button.type='button';
        const status=el('span','news-reaction-status');
        status.setAttribute('role','status');
        status.setAttribute('aria-live','polite');
        const paint=()=>{
          const pressed=liked.has(postId);
          button.textContent=reactionLabel(pressed);
          button.setAttribute('aria-pressed',String(pressed));
          button.setAttribute('aria-label',reactionLabel(pressed)+' pour cette publication');
        };
        paint();
        button.addEventListener('click',async()=>{
          if(button.disabled)return;
          button.disabled=true;
          status.textContent='';
          try{
            const wasLiked=liked.has(postId);
            const result=wasLiked
              ? await api.from('news_reactions').delete()
                .eq('post_id',postId).eq('user_id',user.id)
              : await api.from('news_reactions')
                .insert({post_id:postId,user_id:user.id});
            if(result.error)throw result.error;
            if(wasLiked)liked.delete(postId);else liked.add(postId);
            paint();
            status.textContent=wasLiked?'Réaction retirée.':'Réaction enregistrée.';
          }catch{
            status.textContent='Action impossible. Vérifie ta connexion et réessaie.';
          }finally{
            if(button.isConnected)button.disabled=false;
          }
        });
        wrap.append(button,status);
        article.append(wrap);
      }
    };
  }catch{
    // Le flux d'actualites doit rester utilisable si Auth est indisponible.
    return {render(){}};
  }
}
