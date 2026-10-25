# Correctifs ciblés des effectifs — 25 octobre 2026

## Corrigé dans le code

- **Affectation par défaut trompeuse :** quand aucun poste n'existait, le formulaire préremplissait « Gardien ». Il exige désormais un choix explicite (« Choisir une catégorie… »), en conservant les postes précédemment validés.
- **Perte de sélection :** après enregistrement d'une affectation ou rafraîchissement, la sélection sautait au premier joueur de l'équipe. L'éditeur conserve maintenant le même joueur tant qu'il demeure officiellement affilié. La sauvegarde replace le focus clavier sur le sélecteur du bon joueur.
- **Page Joueurs sans catalogue public :** les cinq rubriques Gardiens, Défenseurs, Milieux, Attaquants, Éducateurs restent visibles, avec une mention d'annuaire non configuré plutôt qu'un écran presque vide. Aucun joueur ni éducateur fictif n'est créé.

## Recette automatisée

- Tests d'interaction DOM avec faux RPC en mémoire : absence de poste imposé, refus d'enregistrement sans poste, sélection de la deuxième personne, numéro validé, conservation de sélection après écriture et actualisation, retour du focus.
- Test de rendu DOM d'une équipe dont le catalogue est absent : cinq rubriques visibles, aucun portrait ou nom ajouté, une seule lecture publique.
- Exécution complète Node, qualité et Chromium sur la branche et après fusion dans main.

## Dépendances non déclarées terminées

- Tests réels avec comptes administrateur MFA, éducateurs affectés, joueurs et visiteurs, y compris restrictions RLS entre équipes.
- Accord RGPD et droits à l'image (mineurs compris) pour les portraits et publications.
- Synchronisation contrôlée entre les affectations privées et les fiches publiques approuvées. Une attribution privée de numéro ou poste ne publie toujours pas automatiquement son nom ou sa photo.
- Recette humaine Safari, iPhone/Android, VoiceOver et TalkBack.

Aucune migration SQL ni modification de permission n'est apportée par ce correctif.