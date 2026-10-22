# P1 qualité — indexation Supabase et statut documentaire (22 octobre 2026)

## Motivation et périmètre
Le conseiller Performance Supabase affichait **9 clés étrangères sans index couvrant**. Ces relations sont utiles pour les recherches et jointures des modules de convocations, audit des équipes et rôles, Award et gestion des demandes.

La migration `202610220006_foreign_key_query_indexes.sql` ajoute exactement neuf index B-tree avec `IF NOT EXISTS` ; aucune table, politique RLS, fonction, membre, rôle ou donnée n'est modifié. Les index nouvellement créés ne donnent **aucun accès supplémentaire**. Les tests automatisés vérifient la liste et l'absence d'opération destructrice.

## Vérifications attendues
1. `npm test` (nouveau test `p1-db-performance.test.mjs`) et les deux workflows CI sur la branche.
2. Appliquer le SQL sur le projet Supabase Boissy-UJ en tant que migration de schéma versionnée, après examen de la PR.
3. Vérifier dans `pg_indexes` l'existence des neuf index et relancer le conseiller Performance ; vérifier que son alerte « unindexed_foreign_keys » disparaît.
4. Vérifier séparément les avis Sécurité : **les RPC SECURITY DEFINER exposées au rôle authenticated doivent garder leurs contrôles serveur explicites (auth.uid, équipe, MFA selon l'action)**. Ne pas supprimer les restrictions RLS pour éliminer les alertes de pure information sur les tables privées.
5. Conserver la checklist P1 RGPD / accessibilité / sauvegarde, car l'indexation ne vaut pas recette de production.

## Limites
Les index sur de petites tables peuvent ne pas être choisis par le planificateur, ce qui ne prouve pas une panne. Les avis « unused_index » n'impliquent pas une suppression immédiate, en particulier avant usage réel. Ce correctif n'active ni paiement LIVE, ni autorisation privilégiée, ni publication de données de mineurs, ni indexation du site dans les moteurs de recherche.

La documentation fonctionnelle actualisée est dans `docs/CAHIER_DES_CHARGES.md` : le code des rôles cumulés existe, mais les vérifications multi-identités, les informations légales et la restauration restent à faire.
