/** Reactions du Media Center : aucun commentaire, aucune information d'identite publique. */
import {getAuthClient} from './auth.mjs';

export function reactionPostIds(posts){
 if(!Array.isArray(posts))return [];
 return [...new Set(posts.filter(post=>post?.content_kind==='article'&&
    typeof post.id==='string'&&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(post.id))
    .map(post=>post.id))].slice(0,50);
}

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
  const ids=reactionPostIds(posts);
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
            // A member may sign out or switch accounts while this feed is open.
            const fresh=await api.auth.getUser();
            if(fresh.error||fresh.data?.user?.id!==user.id)
              throw new Error('Reaction session changed');
            if(!button.isConnected)return;
            const wasLiked=liked.has(postId);
            const result=wasLiked
              ? await api.from('news_reactions').delete()
                .eq('post_id',postId).eq('user_id',user.id)
              : await api.from('news_reactions')
                .insert({post_id:postId,user_id:user.id});
            if(result.error){
              // A duplicate like may originate from another tab. Re-read only
              // the current account's row instead of announcing false success.
              if(result.error.code==='23505'){
                const latest=await api.from('news_reactions')
                  .select('post_id').eq('user_id',user.id).eq('post_id',postId);
                if(latest.error||!Array.isArray(latest.data))throw result.error;
                if(latest.data.length)liked.add(postId);else liked.delete(postId);
                if(button.isConnected){paint();status.textContent='Réaction déjà enregistrée sur une autre session.';}
                return;
              }
              throw result.error;
            }
            if(wasLiked)liked.delete(postId);else liked.add(postId);
            if(button.isConnected){
              paint();
              status.textContent=wasLiked?'Réaction retirée.':'Réaction enregistrée.';
            }
          }catch{
            if(button.isConnected)
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
