# Optimisation P2 — couverture des clés étrangères (26 octobre 2026)

## Constat constaté en production

Le conseiller Supabase (performance : `unindexed_foreign_keys`) a indiqué **9 contraintes sans index couvrant**. Vérification indépendante effectuée en lecture seule dans `pg_constraint` et `pg_indexes`. Les index déjà présents sur ces tables ne commencent pas par les colonnes signalées.

- `app_private.league_standings_audit(actor_user_id)`
- `app_private.match_competition_audit(actor_user_id)`
- `app_private.match_competition_audit(match_id)`
- `app_private.team_player_position_audit(actor_user_id)`
- `app_private.team_player_position_audit(player_user_id)`
- `app_private.team_player_position_audit(team_id)`
- `app_private.team_player_positions(updated_by)`
- `public.team_league_standings(season_id)`
- `public.team_league_standings(updated_by)`

## Correction

`supabase/migrations/202610260004_cover_missing_foreign_keys.sql` ajoute neuf index B-tree simples avec `IF NOT EXISTS`. Aucune colonne, table, contrainte, politique RLS, utilisateur, publication ou donnée sportive n'est modifiée. Pas de `CREATE INDEX CONCURRENTLY` dans le script pour préserver la compatibilité du lanceur de migrations transactionnel. Les migrations de production doivent être appliquées **après réussite CI** et vérifiées par introspection SQL et par le conseiller Supabase.

### Recette technique attendue

1. `npm test` puis les workflows GitHub en vert.
2. Vérifier que les neuf index existent et que leurs premières colonnes correspondent exactement aux neuf clés étrangères.
3. Relancer le conseiller `unindexed_foreign_keys` (objectif : zéro avertissement).
4. Vérifier `pg_tables.rowsecurity` pour chaque table `public` : toutes doivent conserver RLS activée.
5. Enregistrer la migration effective et fusionner dans `main`. Ne pas déduire un gain de latence sans mesures avant/après.

## Résultats constatés dans Supabase

Migration `cover_missing_foreign_keys_20261026` appliquée avec succès et enregistrée par Supabase (version `20261026142029`).

- Vérification PostgreSQL de la validité de chacun des neuf index et de leur première colonne : **9 / 9**.
- Second audit Supabase performance : **aucune alerte `unindexed_foreign_keys`**.
- Vérification RLS dans `pg_tables` : **20 / 20** tables `public` conservent RLS activée.
- `unused_index` : 40 notices informatives, soit les 31 d'avant plus les 9 nouveaux ; ce résultat est attendu tant que le trafic n'a pas utilisé les index. Aucune suppression effectuée.

Ces preuves vérifient la structure, **pas** un gain de vitesse mesuré sous charge. La recette réelle des comptes, le contenu officiel et les sauvegardes restent en attente.

L'avertissement `unused_index` peut simplement refléter des tables peu utilisées ; **ne supprimer aucun index sur cette seule indication**. Les tests multi-comptes, la restauration de sauvegarde et l'homologation du contenu officiel restent des chantiers distincts.
