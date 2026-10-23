/** Only unfinished Boissy-UJ workstreams. Delivered code is archived in docs,
 * not recycled into the active chantier list. A passing endpoint never certifies
 * legal consent, multi-user isolation, or a real backup restoration.
 */
export const ACTIVE_WORKSTREAMS=Object.freeze([
 {id:'p1-rls',priority:'P1',title:'Recette réelle des comptes et permissions',
  next:'Exécuter la recette AAL1/AAL2 sur sept comptes distincts dans un Supabase de staging autorisé.',
  dependency:'Projet de staging et comptes/convocations de test consentis',kind:'human'},
 {id:'p1-recovery',priority:'P1',title:'Sauvegarde et restauration isolée',
  next:'Sauvegarder sous contrôle du club, restaurer dans une instance isolée et comparer les inventaires via le vérificateur.',
  dependency:'Destination isolée, habilitation et procédure de stockage sécurisé',kind:'human'},
 {id:'p1-devices',priority:'P1',title:'Recette Safari, Android et accessibilité',
  next:'Tester sur appareils physiques, clavier, VoiceOver et TalkBack et joindre un PV expurgé.',
  dependency:'Appareils et testeurs habilités',kind:'human'},
 {id:'p1-rgpd',priority:'P1',title:'Validation RGPD, droits à l’image et données des mineurs',
  next:'Valider responsables, bases légales, durées, registre, droits des représentants et procédure de retrait.',
  dependency:'Responsable autorisé du club',kind:'human'},
 {id:'p1-content',priority:'P1',title:'Calendrier et résultats officiels du club',
  next:'Faire valider les dates et résultats sourcés, puis les publier via les outils existants ; aucune invention de score.',
  dependency:'Référent sportif et données vérifiées',kind:'human'},
 {id:'p1-news',priority:'P1',title:'Premières actualités autorisées',
  next:'Préparer et publier les contenus du club avec consentement et droits attestés.',
  dependency:'Contenus approuvés et responsable de publication',kind:'human'},
 {id:'p2-reactions',priority:'P2',title:'Activation contrôlée des réactions',
  next:'Tester RLS avec deux comptes isolés, valider le RGPD puis appliquer la migration revue.',
  dependency:'Recette multi-comptes et autorisation du club',kind:'technical',checks:['reactions']},
 {id:'p2-media',priority:'P2',title:'Activation contrôlée des galeries et vidéos',
  next:'Tester migration et fichiers approuvés en staging avant toute publication réelle.',
  dependency:'Droits à l’image, politique de conservation et tests Storage',kind:'technical',checks:['media','media-preflight']},
 {id:'p2-control',priority:'P2',title:'Éditeur global et administration avancée',
  next:'Recetter en staging l’historique et la restauration en brouillon des actualités développés ; compléter ensuite audit éditorial global et versionnage des autres modules.',
  dependency:'Recette P1 des rôles et de la journalisation',kind:'human'},
 {id:'p2-payments',priority:'P2',title:'Finances, dons, Premium et Stripe TEST',
  next:'Tester sur staging le Checkout et webhook Stripe TEST codés, puis traiter remboursements, litiges et obligations fiscales avant activation.',
  dependency:'Situation légale du club, compte de test habilité et décisions de trésorerie',kind:'human'},
 {id:'p2-ticketing',priority:'P2',title:'Billetterie et contrôle des réservations',
  next:'Développer et vérifier jauges, droits d’accès, annulations et QR en environnement TEST.',
  dependency:'Modèle de billets validé et parcours Stripe TEST homologué',kind:'human'},
 {id:'p2-awards',priority:'P2',title:'Awards et communauté Premium',
  next:'Tester sur staging la migration Awards et son vote unique après événement Stripe TEST signé réellement reçu ; ne pas activer le vote public avant homologation.',
  dependency:'Staging, règlement et consentements, webhook facturation signé et abonnements réellement vérifiés',kind:'human'},
 {id:'p3-fff',priority:'P3',title:'Synchronisation FFF autorisée',
  next:'N’utiliser un flux automatisé qu’après confirmation officielle des accès et des droits ; conserver la saisie manuelle.',
  dependency:'Accès autorisé à une source FFF contractuelle',kind:'human'},
 {id:'p3-seo',priority:'P3',title:'Ouverture publique indexable',
  next:'Lever noindex seulement après homologation et accord explicite du club.',
  dependency:'PV final signé et conformité validée',kind:'human'}
]);
export function remainingWorkstreams(probes=[]){
 const byId=new Map(probes.map(p=>[p.id,p.status]));
 return ACTIVE_WORKSTREAMS.filter(work=>
  work.kind!=='technical'||!work.checks.every(id=>byId.get(id)==='accessible')
 );
}
export function workstreamCounts(items){
 return {total:items.length,p1:items.filter(i=>i.priority==='P1').length,
  p2:items.filter(i=>i.priority==='P2').length,p3:items.filter(i=>i.priority==='P3').length};
}
