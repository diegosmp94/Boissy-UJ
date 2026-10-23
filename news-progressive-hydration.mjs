/** Progressive enhancement of published news. Neither media nor reactions may
 * prevent the readable editorial feed (or one another) from displaying.
 * Stale responses are discarded after route changes, and optional failures
 * never hide a previously published article.
 */
export function hydrateNewsIndependently({loadMedia,loadReactions,applyMedia,applyReactions,isActive}){
 const tasks=[
  [loadMedia,applyMedia],
  [loadReactions,applyReactions]
 ];
 return Promise.allSettled(tasks.map(async([load,apply])=>{
  if(!isActive())return;
  const result=await load();
  if(isActive())apply(result);
 }));
}
