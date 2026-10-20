# Boissy-UJ — matrice de recette pondérée (100 points)

**Statut** : barème de référence validé par la méthode pondérée, scores de développement à confirmer par tests.

| Domaine | Pondération | Première tranche visée | Conditions de validation |
|---|---:|---|---|
| Accueil cinématique, identité et navigation | 15 | Base visuelle | 8 chapitres, retour arrière, mobile, mouvements réduits |
| Espaces comptes, rôles et sécurité | 16 | Architecture suivante | Supabase Auth, RLS, doubles vérifications, tests de droits |
| Équipes, saisons, licenciés, éducateurs | 13 | Pages publiques | 4 équipes, saisons, affectations, convocations et profils |
| Match Center et FFF | 13 | Pages d'attente | Scores vérifiés, saisie manuelle, suivi statistique |
| Actualités et Media Center | 8 | Page initiale | Médias autorisés, publication éducateur, réactions uniquement |
| Communauté, Premium et Awards | 8 | Présentation des offres | 10 €/mois, 100 €/an manuel, votes uniques |
| Événements et billetterie | 7 | Spécification | Capacité, tarifs variables, priorité, QR codes, remboursements |
| Dons, campagnes et Stripe test | 8 | Spécification | Dons récurrents, affectation, paiements signés en test |
| Control Center, édition, audits | 8 | Spécification | Droits, brouillons, publication, restauration, journal |
| Qualité, conformité, accessibilité et déploiement | 4 | Tests initiaux | LCP, INP, CLS, RGPD, sauvegarde, non-régression |
| **Total** | **100** | | |

## Règle des 85 %

Une ligne n'obtient ses points que sur preuve de critères d'acceptation vérifiés. Les pages décoratives ou maquettes ne valident pas des fonctions de production. À 85 points confirmés, lancer la **campagne de recette formelle**, mais ne pas déployer automatiquement.

## Conditions bloquantes, indépendamment du score

1. Aucun accès à des données privées par un visiteur non autorisé.
2. Aucun statut premium attribué sans vérification du paiement côté serveur.
3. Aucun prélèvement LIVE avant conformité légale, configuration Stripe et accord explicite.
4. Politique RGPD, droit à l'image, traitement des mineurs et mentions légales validés.
5. Parcours mobile et clavier utilisables, animation passable.
6. Sauvegarde et restauration testées.
7. Données FFF intégrées uniquement par une méthode autorisée ; mode manuel testé.

## Statut de départ

**0 / 100 point certifié en recette de production.** Les premiers écrans de préversion représentent du travail engagé, pas une validation de la fonctionnalité complète. Les tests techniques automatiques du squelette ne valent pas recette de production.
