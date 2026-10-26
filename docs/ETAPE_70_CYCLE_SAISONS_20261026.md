# Étape 70 — Clôture, archivage et reconduction des saisons

**26 octobre 2026 · Développement technique.** Aucun match, résultat, effectif, donnée personnelle ni nouvelle saison réelle n'a été créé pendant le déploiement.

## Ce qui change

Une saison suit désormais un cycle explicite et contrôlé : **Prévue → En cours → Terminée → Archivée**. Les changements en arrière et les raccourcis (par exemple prévue → archivée) sont refusés par le formulaire **et** la fonction Supabase `admin_save_season`.

- **Nouvelle saison** : commence toujours à l'état `planned`; seules des décisions administratives MFA AAL2 peuvent la faire avancer.
- **Clôture** : interdit de déclarer une saison terminée ou archivée si ses matchs encore enregistrés sont `scheduled` ou `postponed`. Le club devra confirmer/corriger leur statut ; aucun score n'est inventé.
- **Historique** : le libellé et les dates d'une saison terminée/archivée ne peuvent plus être modifiés ; une saison archivée ne peut pas redevenir active.
- **Intégrité des résultats** : les déclencheurs `matches_season_archive_guard` et `standings_season_archive_guard` verrouillent la saison au moment de toute écriture et refusent les modifications/suppressions des matchs ou classements historiques archivés. Impossible de contourner l'archivage en réaffectant un match existant à une nouvelle saison.
- **Journalisation** : l'audit privé `app_private.season_change_log` distingue `create`, `edit`, `complete`, `archive` et `reconduct`.
- **Reconduction manuelle** : une saison terminée ou archivée sert de référence pour préparer une **nouvelle saison à l'état Prévue**, avec un libellé et des dates décalés d'un an. Opération volontaire, confirmée deux fois et contrôlée par un administrateur MFA AAL2 ; les doublons sont rejetés.
- **Aucune copie implicite** des matchs, scores, championnats, coupes, classements, convocations, joueurs, coachs, affectations, actualités ou publications. Les équipes du club demeurent simplement référencées dans leur registre général indépendant des saisons.

## Livrables

- `supabase/migrations/202610260009_season_archive_reconduct.sql` : contrainte d'état, deux déclencheurs anti-réécriture d'archive, deux RPC avec vérification admin MFA AAL2 et droits d'exécution limités.
- `season-lifecycle-rules.mjs` : modèle d'état et calcul de projection des dates, y compris les années bissextiles.
- `admin-editor-rules.mjs`, `admin-management.mjs`, `admin-season-rollover.mjs` : validation et deux actions de gestion distinctes, sous contrôle d'identité.
- `season-workspace.mjs` : affiche correctement le nouveau statut « Archivée » sur la lecture publique.
- `tests/step70-season-lifecycle.test.mjs` : tests des transitions, archives, MFA et absence de duplication de contenu sportif.

## Limites et mise en service

La migration installe l'outillage ; **elle ne crée ni ne clôture ni n'archive aucune saison** sans action explicite du club. Les périodes, états, validations FFF et résultats sont à renseigner par les administrateurs. Le site public peut afficher les saisons historiques déjà enregistrées, sans importer de données externes.

La validation technique consiste à contrôler le succès de la migration, les nouvelles contraintes et les permissions SQL, puis les tests automatiques et la CI GitHub. Les tests avec comptes administrateurs réels et scénarios d'erreurs utilisateurs restent en dehors des 32 étapes de développement, conformément à la demande.

La prochaine étape **71** traitera le cycle métier des rencontres et des compétitions, en respectant les archives protégées.
