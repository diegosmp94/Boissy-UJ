# Étape 51 — Recette multi-comptes : preuve d'isolation RLS

## Pourquoi ce correctif

Le script de recette `scripts/real-permissions-smoke.mjs` vérifiait déjà les sessions, les convocations, les droits entraîneur, le MFA et les cumuls de rôles. Il manquait une preuve **directe**, en lecture seule, de l'absence de visibilité entre deux comptes sur les quatre tables sensibles : `profiles`, `user_roles`, `role_requests` et `staff_team_assignments`.

Le nouveau script ajoute ces contrôles PostgREST, exécutés sur le **projet de staging uniquement**. Il est impossible de le lancer avec la référence du projet Supabase de production, une clé `service_role`, un endpoint arbitraire ou sans acquittement explicite. Il n'utilise jamais de RPC métier en écriture.

## Ce qui est vérifié avec les sept comptes isolés

| Compte autorisé de staging | Contrôles |
|---|---|
| Supporter | Rôle exact, aucune lecture de profils/rôles/demandes/affectations d'autrui ; aucun accès coach/admin ou convocation de joueur |
| Joueur A et Joueur B | Visibilité limitée à soi ; convocations réelles exclusives A et B non interchangeables |
| Entraîneur A et B | Visibilité limitée à soi sur les quatre tables ; lecture des matchs de son équipe seulement ; refus de lecture de l'autre équipe |
| Administrateur AAL1 | L'appartenance au rôle admin ne donne pas les lectures d'autrui et ne donne pas les RPC administratives |
| Administrateur AAL2 | Les lectures autorisées des rôles et de la gestion sont possibles après challenge TOTP |
| Compte triple rôle | Conserve ses contextes Joueur et Entraîneur, mais son administration reste verrouillée à AAL1 jusqu'au TOTP |

**Tous les comptes doivent être différents** : deux emails égaux, même avec casse différente, sont rejetés lors de la configuration, et une identité Auth retournée en double est rejetée avant les tests. Les deux UUID de convocations exclusives A/B sont désormais obligatoires. On ne peut plus transformer un scénario indispensable en « SKIP » silencieux.

Le script n'affiche dans ses logs que les intitulés des contrôles, l'état de réussite, les erreurs techniques génériques et les nombres de lignes nécessaires ; **jamais les emails, mots de passe, secrets TOTP, tokens, profils ou ID des personnes**.

## Configuration sur staging

Les variables d'environnement suivantes doivent être fournies à l'exécution **hors du dépôt GitHub** depuis des secrets locaux/temporaires du projet de staging : `BOISSY_TEST_ENVIRONMENT=test`, `BOISSY_TEST_ACK=YES_RUN_READ_ONLY_PERMISSION_TESTS_ON_STAGING`, `BOISSY_TEST_PROJECT_REF` (référence distincte de la production), `BOISSY_TEST_SUPABASE_URL`, `BOISSY_TEST_PUBLISHABLE_KEY`, `BOISSY_TEST_PERSONAS_JSON` et `BOISSY_TEST_FIXTURES_JSON`.

Le JSON personas contient sept personnes de test consentantes nommées `supporter`, `playerA`, `playerB`, `coachA`, `coachB`, `admin`, `tripleRole`, chacune avec email de test, mot de passe de staging et liste exacte de rôles. Les deux comptes admin disposent d'un facteur TOTP **déjà vérifié** et de leurs propres secrets de staging.

Le JSON des fixtures comprend `teamA`, `teamB` (codes de deux équipes différentes), ainsi que `playerAExclusiveMatchId` et `playerBExclusiveMatchId` (UUID **existants** et distincts de deux convocations de test effectivement affectées aux joueurs respectifs). Un environnement vide ne peut pas produire de faux succès.

Commande : `npm run smoke:real-permissions`. Toutes les personnes, équipes et convocations de test sont créées préalablement sur le **projet isolé** par des administrateurs habilités, conformément aux règles du club ; le script n'effectue aucun enregistrement ni mutation métier. Les défis TOTP et connexions créent uniquement les sessions d'authentification nécessaires, puis demandent leur fermeture locale.

## Limites et conditions de validation

- Les tests automatisés GitHub de ce lot vérifient le **code de la recette et son refus de configuration dangereuse**. Ils ne remplacent pas les exécutions authentifiées avec sept comptes de test.
- Aucune campagne multi-comptes réelle n'a été exécutée tant que ces comptes, leur MFA et les deux convocations distinctes n'ont pas été préparés sur une base de staging approuvée.
- Un succès sur staging prouve ces scénarios à ce moment-là seulement, pas l'ensemble des exigences RGPD, les droits d'image ni la restauration.
- Conserver uniquement un compte-rendu technique de réussite/échec et l'horodatage ; ne jamais committer les variables secrètes.
- Tester séparément les écritures métier sous procédure contrôlée (validation de rôle par un autre admin, convocation, révocation), après sauvegarde. Ce script demeure volontairement **en lecture seule pour les données du club**.

Référence : `docs/P1_ESPACES_SPORTIFS_RECETTE.md` et `docs/RECETTE-PONDEREE.md`.
