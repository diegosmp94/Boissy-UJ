# Correctif de saisie des postes publics — Boissy UJ

## Problème identifié

Les pages Joueurs regroupent les joueurs sous quatre rubriques (Gardiens, Défenseurs, Milieux, Attaquants), mais l'éditeur administrateur des fiches publiques utilisait uniquement un texte libre pour le poste. Une saisie imprécise (« Joueur polyvalent ») pouvait donc laisser un joueur publié sous « À classer », alors que le club souhaitait qu'il soit catégorisé.

## Correction

- L'éditeur **Effectifs publics** propose maintenant, pour une personne de type Joueur uniquement, une liste explicite « Catégorie du joueur (rubrique du site) » avec les quatre catégories. La valeur initiale reste « Choisir une catégorie… » pour éviter les classements involontaires.
- La sélection d'une catégorie renseigne un libellé public reconnu (« Gardien », « Défenseur », « Milieu », « Attaquant ») ; l'administrateur peut ensuite affiner manuellement la description du poste, par exemple « Défenseur central », sans perdre la catégorie reconnue.
- Lorsqu'un profil existant est ouvert, le champ de catégorie se déduit de son poste déjà validé **sans écraser ce texte**.
- Les profils Coach et Staff n'utilisent pas le menu des postes de joueurs. Leur fonction libre reste inchangée.
- Si un poste libre n'est pas reconnu, l'aperçu affiche clairement que la fiche serait classée sous « À classer », afin que l'administrateur puisse corriger le poste avant publication.
- Une note rappelle que l'organisation privée des équipes par les éducateurs ne publie **jamais automatiquement** une identité ni une photographie.

## Permissions et sécurité inchangées

L'enregistrement réel reste exclusivement accessible à un administrateur **MFA AAL2** par le flux existant et le RPC audité de Supabase. Un compte Coach ne peut pas publier un joueur par ce formulaire, même si l'entraîneur gère ses affectations privées.

Aucune migration SQL ni nouvelle donnée personnelle n'est ajoutée par ce correctif. Les fiches en brouillon, les personnes mineures et les portraits restent soumis aux consentements et droits vérifiés par le club.

## Validation

Tests du sélecteur sur les quatre groupes, préservation des postes détaillés, changement de catégorie, alerte À classer, séparation Joueur/Coach/Staff et conservation du contrôle de consentement ; suite complète CI et vérification GitHub Pages après fusion.

La recette réelle avec administrateur MFA/éducateur et la synchronisation approuvée des fiches privées/publics restent dans le suivi des chantiers ouverts.