# Protocole de sauvegarde et de restauration — Boissy UJ

**Statut au 22 octobre 2026 : protocole et empreinte source vérifiés ; restauration en environnement isolé NON EFFECTUÉE.**

Le projet est sur le plan Supabase **Free**. Ne pas présumer la disponibilité de sauvegardes automatiques quotidiennes, d'une restauration à la demande ou d'une branche gratuite. La création d'un projet facturable nécessite un accord sur le coût. Toute sauvegarde contenant des données de membres doit être autorisée, protégée et stockée selon la politique du club.

## Inventaire et preuve sans exporter de données personnelles

[scripts/db-recovery-verification.sql](../scripts/db-recovery-verification.sql) est en **lecture seule**, retourne un seul JSON de métadonnées, empreintes de schéma/politiques et comptages agrégés. Il vérifie la présence de RLS, les privilèges RPC anonymes et les restrictions INSERT/UPDATE sur les profils. Il ne sélectionne aucun nom, email, adresse, token ou UUID personnel.

Effectuer la requête **sur la source au moment de la sauvegarde** puis **sur la restauration isolée**, comparer les résultats, documenter tout écart et l'heure des captures. L'égalité des empreintes ne prouve pas l'intégrité de toutes les lignes : une somme de contrôle des fichiers exportés et des tests métier sont également nécessaires.

## Procédure réservée à l'exploitant habilité

1. Préparer une base **distincte de la production**, isolée et de coût accepté. Ne jamais créer de branche/projet Supabase facturable sans accord.
2. Obtenir localement les URLs de base **source** et **cible** via un coffre de secrets. Ne jamais les inscrire dans GitHub, un workflow CI, des captures ou ce dossier. Ne pas afficher leurs mots de passe.
3. Exécuter l'inventaire SQL read-only sur la source, consigner l'empreinte et les compteurs sous accès restreint.
4. Vérifier la version CLI avec « supabase --version » et « supabase db dump --help », puis sauvegarder rôles, schéma et données selon la documentation officielle :

       umask 077
       mkdir -p recovery-private
       supabase db dump --db-url "$SOURCE_DATABASE_URL" -f recovery-private/roles.sql --role-only
       supabase db dump --db-url "$SOURCE_DATABASE_URL" -f recovery-private/schema.sql
       supabase db dump --db-url "$SOURCE_DATABASE_URL" -f recovery-private/data.sql --use-copy --data-only
       sha256sum recovery-private/roles.sql recovery-private/schema.sql recovery-private/data.sql > recovery-private/sha256.txt

5. Vérifier **manuellement** que RECOVERY_DATABASE_URL cible un PostgreSQL **local, réellement isolé**, distinct de la source. Une redirection de port, un proxy ou un tunnel local peuvent autrement pointer sur la production : contrôler l'infrastructure et l'identité de l'instance en plus du nom d'hôte. Exécuter la barrière locale `node scripts/verify-recovery-target.mjs` avant toute opération. Ce contrôle n'ouvre pas de connexion et **ne suffit pas, à lui seul, à garantir la sécurité de la cible**. Ne jamais employer SOURCE_DATABASE_URL comme destination. Restaurer avec la méthode documentée (adapter extensions, rôles et version) :

       psql --single-transaction --variable ON_ERROR_STOP=1 \
         --file recovery-private/roles.sql \
         --file recovery-private/schema.sql \
         --command 'SET session_replication_role = replica' \
         --file recovery-private/data.sql \
         --dbname "$RECOVERY_DATABASE_URL"

6. Sur la **cible exclusivement**, vérifier les empreintes SHA-256 de l'archive, exécuter le même script SQL de vérification, comparer les comptages et les fingerprints. Effectuer un essai métier avec des comptes autorisés, sans envoyer de vrais mails ou déclencher de paiements.
7. Contrôler séparément les éléments potentiellement absents de l'export SQL : **Auth (configuration et redirects), Storage et objets, Edge Functions, secrets, domaines, fournisseurs externes et tâches planifiées**.
8. Émettre un procès-verbal sans données personnelles (date, opérateur habilité, contrôle de la cible, version, checksums, écarts, décision), puis éliminer les copies temporaires conformément à la politique du club.

Référence officielle : [Supabase — restaurer une base plateforme vers une instance self-hosted](https://supabase.com/docs/guides/self-hosting/restore-from-platform). Les commandes devront être revalidées contre la version de la CLI au moment réel de l'opération.

## Préparation environnement distinct — étape 58

Le préflight stage 58 (**npm run staging:preflight**) est un contrôle réseau **strictement en lecture seule**, qui rejette l'environnement de production et les clés privées. Le manifeste des cinq migrations préparées (**npm run staging:migration-plan**) est également hors ligne. [Consulter le guide de l'étape 58](ETAPE_58_STAGING_ET_RESTAURATION.md). **Ni l'un ni l'autre ne prouvent une restauration**. Le PV de récupération nécessite toujours un PostgreSQL local, réellement isolé, une sauvegarde autorisée, un SHA-256 du dump, l'inventaire source/cible et la vérification des services externes.

## Comparateur hors ligne développé — étape 52

Après une restauration **réellement exécutée** par le responsable habilité, consigner le résultat de `scripts/db-recovery-verification.sql` dans deux fichiers JSON distincts et privés : un avant la sauvegarde, l'autre sur l'instance isolée restaurée. Lancer `npm run verify:recovery -- source.json restauration.json`.

Le script compare 17 champs agrégés (nombre de tables, empreintes schéma/RLS, règles de permission, nombres de comptes/équipes), refuse les champs manquants/supplémentaires et les configurations dangereuses, et renvoie **0** si les instantanés sont compatibles, **2** en cas d'écart et **1** si les fichiers/arguments sont invalides. Il ne se connecte pas à PostgreSQL, ne lit aucune donnée membre et ne peut attester seul que le restore a été exécuté. Conserver les SHA-256 d'archives, le PV du test métier et la preuve de séparation des environnements. **Aucune restauration n'a été lancée par ce changement.**



| Domaine | Preuve requise |
| --- | --- |
| Protection des données | Archives chiffrées pour stockage/transport, jamais commitées |
| Source intacte | Aucune commande de restauration ni d'écriture sur production |
| Restauration isolée | Transaction réussie, cible indépendante et vérifiée |
| Structure et droits | Schéma et politiques RLS concordants, aucun accès RPC anonyme privilégié |
| Comptes et données | Comptages et tests métiers concordants sur la copie |
| Services hors SQL | Auth, Storage, Edge, secrets, URL traités séparément |
| Traçabilité | PV signé par l'exploitant autorisé |

**La restauration ne sera considérée comme validée qu'après un import réel en environnement isolé et une recette fonctionnelle.**
