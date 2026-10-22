# Étape 43 — Onglets Championnat / Coupe par équipe

État du 23 octobre 2026. Séparation **par équipe**, **type de compétition** et **saison**, dans les cinq fiches et le Match Center.

## Catégories 2026–2027 indiquées par le club

| Équipe | Championnat / activité | Coupe |
|---|---|---|
| Seniors A | D3, poule B | **Coupe du Val-de-Marne Seniors**, match du 11 octobre contre Villejuif US (résultat tiers non homologué) |
| Seniors B | D4, poule C | **Pas de participation annoncée pour 2026–2027** |
| Seniors C | Amicaux seulement | **Pas de participation annoncée** |
| Vétérans | Anciens D3, poule C | **Participation en coupe confirmée par le club**, mais aucun match spécifique retrouvé dans le corpus sourcé et dénomination exacte à confirmer |
| Senior (catégorie futsal) | Futsal D2, poule B | **Coupe nationale futsal**, match du 3 octobre contre Petits Anges ES (résultat tiers non homologué) |

Les anciennes coupes restent consultables uniquement dans **2025–2026** : notamment Seniors A (Coupe VDM Seniors), Seniors B (Coupe Seniors Amitié), Senior futsal (Coupe nationale futsal / Coupe VDM Futsal). L’existence d’une coupe lors de cette saison précédente ne prouve pas une participation en 2026–2027. L’équipe Senior futsal est désignée **Senior** dans la catégorie futsal.

## Calendrier et provenance

Le club a confirmé les dates 2026–2027 communiquées dans le dialogue. La vue conserve donc `date_confirmed_by_club=true` pour ces données. **Cela ne transforme pas les scores sourcés en résultats approuvés** : `validated_by_club=false`, liens SportCorico/TheFootData visibles. Aucune date ni score de coupe des Vétérans n’est inventé. Aucune donnée externe n’est publiée dans `public.matches` par cette modification.

Les onglets filtrent les archives, les rencontres jouées et les rencontres à venir. Une sélection de saison (2025–2026 ou 2026–2027) reste disponible. Une coupe non disputée au cours de la saison sélectionnée ne récupère pas les résultats d’une autre équipe. Les amicaux des Seniors C peuvent être affichés dans la première rubrique, sans prétendre constituer un championnat.

## Administration

La nouvelle migration `supabase/migrations/202610220012_match_competition_categories.sql` a été appliquée sur Supabase. Les rencontres saisies dans `public.matches` disposent de `competition_kind` (`league`, `cup`, `friendly`, `unspecified`) et `competition_label`. **Les anciennes rencontres non classées restent `unspecified`**, pas automatiquement en championnat.

Le Control Center → **Matchs et résultats → Classement des rencontres : championnat ou coupe** permet de sélectionner un dossier existant, affecter la compétition et confirmer deux fois. Le RPC `admin_set_match_competition` exige le rôle admin et MFA AAL2, journalise dans un schéma privé et ne touche ni aux dates, ni aux scores, ni au statut publié.

Contrôle SQL de production : **0 match du catalogue publié** au 23 octobre ; RLS actif sur l'audit privé, refus du RPC aux visiteurs anonymes, absence d'écriture anonyme sur `matches`, lecture publique des deux nouveaux champs vérifiée. Les cartes de sources externes continuent d’être affichées, indépendamment du catalogue.

## Recette

Tests automatisés : participations par équipe et par saison, distinction coupe/championnat, anciens matchs de coupe des Seniors B restant en 2025–2026, Seniors C sans championnat, résultat de coupe des Seniors A ne comptant pas pour championnat, navigation clavier et état accessible des onglets, permissions de la fonction et de l'audit. Une vérification finale en navigateur physique iPhone/Android avec administrateur MFA reste nécessaire.
