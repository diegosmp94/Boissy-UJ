# Étape 82 — Droits Premium serveur et lecture sécurisée

**26 octobre 2026 — Développement technique (paiements désactivés).**

## État initial vérifié

La base Supabase connectée à Boissy UJ ne contient pas encore les tables Premium/Awards préparées par les étapes historiques 54 et 55. Ces migrations restent **non appliquées**, notamment la facturation Stripe TEST et les votes. Aucun avantage Premium n'est donc activé par le site.

## Livrables de l'étape 82

- Nouvelle table privée `app_private.premium_access_grants` à droits **multiples et indépendants par membre** : identité Auth validée, référence unique de preuve de paiement Stripe **TEST**, plan mensuel ou annuel, intervalle de validité et date de révocation. RLS activé et aucun accès direct accordé aux rôles navigateur `anon`/`authenticated`.
- Un chemin de création futur **uniquement service_role** est provisionné pour la future intégration d'un webhook authentifié à l'étape 83. La migration ne crée **aucune ligne** et n'accepte ni confirmation de paiement fournie par le navigateur, ni paiement LIVE.
- Fonction interne `app_private.member_has_active_premium()` : état fondé sur `auth.uid()`, email confirmé, attestation TEST, période en cours et absence de révocation, toujours calculés avec l'horloge PostgreSQL. Une période future, expirée ou révoquée ne donne aucun droit ; plusieurs attributions peuvent coexister sans s'effacer mutuellement.
- RPC `public.member_my_premium_status()`, accordée au seul rôle `authenticated`, qui retourne **uniquement son propre état** (active, none, expired, revoked, upcoming ou unverified), la formule et la date de fin. Aucun identifiant Stripe, autre compte ou ligne d'audit privée n'est communiqué.
- `Mon espace` : composant en lecture seule demandant une confirmation d'identité avant de consulter la RPC, avec état d'indisponibilité explicite, actualisation manuelle et garde anti-réponse périmée en cas de déconnexion ou changement de page. Un état client ne confère jamais Premium.
- Protection d'affichage en cas de date dépassée du point de vue du navigateur : cela peut **masquer** un badge devenu périmé, mais ne peut pas accorder un droit. L'arbitrage reste exclusivement serveur.

## Dépendances conservées pour la suite

Les fichiers de l'ancienne étape 54 (`award_vote_entitlements`) et de l'étape 55 (`premium_test_checkout_links`, webhook) restent **en attente** : ils ne sont pas déployés par l'étape 82. L'étape 83 devra intégrer exclusivement le webhook TEST vérifié avec la nouvelle table `premium_access_grants`, puis harmoniser les futurs contrôles Awards sur la même source, sans maintenir deux droits contradictoires. L'étape 84 couvrira remboursements, chargebacks et résilience des événements.

Le formulaire de comparaison publique conserve ses messages : souscription indisponible, Stripe LIVE désactivé, abonnement annuel de 12 mois sans reconduction. Le produit ne promet pas de facture ni de débit dans cette étape.

## Vérification et limites

Migration : `supabase/migrations/202610260019_premium_server_entitlements.sql`. Code `member-premium-status.mjs`, raccord `auth.mjs`, styles et tests ciblés `tests/step82-premium-server-rights.test.mjs`.

Des contrôles CI et une inspection Supabase en lecture seule du schéma et des privilèges sont requis après application. Les recettes multi-comptes, paiements simulés en staging et le cadre légal du Premium ne font pas partie de cette étape de développement. Aucun utilisateur, droit payant, paiement ou abonnement réel n'est créé.
