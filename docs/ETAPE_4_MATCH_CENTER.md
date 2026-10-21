# Étape 4 — Match Center public Boissy-UJ

**Code développé ; configuration Supabase des tables sportives en attente d'autorisation.**

## Livraison technique
- Interface Match Center reliée à une lecture Supabase REST (clé publique uniquement).
- Affichage des quatre équipes Seniors A, Seniors B, Seniors C, Vétérans.
- Filtre par équipe, rencontres à venir et résultats, indication de source, dates en fuseau Europe/Paris.
- Aucun score, calendrier ou adversaire fictif.
- Réponses serveur insérées avec `textContent` pour éviter l'injection HTML.
- Annulation des requêtes lors des changements de page.
- En absence de tables/de réseau : le site reste consultable avec les quatre équipes et un message explicite de source indisponible.
- Tests de code sur RLS, statuts, absence de droits d'écriture, score complet et mode dégradé.

## Modèle prévu
- `club_teams` : codes `a`, `b`, `c`, `veterans`; source FFF ou manuelle.
- `matches` : publication explicite, dates, adversaire, domicile/extérieur, score si terminé.
- RLS : `SELECT` public uniquement sur les lignes publiées ; pas de création ni modification depuis les comptes publics.
- Mention FFF uniquement si le club a une référence vérifiée et une source autorisée.
- Aucun joueur, licence ou donnée de mineur dans cette migration.

## Blocage confirmé
L'outil Supabase a demandé une autorisation pour appliquer la migration `202610210003_sport_public_v1.sql`, qui n'a pas été accordée. **La migration n'a pas été appliquée. Ne pas indiquer qu'elle a été déployée.** Aucune nouvelle tentative ne sera faite sans autorisation distincte.

## Étapes ultérieures
1. Obtenir une autorisation pour exécuter la migration sportive.
2. Vérifier sur une base de préproduction les politiques RLS, l'absence de droits d'écriture et la lecture des quatre équipes.
3. Tester la saisie de vraies rencontres via un futur panneau administratif **serveur** avec audit, pas directement depuis un client anonyme.
4. Tester la publication/dépublication avec des données fictives dans un environnement de test et retirer les données d'essai.
5. Ajouter les classements et statistiques après confirmation de source FFF autorisée.
6. Recette mobile et accessibilité, après les tests fonctionnels.

La branche `main` pourra afficher le module public en mode de préparation même sans base sportive, mais la fonctionnalité de synchronisation sera non opérationnelle jusqu'à application des migrations.
