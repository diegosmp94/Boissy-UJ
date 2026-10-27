# Étape 93 — Sauvegardes chiffrées et reprise contrôlée

**27 octobre 2026 — outillage préparé, aucune donnée personnelle exportée ni restaurée.**

## Objectif et état initial

Le site disposait déjà des scripts de reprise `db-recovery-verification.sql`, `db-recovery-schema-fingerprint.sql`, `compare-recovery-inventories.mjs` et `verify-recovery-target.mjs`. Ils vérifient des empreintes, des totaux et des permissions, et interdisent de comparer une même cible à elle-même ou une destination de restauration non locale. Ils ne créaient pas de sauvegarde chiffrée.

Les compléments de l’étape 93 ajoutent une procédure en trois familles **distinctes** :

1. **Code et migrations** : inventaire sans contenu personnel, seulement chemins de fichiers strictement autorisés, taille et SHA-256, comprenant `package.json`, `supabase/config.toml`, les migrations SQL et Edge Functions suivies par Git. Les fichiers `.env`, données d'utilisateurs, médias ou `recovery-private/` ne peuvent jamais y entrer.
2. **Base PostgreSQL** : export logique facultatif déclenché **uniquement sur décision explicite de l’opérateur**, envoyé en mémoire par `pg_dump --format=custom` vers `age`. Seul un fichier `.dump.age` chiffré est créé dans `recovery-private/`, avec dossier 0700 et archive 0600. Les secrets de connexion ne sont pas fournis en argument de commande : fichier `PGPASSFILE` 0600 et paramètres PG* d'environnement, TLS `verify-full` pour source distante. L'archive n'est jamais publiée sur GitHub.
3. **Restauration et comparaison** : inventaire SQL étendu des schémas publics/privés, des politiques RLS, des fonctions privilégiées et des totaux Auth/Storage/medias/votes/RGPD. Comparaison de deux fichiers de métadonnées **strictement validés**, qui échoue pour toute divergence ou permission dangereuse.

## Commandes préparées

### 1. Inventaire local du code

```bash
npm run recovery:code-inventory
npm run recovery:code-verify
```

La première commande écrit un **nouveau** `recovery-private/recovery-code-inventory.json`. Si un inventaire existe déjà, elle refuse de l'écraser : archivez-le séparément de manière sécurisée avant toute nouvelle référence. La seconde compare SHA-256, tailles et liste de fichiers avec le dépôt Git courant. Aucun téléchargement ni accès Supabase.

### 2. Export logique chiffré de la base (opération contrôlée)

Prérequis sur la machine de sauvegarde : versions compatibles de `pg_dump` et du logiciel `age`, accès de lecture autorisé, réseau chiffré vers la base Supabase, espace de stockage et **clé publique age de sauvegarde** validée. La clé privée de déchiffrement doit être gardée hors du dépôt, hors des journaux et hors de la machine publique.

```bash
# Paramètres à configurer sur la machine opérateur ; ne jamais
# copier leurs valeurs ni les mots de passe dans un ticket ou GitHub.
export PGHOST="<hostname PostgreSQL>"
export PGPORT="5432"
export PGDATABASE="postgres"
export PGUSER="<utilisateur de sauvegarde autorisé>"
export PGPASSFILE="<chemin absolu d'un fichier chmod 600>"
export PGSSLMODE="verify-full"
export BOISSY_BACKUP_AGE_RECIPIENT="<clé publique age1...>"
export BOISSY_RECOVERY_APPROVED="I_APPROVE_ENCRYPTED_READ_ONLY_BACKUP_TO_PRIVATE_DIRECTORY"

npm run recovery:db-export
npm run recovery:db-verify
```

**La présente étape n'exécute pas ces commandes sur une base réelle.** Elles doivent être lancées par un opérateur habilité dans un environnement privé, jamais dans GitHub Actions. Le fichier source `PGPASSFILE` ne doit contenir ni secrets publiés ni droits excessifs ; l'archive ne permet pas, à elle seule, de certifier une restauration Supabase complète.

Un SHA-256 du **fichier chiffré** et sa taille sont consignés dans un reçu privé. Le contrôle `recovery:db-verify` vérifie le reçu du dernier export. Une empreinte correcte vérifie le transport du fichier, **pas** la présence de toutes les données ni la possibilité de les restaurer. Le déchiffrement n'est pas fait par cet outillage.

### 3. Comparaison avant/après une restauration isolée

Exécuter `scripts/db-recovery-verification.sql` puis `scripts/db-step93-recovery-metadata.sql` en lecture seule **sur la source** et **sur une destination de reprise entièrement isolée**. Conserver leurs résultats JSON dans `recovery-private/` ou dans un coffre opérateur non partagé. Ne jamais publier les fichiers complets de données, les tokens, les identités, les photos ou les URI de connexion.

```bash
npm run verify:recovery -- recovery-private/source-public.json recovery-private/restore-public.json
npm run recovery:private-compare -- recovery-private/source-private.json recovery-private/restore-private.json
```

En cas de divergence de schéma, de règles RLS, d'agrégats ou d'accès privilégié anonyme, **bloquer l'homologation** et analyser la cause. Un résultat PASS atteste seulement que les **métadonnées** connues et les totaux comparés sont cohérents, pas le succès de la restauration.

La destination doit être examinée **hors ligne** et ne doit pas pointer vers `dahzewvbybujqhogumte`. Ne pas lancer de restauration depuis le navigateur, GitHub Actions ni depuis cette PR.

## Particularités Supabase à ne pas ignorer

Selon la documentation Supabase, les sauvegardes de **base de données** n'incluent pas les octets physiques des objets Storage. Le registre SQL des objets Storage permet uniquement de comparer un **compte de métadonnées**, jamais de confirmer le contenu des photos/vidéos. Auth configuration, fournisseurs OAuth/SMTP, secrets JWT, clés API, Edge Functions et paramètres d'environnement demandent également un inventaire et une remise en configuration distincts.

Supabase recommande le **CLI Supabase `db dump`** pour les migrations manuelles vers un autre environnement Supabase, car le `pg_dump` brut peut intégrer des objets système/non transférables. Ainsi, l'archive `.dump.age` de cette étape est une **copie chiffrée de secours**, à expertiser avant toute tentative de reprise ; elle n'est pas une commande de restauration Supabase prête à exécuter.

Consulter :
- <https://supabase.com/docs/guides/platform/backups>
- <https://supabase.com/docs/guides/self-hosting/restore-from-platform>
- <https://supabase.com/docs/guides/platform/clone-project>

**Ne pas cloner des données personnelles de membres ou de mineurs dans un staging accessible au public.** Les tests fonctionnels de staging doivent de préférence utiliser des comptes synthétiques indépendants. En cas de vraie restauration de reprise, l'accès au système de destination, la rétention, les données des mineurs et les obligations du responsable du traitement doivent faire l'objet d'une autorisation spécifique.

## Validation du développement — 27 octobre 2026

- **[PR #162](https://github.com/diegosmp94/Boissy-UJ/pull/162)** fusionnée dans `main`, commit `87fedf38a30df98a453d5c2b0a5fb4e380d6c7ff`.
- **936 tests automatisés réussis**, 0 échec et **2 workflows GitHub Actions au vert**, avec contrôle de syntaxe, build préproduction, audit des origines et tests Chromium mobile.
- Le contrôle SQL `scripts/db-step93-recovery-metadata.sql` a été exécuté **en lecture seule** sur le projet principal : **55 tables publiques/privées, 0 table sans RLS, 0 RPC SECURITY DEFINER anonyme, 0 métadonnée d'objet Storage et 0 demande RGPD** à l'instant du contrôle. Les empreintes SHA-256 de schéma et politiques ont été vérifiées. Aucun export de données ni modification SQL.
- Le correctif du manifeste inclut désormais aussi les **quatre nouveaux fichiers outillage/métadonnées de l'étape 93**, sous liste blanche stricte. Un test exclut les JSON secrets ou chemins suspects des inventaires.
- **Aucun export réel `pg_dump`, aucun fichier `.dump.age`, aucune restauration ou réplication de données personnelles** n’a été exécuté dans cette recette de code. Le script d'export exige une action manuelle, un destinataire `age`, des paramètres PG* et un fichier de mot de passe privé.

## Matrice d'acceptation hors développement

- Stockage hors site sous contrôle du club ; personne responsable, accès au déchiffrement, fréquence, rotation des clés et durée de rétention à définir par le club.
- Essai de l'export sur machine habilitée ; vérifier absence de fichier SQL brut, permissions 0600, absence de contenu sensible dans les logs et checksum reproductible.
- Reprise contrôlée sur PostgreSQL **local isolé** : authentification, permissions, RLS, cohérence des données et médias octet par octet, restauration des secrets et intégrations, vérification d'authentification réelle et plan de bascule.
- Tests en présence d'une panne ou interruption : archive incomplète refusée, mot de passe expiré, clé de déchiffrement indisponible, fichiers manquants ou mauvais destinataire.
- Seul le club peut décider du RPO/RTO attendu, du coffre de stockage, des droits sur les archives, de la conservation légale et du déclenchement d'une vraie restauration.

**Livrable de l'étape 93 : code et documentation de reprise sécurisés. Aucun dump, clone, nouveau projet Supabase, paiement ou compte réel n'a été créé ou restauré par cette étape.**
