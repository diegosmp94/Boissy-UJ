# P1 — Recette des comptes et permissions : audit SQL et environnement isolé

**24 octobre 2026 — Outillage et audit métadonnées. Pas de certification de comptes réels.**

## Résultat de l'audit en lecture seule sur la production

Les contrôles ont consulté uniquement `pg_tables`, `pg_policies`, `pg_proc` et le Supabase Security Advisor, **sans lire de profil personnel, sans mutation SQL et sans utiliser de service role**.

| Contrôle | Constat |
|---|---|
| Tables exposées dans le schéma `public` | 20 |
| Tables `public` avec RLS actif | **20/20** |
| Fonctions `SECURITY DEFINER` du schéma `public` exécutables avec `anon` | **0** |
| Fonctions `SECURITY DEFINER` publiques exécutables par `authenticated` | **28** (warnings Supabase) |
| Fonctions `admin_*` inspectées | **20/20** appellent `app_private.is_admin()` |
| Protection du helper `app_private.is_admin()` | Teste simultanément `auth.jwt() ->> 'aal' = 'aal2'` et la présence du rôle `admin` dans `public.user_roles` |

**Interprétation importante :** ces résultats sont de **bonnes protections structurelles**, mais les 28 warnings `authenticated_security_definer_function_executable` demandent encore une revue de chaque RPC et de ses entrées. Les appels de fonction `SECURITY DEFINER` sont volontairement accessibles aux sessions authentifiées pour fournir les outils métier, et leurs gardes internes doivent être vérifiées indépendamment. Les 15 notices `rls_enabled_no_policy` concernent principalement des tables `app_private` interdites en accès direct ; une table sans politique RLS y est par défaut inaccessible aux utilisateurs. Il reste à vérifier l'ensemble des fonctions déclenchées, l'audit, les fuites de lignes, les utilisateurs suspendus et les fichiers Storage.

La commande SQL de revue répétable est `scripts/db-p1-permissions-readonly-audit.sql`. Elle retourne **des agrégats sans PII**. Elle est informative : la simple présence de texte `app_private.is_admin` dans un corps de fonction ne prouve pas que tous les chemins d'exécution sont correctement protégés. Documentation Supabase : [Database Linter](https://supabase.com/docs/guides/database/database-linter), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Pourquoi la recette complète n'a pas encore été exécutée

- Les sept profils obligatoires (`supporter`, `playerA`, `playerB`, `coachA`, `coachB`, `admin`, `tripleRole`) et les deux convocations de test exclusives n'existent **pas** dans un environnement isolé vérifié.
- Le quota Supabase Free du compte empêche actuellement la création d'un second projet hébergé gratuit.
- Aucun ordinateur local équipé de Docker et de Supabase CLI n'est contrôlable depuis cette session.
- Une lecture SQL en tant qu'administrateur **ne reproduit pas** la session JWT `aal1` d'un supporter, ni l'étape MFA `aal2` d'un administrateur.

## Nouveau : exécuter les sept profils sur Supabase local, sans ouvrir la production

Le script `npm run smoke:real-permissions` conserve le mode staging hébergé (`BOISSY_TEST_ENVIRONMENT=test`) **et** accepte maintenant le mode **Docker local explicitement confirmé** (`BOISSY_TEST_ENVIRONMENT=local`).

En mode local, **toutes** les conditions suivantes sont vérifiées avant toute demande HTTP utilisant des identifiants :

- Dépôt ayant `supabase/config.toml` avec `project_id = "boissy-uj-local"`, PostgreSQL 17, `.gitignore` protégeant `supabase/.temp/` et `supabase/.branches/`.
- **Aucun projet distant lié** au dépôt (fichier `supabase/.temp/project-ref` absent).
- Docker disponible et Supabase CLI disponible en local (sans commande de modification du cloud).
- Cible unique `http://127.0.0.1:54321/` : rejet de `localhost`, IP réseau, hostname cloud, autres ports, chemin, query, fragment et URL avec identifiants.
- Deux confirmations : `BOISSY_TEST_LOCAL_STACK_ID=boissy-uj-local` et `BOISSY_TEST_ACK=YES_RUN_READ_ONLY_PERMISSION_TESTS_ON_LOCAL_DOCKER`.
- **Uniquement une clé publique** publishable/anon de l'instance locale : clés `service_role`, `sb_secret_`, Stripe et projet cloud de production rejetés.
- Sept comptes de test distincts, adresses confirmées, rôles attendus, deux équipes séparées et **deux matchs avec convocations exclusives**. Deux comptes administrateurs requièrent des facteurs TOTP vérifiés.

### Exécution (sur un ordinateur local habilité seulement)

1. Dans **une copie non liée** du dépôt, lancer `npm run local:preflight` après avoir installé les outils Docker et Supabase CLI. Cette commande **n'installe ni ne démarre Docker** et ne modifie rien.
2. **Revoir** les migrations initiales et leurs dépendances pour un démarrage à neuf avant toute commande `supabase start` ; un dump de production ou des comptes réels ne doit pas être utilisé. La stack locale est pour développement, pas pour publication internet.
3. Installer/reproduire le schéma minimal validé **uniquement sur la stack locale**, créer sept comptes fictifs et confirmés avec rôles internes attendus et deux convocations de test. Obtenir deux facteurs TOTP sur les comptes admin et tripleRole.
4. Renseigner les variables d'environnement en local via un gestionnaire de secrets, **jamais dans GitHub, dans ce chat ou dans une capture** :

| Variable | Paramètre |
|---|---|
| `BOISSY_TEST_ENVIRONMENT` | `local` |
| `BOISSY_TEST_ACK` | `YES_RUN_READ_ONLY_PERMISSION_TESTS_ON_LOCAL_DOCKER` |
| `BOISSY_TEST_LOCAL_STACK_ID` | `boissy-uj-local` |
| `BOISSY_TEST_PROJECT_REF` | Absent ou vide |
| `BOISSY_TEST_SUPABASE_URL` | `http://127.0.0.1:54321/` |
| `BOISSY_TEST_PUBLISHABLE_KEY` | Clé publique du serveur de test local |
| `BOISSY_TEST_PERSONAS_JSON` | Sept utilisateurs **fictifs** avec `email`, `password`, `roles`, plus `totpSecret` pour `admin` et `tripleRole` |
| `BOISSY_TEST_FIXTURES_JSON` | `teamA`, `teamB`, `playerAExclusiveMatchId`, `playerBExclusiveMatchId` |

5. Exécuter `npm run smoke:real-permissions` et conserver un PV expurgé. La commande lit les permissions et déclenche les authentifications + confirmations MFA ; elle **ne crée aucun compte, aucune publication et aucun billet**. Un refus doit effectivement être un refus `401`, `403` ou SQL `42501`, jamais une RPC absente. Les affichages ne doivent pas contenir de mot de passe, de token ou de secret TOTP.
6. Saisir les résultats d'homologation positive **et négative** de chaque profil (supporter anonyme, joueur A/B, coach A/B, admin AAL1/AAL2, cumul) et les faire revoir par le responsable sécurité du club.

### Limite des certificats

Les tests unitaires CI éprouvent le parseur de cible et les refus de configuration **sans se connecter** à Docker ou Supabase. La vraie recette exige **sept authentifications** et deux facteurs MFA réellement validés. N'afficher **aucun statut « P1 réalisé »** tant que ce compte rendu n'existe pas.

**Statut réel : audit structurel prod effectué ; exécution locale rendue possible en code ; 7/7 connexions MFA/RLS, restauration et homologation juridique toujours non effectuées.**
