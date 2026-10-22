# P1 — Sécurité des profils et préparation de reprise Supabase

**Date :** 22 octobre 2026. **Décision de recette : homologation complète non prononcée.**

## Réalisé et contrôlé directement dans le projet

Le schéma `public.profiles` comporte `id`, `display_name`, `created_at`, `updated_at`. Initialement, `authenticated` pouvait exécuter `UPDATE` sur **toutes** les colonnes de sa propre ligne. La politique RLS protégeait la ligne, pas ses colonnes.

Migration appliquée : `boissy_uj_profile_column_level_write_guard_20261022`; source versionnée : `supabase/migrations/202610220007_profile_column_level_write_guard.sql`.

- Le rôle `authenticated` peut désormais modifier uniquement `display_name` ; écriture directe sur `id`, `created_at` et `updated_at` refusée.
- La politique RLS existante continue de réserver le profil à son propriétaire et à l'administrateur habilité (lecture et mise à jour selon les règles en place).
- Le déclencheur `trg_boissy_profiles_updated` calcule `updated_at` côté serveur.
- La correction administrative `admin_update_member_display_name` utilise une fonction privilégiée contrôlant MFA AAL2 et générant une trace d'audit ; cette fonction n'est pas équivalente à une autorisation de modifier toute la table côté client.

Rapport de contrôle reproductible : `scripts/db-roles-contract.sql`. Dernière lecture : 18 tables publiques toutes sous RLS, aucune RPC `SECURITY DEFINER` exécutable anonymement ; garde admin vérifiant rôle et AAL2. **C'est un contrôle structurel, pas un test multicomptes authentifié.**

## Authentification : réglage non activable sur l'offre actuelle

Le projet appartient à une organisation Supabase en offre **Free**. D'après la documentation officielle Supabase, le filtrage des mots de passe présents dans des fuites est réservé aux offres **Pro et supérieures**. Cette fonction n'a pas été activée, et **aucun changement d'offre payante n'a été effectué**.

Action de préparation, sans paiement ni configuration inventée : maintenir MFA AAL2 pour les opérations administrateur, une longueur de mot de passe recommandée d'au moins 8 caractères, un gestionnaire de mots de passe et le suivi de ce risque. Toute future activation doit être vérifiée sur l'offre éligible et les réglages Auth avant d'être annoncée.

Référence : https://supabase.com/docs/guides/auth/password-security

## Sauvegarde et restauration : procédure sûre à exécuter dans une base isolée

**État : procédure et garde-fou fournis, mais aucune restauration effective n'est revendiquée.** La session Supabase connectée ne fournit pas de sauvegarde complète exportable ni une base locale isolée. Il n'est pas acceptable de restaurer des données du club par erreur dans la production ou d'envoyer les exports vers GitHub.

**Prérequis** : autorisation du responsable de données, Supabase CLI + Docker + `psql`, base PostgreSQL locale isolée correctement protégée, stockage des exports chiffré et durée de conservation décidée par le club. Les chaînes de connexion restent des **variables d'environnement privées** : ne jamais les committer, les afficher dans les logs ou les saisir dans un ticket.

Exemple de procédure depuis un poste **habilité**, après vérification de la documentation CLI de la version installée :

```sh
# SOURCE_DATABASE_URL et RECOVERY_DATABASE_URL sont définies localement,
# de manière confidentielle, hors dépôt et hors journaux partagés.
node scripts/verify-recovery-target.mjs

# Exports à conserver exclusivement dans un répertoire sécurisé hors dépôt.
supabase db dump --db-url "$SOURCE_DATABASE_URL" -f roles.sql --role-only
supabase db dump --db-url "$SOURCE_DATABASE_URL" -f schema.sql
supabase db dump --db-url "$SOURCE_DATABASE_URL" -f data.sql --use-copy --data-only

# Exécuter UNIQUEMENT avec RECOVERY_DATABASE_URL de PostgreSQL LOCAL ISOLÉ.
node scripts/verify-recovery-target.mjs
psql --dbname "$RECOVERY_DATABASE_URL" --single-transaction -v ON_ERROR_STOP=1 \
  -f roles.sql -f schema.sql \
  -c "SET session_replication_role = replica" -f data.sql
```

Le garde-fou `scripts/verify-recovery-target.mjs` refuse les bases distantes, les DSN absentes/invalides et une cible égale à la source ; il ne se connecte à aucun serveur ni ne journalise les identifiants. **Ce garde-fou ne remplace pas une vérification humaine du nom de la cible et de l'environnement Docker**.

Faire exécuter `scripts/db-recovery-schema-fingerprint.sql` sur la source et la base restaurée, comparer les résultats **dans un procès-verbal privé**. En complément, comparer dans l'environnement isolé les comptes de lignes des tables métier, les utilisateurs Auth, les accès aux RPC et les migrations ; essayer une inscription et une connexion de compte de recette dédié au laboratoire, sans vrais utilisateurs. Les objets Supabase Storage, les clés et les paramètres d'authentification externes nécessitent un plan distinct. Ne jamais télécharger ou archiver les données des mineurs dans les artefacts CI.

Si un seul contrôle diverge, **reprise non homologuée** ; conserver les erreurs anonymisées et restaurer un export neuf.

Référence : https://supabase.com/docs/guides/self-hosting/restore-from-platform

## Vérifications complémentaires toujours bloquantes

| Vérification | Validation requise |
| --- | --- |
| Joueur, entraîneur, admin, doubles et triple rôles | Deux administrateurs distincts avec MFA, et des comptes explicitement autorisés, pour tester les refus et les approbations |
| iPhone Safari + VoiceOver / Android Chrome + TalkBack | Recette sur des appareils réels avec traces anonymisées |
| Auth complète | Confirmation des e-mails, réinitialisation, révocation des sessions et redirection dans plusieurs navigateurs |
| Restauration | Déploiement local isolé et procès-verbal signé, non réalisé ici |
| RGPD / données des mineurs / mentions légales | Validation de l'identité juridique du club, des prestataires, durées et droits par le responsable habilité |
| Indexation du site | Ne pas lever `noindex` avant homologation et décision expresse du club |

Le correctif des colonnes protège les modifications directes sans prétendre garantir à lui seul la sécurité de toutes les procédures privilégiées. Aucun achat, compte fictif, suppression de données ni restauration en production n'a été fait.
