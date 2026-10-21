/** Form rules mirror Supabase RPC constraints. Pure, testable, no account data. */
export function validateSeasonDraft(d){
 const match=/^([0-9]{4})\/([0-9]{4})$/.exec(String(d.label||''));
 if(!match||Number(match[1])<2020||Number(match[1])>2100||Number(match[2])!==Number(match[1])+1)
  return 'Format de saison attendu : 2026/2027.';
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d.start||'')||!/^\d{4}-\d{2}-\d{2}$/.test(d.end||'')
   ||!Number.isFinite(Date.parse(d.start))||!Number.isFinite(Date.parse(d.end))||d.end<=d.start)
  return 'Indique une période de saison valide.';
 if(Number(d.start.slice(0,4))!==Number(match[1])||Number(d.end.slice(0,4))!==Number(match[2]))
  return 'Les dates doivent correspondre aux années de la saison.';
 return null;
}
export function validateMatchDraft(d,teams=[],seasons=[]){
 if(!teams.some(t=>t.id===d.team))return 'Sélectionne une équipe du club.';
 if(d.season&&!seasons.some(s=>s.id===d.season))return 'Sélectionne une saison valide.';
 if(String(d.opponent||'').trim().length<2||String(d.opponent||'').trim().length>120)
  return 'Indique un adversaire valide (2 à 120 caractères).';
 if(!d.date||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d.date)||!Number.isFinite(Date.parse(d.date)))
  return 'Choisis une date et une heure de match valides.';
 if(String(d.venue||'').length>160)return 'Le lieu ne doit pas dépasser 160 caractères.';
 if(!['scheduled','played','postponed','cancelled'].includes(d.state))
  return 'Sélectionne un statut de match valide.';
 const scoreValid=value=>String(value).trim()!==''&&/^\d{1,2}$/.test(String(value))&&Number(value)<=99;
 if(d.state==='played'&&(!scoreValid(d.hScore)||!scoreValid(d.aScore)))
  return 'Pour un match joué, indique deux scores entiers de 0 à 99.';
 if(d.state!=='played'&&(d.hScore!==''||d.aScore!==''))
  return 'Les scores sont réservés aux matchs joués.';
 return null;
}
export function validateNewsDraft(d,teams=[]){
 // NULL team is a club-wide article; SQL RPC only allows it for verified admins.
 if(d.team!==''&&!teams.some(t=>t.id===d.team))
  return 'Sélectionne une équipe valide ou une actualité générale du club.';
 if(String(d.title||'').trim().length<4||String(d.title||'').trim().length>180)
  return 'Le titre doit comporter 4 à 180 caractères.';
 if(String(d.excerpt||'').length>400||String(d.body||'').trim().length<1||String(d.body||'').trim().length>20000)
  return 'Vérifie la longueur du résumé et de l’article.';
 if(d.publish&&!d.rights)
  return 'Une publication exige la vérification des droits et des autorisations.';
 return null;
}
export function adminSaveErrorMessage(error){
 if(error?.code==='42501')return 'Action refusée : droits administrateur ou MFA AAL2 insuffisants.';
 if(error?.code==='23505')return 'Ce dossier existe déjà. Actualise la liste avant de recommencer.';
 if(error?.code==='40001')return 'Ce dossier a été modifié entre-temps. Actualise la liste avant de réessayer.';
 if(error?.code==='22023'||error?.code==='23514')return 'Les données sont refusées par Supabase. Vérifie les champs du formulaire.';
 return 'Opération indisponible ou refusée. Aucun enregistrement confirmé.';
}
