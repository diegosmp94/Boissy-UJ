# Étape 87 — Gestion avancée des événements et règles de réservation

**27 octobre 2026 · développement technique hors billetterie effective.**

## Audit de départ

`public.club_events` possède déjà `capacity`, `booking_kind` (`free`/`paid`), `access_kind` (`public`/`premium`), `booking_status`, `priority_kind`, `priority_starts_at` et `priority_ends_at`. Un seul événement était enregistré en production à l'audit, avec `booking_status='not_open'`. Les permissions de la table sont en lecture pour le public, et les mutations ne sont pas directement possibles depuis le navigateur. L'éditeur gratuit historique reste intact.

Les créneaux et une API avancée de mise à jour cohérente de ces champs manquaient. La roadmap sépare explicitement la préparation de ces règles (étape 87) du droit **effectif** de réserver et des billets QR (étapes 88–89).

## Migration `202610270006_step87_advanced_event_booking_rules.sql`

- Table privée `app_private.event_reservation_windows` : événement, ouverture/fermeture, quota, public ou Premium, statut `draft` / `scheduled` / `closed`, verrou optimiste, aucun montant ni réservation.
- Deux journaux privés réunis dans `app_private.admin_event_booking_rules_audit` avec acteur, instant, ancienne/nouvelle valeur. Aucune donnée donateur ou paiement.
- `admin_list_advanced_events` et `admin_save_advanced_event` : lecture/écriture des événements, y compris les projets Premium non publiés. Une réservation ne peut **pas** passer à `open` ou `full` pendant cette étape. L'administrateur peut indiquer `not_open` ou `closed`, la tarification indicative et les paramètres de priorité.
- `admin_list_event_reservation_windows` et `admin_save_event_reservation_window` : gestion des fenêtres de réservation, limitée à un événement réel, sans réserve, ticket ou débit.
- Quatre RPC accessibles à `authenticated` avec **contrôle interne obligatoire du rôle admin et du niveau MFA AAL2** ; aucune RPC n'autorise les visiteurs. Les tables privées sont protégées par RLS et ne sont pas accessibles directement via l'API publique.

## Garanties serveur

- Prix exprimés en **centimes entiers EUR** ; un événement gratuit vaut 0 €, un payant doit avoir un prix positif ; un tarif Premium ne dépasse jamais le public. Aucun tarif ne déclenche un paiement.
- Un événement Premium ne peut pas proposer un créneau public. La priorité Premium pour un événement public nécessite une fenêtre précise, antérieure à l'événement.
- Les créneaux `scheduled` restent **préparés mais non ouverts** ; `closed` ne peut pas être rouvert par cette RPC.
- Fermeture d'un créneau avant le début de l'événement ; aucun chevauchement de fenêtres non closes ; somme des quotas non clos ne dépassant pas la jauge globale.
- Sauvegardes de créneaux sérialisées par verrou `FOR UPDATE` du parent, pour empêcher la concurrence de dépasser la jauge. Conservation d'un historique privé des modifications.
- Contrôle global `BEFORE INSERT OR UPDATE` sur `public.club_events` : **l'ancien éditeur des événements gratuits ne peut plus casser les créneaux**, déplacer leur fermeture après le début de l'événement, abaisser la jauge sous les quotas actifs ou modifier l'accès contre les règles Premium.
- Protection des mises à jour perdues via `updated_at` comparé en transaction pour événements et créneaux. Les conflits nécessitent une actualisation.

## Interface administrative

Nouveau module « Événements avancés » intégré au Control Center après vérification de la capacité du module événements. Il réutilise l'authentification Supabase vérifiée, le contrôle MFA AAL2 à chaque action, et propose :

- Création de brouillons ou modification d'événements officiels existants.
- Types gratuits/payants, accès public/Premium, capacités, dates, tarification indicative, fenêtre de priorité.
- Création et modification des créneaux pour un événement déjà enregistré, avec statuts préparé/brouillon/clôturé.
- Confirmation en deux clics lors d'une publication ou d'une modification sensible ; aucun paiement ou QR généré.

La page publique `#/evenements` demeure **informative et sans réservation active**. Les événements Premium ne sont pas rendus publics par l'ancienne politique RLS tant qu'aucun parcours membre sécurisé n'a été homologué. Le support mobile reçoit des styles responsives dédiés.

## Contrôles et limites

Tests automatiques `tests/step87-advanced-event-rules.test.mjs` : validation des montants, dates, Premium, quotas, permissions, concurrence SQL par lecture du code, régressions de l'éditeur gratuit et absence de nouveaux flux financiers.

L'exécution des tests Node/Chromium et la vérification des permissions en base doivent être consignées après les workflows GitHub. Aucun test statique ne vaut une recette de réservation réelle en parallèle avec plusieurs utilisateurs.

**À venir** : étape 88 (réservation gratuite transactionnelle avec jauge, identité membre et QR personnel) puis étape 89 (contrôle d'entrée par personnel MFA AAL2). Les événements payants ne disposent toujours d'aucun Checkout public : une homologation financière indépendante reste obligatoire.
