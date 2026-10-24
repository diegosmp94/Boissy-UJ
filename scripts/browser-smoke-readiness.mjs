/** Pure acceptance guard: a URL hash alone is not proof that the SPA rendered. */
export function isReadyPublicRouteSnapshot(snapshot,expectedRoute){
 return typeof expectedRoute==='string'&&expectedRoute.startsWith('#/')&&
  snapshot?.path===expectedRoute&&snapshot.dom!=='loading'&&
  snapshot.mainCount===1&&Number.isInteger(snapshot.mainChars)&&
  snapshot.mainChars>60;
}
