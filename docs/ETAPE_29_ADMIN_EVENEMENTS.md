# Étape 29 — Gestion des événements gratuits (administration)

## Périmètre
Un module **Événements gratuits** est ajouté au vrai panneau administrateur Boissy-UJ. Il permet de créer et modifier des événements publics sans billetterie, de préparer des brouillons sans dates et de publier/dépublier des événements datés.

La page publique des événements continue de lire uniquement les événements dont `published=true` et `access_kind='public'`. Aucun événement ou billet fictif n'est ajouté par ce déploiement.

## Formulaire
Nom (4–150 caractères), description (jusqu'à 4000), catégorie, début, fin, lieu, capacité facultative et case à cocher de publication. Un événement ne peut être publié sans deux dates valides. Les modifications d'un événement déjà publié demandent deux confirmations dans le formulaire générique du panneau.

## Backend Supabase
Migration `202610210022_admin_free_events.sql` :
- `admin_list_free_events()` : listes des dossiers gratuits/publics, brouillons inclus, réservée à `auth.uid()` + `app_private.is_admin()` (MFA AAL2).
- `admin_save_free_event(...)` : création et modification sur un sous-ensemble strictement gratuit/public, avec contrôle du timestamp `updated_at` pour prévenir l'écrasement de changements concurrents, journalisation privée et confirmation obligatoire pour la publication.
- `app_private.admin_free_events_audit` : historique privé de toute création, modification ou dépublication, sans accès de lecture du navigateur aux données d'audit.
- Aucun droit `INSERT/UPDATE/DELETE` sur la table `club_events` accordé aux utilisateurs anonymes ou connectés.

## Garde-fous financiers et d'accès
- `booking_kind='free'`, `price_cents=0`, `premium_price_cents=null`, `booking_status='not_open'`, `priority_kind='none'`.
- L'éditeur refuse de modifier les événements payants ou Premium. Il n'active aucun paiement, panier, abonnement, billet ou réservation.
- L'utilisateur ordinaire ne peut pas afficher ou écrire les brouillons, même en accédant directement au lien `#/control-center`.

## Vérifications
Tests unitaires Node des validations, dates, RPC, droits anonyme, audit, verrouillage optimiste et raccordement dans le back-office. La migration est nécessaire **pour activer le module dans l'interface**, mais ne bloque pas l'intégration de son code : tant que `admin_list_free_events()` échoue ou est absente, le menu **Événements gratuits reste masqué** après vérification de la session administrateur AAL2. Aucun faux formulaire n'est montré.

### Activation après déploiement de la migration
Le connecteur Supabase n'a pas permis l'application automatique de la migration pendant ce sprint. Un administrateur du projet doit ouvrir [SQL Editor](https://supabase.com/dashboard/project/dahzewvbybujqhogumte/sql/new), prendre le SQL du fichier `supabase/migrations/202610210022_admin_free_events.sql` **à partir de la branche fusionnée**, vérifier qu'il correspond au changement approuvé, puis exécuter le script dans le projet Boissy-UJ.

Après exécution, contrôler l'existence de `public.admin_list_free_events()`, `public.admin_save_free_event(...)` et de `app_private.admin_free_events_audit`. Vérifier également que les rôles `anon` n'ont pas le droit d'exécuter les fonctions, que le rôle `authenticated` nécessite réellement un administrateur avec MFA AAL2 et que l'annuaire des événements publics ne présente aucun brouillon. Actualiser ensuite le panneau administrateur. **Aucun événement de test n'est créé automatiquement**.

Les deux workflows GitHub sont nécessaires pour fusionner le code, mais les tests navigateur et la recette Supabase doivent précéder l'utilisation réelle du module.
