# Étape 4 — Match Center public Boissy-UJ

> **État actualisé :** la migration du catalogue sportif a été appliquée selon l'[état Supabase vérifié](ETAT_SUPABASE_20261021.md). Les anciennes notes de préparation ci-dessous décrivent les étapes antérieures. L'authentification standard est disponible ; les écritures sportives restent protégées par les RPC et permissions décrites aux étapes 27 et 39.


**État actuel :** catalogue sportif appliqué et interface publique en lecture seule. L'administration des matchs est détaillée aux étapes 27 et 39.

## Livraison technique
- Interface Match Center reliée à une lecture Supabase REST (clé publique uniquement).
- Affichage des quatre équipes Seniors A, Seniors B, Seniors C, Vétérans.
- Filtre par équipe, rencontres à venir et résultats, indication de source, dates en fuseau Europe/Paris.
- Aucun score, calendrier ou adversaire fictif.
- Réponses serveur insérées avec `textContent` pour éviter l'injection HTML.
- Annulation des requêtes lors des changements de page.
- En absence de tables/de réseau : le site reste consultable avec les quatre équipes et un message explicite de source indisponible.
- Tests de code sur RLS, statuts, absence de droits d'écriture, score complet et mode dégradé.

## Modèle livré
- `club_teams` : codes `a`, `b`, `c`, `veterans`; source FFF ou manuelle.
- `matches` : publication explicite, dates, adversaire, domicile/extérieur, score si terminé.
- RLS : `SELECT` public uniquement sur les lignes publiées ; pas de création ni modification depuis les comptes publics.
- Mention FFF uniquement si le club a une référence vérifiée et une source autorisée.
- Aucun joueur, licence ou donnée de mineur dans cette migration.

## Historique du déploiement
La demande initiale d'autorisation concernait le premier lot. La migration est depuis confirmée comme appliquée dans le rapport daté du 21 octobre 2026 ci-dessus.

## Étapes ultérieures
1. Recetter les lectures publiques et les RPC avec les comptes de test autorisés.
2. Vérifier sur une base de préproduction les politiques RLS, l'absence de droits d'écriture et la lecture des quatre équipes.
3. Tester la saisie de vraies rencontres via un futur panneau administratif **serveur** avec audit, pas directement depuis un client anonyme.
4. Tester la publication/dépublication avec des données fictives dans un environnement de test et retirer les données d'essai.
5. Ajouter les classements et statistiques après confirmation de source FFF autorisée.
6. Recette mobile et accessibilité, après les tests fonctionnels.

La page publique conserve un repli sans données publiées ; les calendriers externes présentés ailleurs restent des références et ne sont jamais écrits automatiquement comme résultats officiels.
