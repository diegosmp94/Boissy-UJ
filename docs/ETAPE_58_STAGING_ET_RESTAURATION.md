# Étape 58 — Préproduction isolée, sécurité des cibles et restauration

**23 octobre 2026 — Partie A : outillage développé, préproduction non créée.** Le dépôt dispose déjà des tests MFA à sept comptes, de la recette de deux comptes pour les actualités et des inventaires de restauration. Cette étape regroupe et renforce leurs prérequis, sans les déclarer exécutés.

## Audit constaté avant développement

- Organisation Supabase accessible : **Boissy-UJ**, plan **Free**.
- Un seul projet Supabase connecté : **production**. Aucune branche Supabase existante ni second projet indépendant observé.
- Liste de migrations Supabase installées : 31 versions enregistrées sur la production (historique Supabase distinct des noms de fichiers Git).
- Cinq migrations P2 préparées dans le dépôt (réactions, médias, Awards, Stripe TEST, historique), **non exécutées** sur la production.
- Le plan Free peut autoriser deux projets, mais toute création nécessite le **choix explicite de l'organisation et la confirmation d'un éventuel coût**. Une branche Supabase peut être facturée à l'usage et n'est pas notre choix par défaut.

## Livrable 58.1 — Vérification du staging réel (lecture seule)

La commande **npm run staging:preflight** utilise scripts/staging-readiness.mjs.

La cible doit être un **autre projet** validé : l'URL HTTPS exacte est dérivée de la référence du projet staging ; la référence de production est rejetée ; les clés secrètes/service-role sont interdites. Aucune valeur par défaut, aucun appel à la production ni création de compte. Aucun secret ne doit être fourni dans une conversation ni commité.

Variables d'environnement à renseigner localement :

| Variable | Valeur |
|---|---|
| BOISSY_STAGE_ENVIRONMENT | staging |
| BOISSY_STAGE_ACK | YES_CHECK_SEPARATE_BOISSY_SUPABASE_STAGING |
| BOISSY_STAGE_PROJECT_REF | Référence exacte du projet staging autorisé |
| BOISSY_STAGE_URL | https://[référence-du-projet-staging].supabase.co/ |
| BOISSY_STAGE_PUBLISHABLE_KEY | Clé publishable/anon du staging uniquement |

Ce test anonyme effectue strictement **trois requêtes** :

1. GET public club_teams, sans sélectionner de ligne : preuve que le socle du catalogue public est présent.
2. GET configuration du service Auth : preuve que le service Auth du staging répond.
3. POST de **lecture** admin_list_management_news en rôle anon : vérification que l'accès est refusé. Une RPC manquante (404) n'est **pas considérée** comme une preuve de sécurité.

Le résultat ne certifie **ni les permissions multi-comptes ni une restauration**. Il ne doit pas être confondu avec un audit RLS complet.

## Livrable 58.2 — Inventaire des migrations en attente

La commande **npm run staging:migration-plan** calcule les empreintes SHA-256 des cinq fichiers SQL préparés :

| Ordre de revue | Migration |
|---|---|
| 1 | 202610230001_member_news_reactions.sql |
| 2 | 202610230002_verified_news_media_assets.sql |
| 3 | 202610230003_premium_awards_ballots.sql |
| 4 | 202610230004_stripe_test_billing_webhook.sql |
| 5 | 202610230005_news_revision_restore.sql |

Le manifeste vérifie la présence, l'unicité, les transactions et l'ordre ; **il ne valide pas la syntaxe PostgreSQL et n'applique aucun SQL**. L'historique Supabase en production utilise ses propres numéros ; **ne pas rejouer aveuglément** les fichiers Git dans une base déjà initialisée. Étudier les dépendances et les écarts avant toute migration.

## Reste à faire pour clôturer l'étape 58

1. **Décision sur l'environnement** : demander au responsable quelle organisation doit héberger le staging, vérifier le coût et obtenir un accord explicite avant création. Utiliser de préférence un projet Free séparé, si réellement éligible et sans facturation ; ne pas créer une branche payante par défaut.
2. **Déploiement du socle** : installer le schéma initial validé sur staging sans importer le contenu de production. Vérifier l'ordre des migrations, les extensions, la sécurité RLS et les autorisations.
3. **Recette des sept comptes** : créer des comptes **fictifs consentis** uniquement sur staging et deux convocations test. Exécuter npm run smoke:real-permissions et archiver un PV de refus et d'accès AAL1/AAL2 expurgé.
4. **Recette des actualités et Awards** : exécuter leurs scripts de staging uniquement après revue et migrations requises ; n'activer aucun checkout ou vote LIVE.
5. **Sauvegarde et restauration** : un responsable habilité prépare une sauvegarde autorisée et chiffrée, conserve localement ses SHA-256, **restaure sur PostgreSQL local séparé** et compare les 17 champs du SQL db-recovery-verification.sql avec npm run verify:recovery. Les vérifications de Storage, Auth et des fichiers sont **distinctes**. Aucune sauvegarde réelle n'a encore été exportée et aucun dump d'utilisateurs n'a été commité.
6. **PV d'homologation** : contrôle des copies et des permissions, test métier positif, tests d'accès refusé et décision signée du responsable. Une simulation CI seule n'autorise pas une clôture.

**État réel : Partie A (outils + tests CI) développée. Partie B (création, migrations et tests staging) et Partie C (restauration prouvée) encore ouvertes. Aucun impact sur Supabase production.**
