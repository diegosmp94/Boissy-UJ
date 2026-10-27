# Étape 86 — Campagnes de dons, fonds général et rapprochement Stripe TEST

**27 octobre 2026 · catalogue public indépendant des paiements · développement du flux TEST isolé**

## Déploiement vérifié sur le Supabase principal (27/10/2026)

Migration **86A appliquée avec succès** dans `dahzewvbybujqhogumte`, nom d'historique `step86_public_donation_campaigns_20261027`. Contrôle SQL : table et journal privé présents, RLS actif, une politique publique SELECT limitée aux campagnes publiées, INSERT anonyme=false, UPDATE authentifié direct=false, accès anonyme au journal=false, exécution des RPC admin par anon=false. **0 campagne et 0 entrée d'audit au déploiement ; aucun contenu inventé.** Les tables financières `donation_test_checkouts` et `donation_test_receipts` sont absentes de la production.

Le linter signale l'absence de politique sur le journal privé (`INFO`, volontairement inaccessible par API) et les fonctions `SECURITY DEFINER` accessibles aux membres connectés (`WARN`, elles vérifient strictement le rôle admin et MFA AAL2 à chaque appel). Aucune ouverture financière. Les vérifications CI de la PR #148 sont réussies.

## 86A — Catalogue déployable sans activité financière

`supabase/migrations/202610270004_step86_public_donation_campaigns.sql` crée :
- `public.donation_campaigns` : fonds général ou projet, titre, description, objectif facultatif, période, statut brouillon/ouvert/clôturé et publication explicite ;
- lecture publique **uniquement des campagnes publiées et ouvertes/clôturées**, sous RLS ; pas d'insertion, mise à jour ou suppression par les navigateurs ;
- gestion par `admin_list_donation_campaigns` et `admin_save_donation_campaign`, accessibles avec connexion administrateur et MFA AAL2 vérifiés dans SQL ;
- contrôle des dates et montants de l'objectif, verrou optimiste `updated_at`, confirmation de publication, journal privé `app_private.donation_campaign_audit`.

`#/soutenir` charge seulement les campagnes officielles disponibles, sans données imaginées. Le module **Dons et campagnes** est visible dans le centre administrateur protégé. Les cartes publiques détaillent les objectifs annoncés, pas des recettes fictives. **Aucun bouton de paiement.** Aucune campagne n'est créée à partir de données supposées du club.

## 86B — Registre des dons Stripe TEST, non déployé

`supabase/migrations/202610270005_step86_stripe_test_donation_ledger.sql` :
- `app_private.donation_test_checkouts` : session TEST déjà créée sur serveur, utilisateur staging à e-mail confirmé, campagne ouverte réelle, montant EUR entier et fréquence `once`/`monthly` ;
- `app_private.donation_test_receipts` : contribution TEST attribuée à un Checkout enregistré, facture mensuelle ou session ponctuelle, PaymentIntent et Charge officiellement vérifiés, unicité par source et charge, état `settled`/`reversed` ;
- `app_private.donation_test_reversal_inbox` : conservation des références d'événements retournés avant leur preuve de débit ; rapprochement ciblé ultérieur ;
- `public.admin_test_donation_campaign_totals()` : totaux d'essai privés, admin MFA uniquement, **jamais publiés sur le site comme fonds réellement collectés**.

Les trois tables restent privées sous RLS. Les fonctions de paiement n'ont `EXECUTE` qu'au rôle serveur `service_role`. Le navigateur ne peut ni écrire un don ni interroger l'identité ou les montants individuels des donateurs.

Fonctions dédiées **uniquement au staging séparé** :
- `donation-stripe-test-checkout` : JWT de compte staging vérifié, clé restreinte `rk_test_`, origine HTTPS exacte, identifiant du produit TEST en secret, campagne approuvée contrôlée par SQL, montant 1 € à 1 000 € en centimes, frais et paiements non activés publiquement, aucune référence Stripe arbitraire soumise par le client. Paiement unique ou souscription mensuelle simulée.
- `donation-stripe-test-webhook` : `verify_jwt=false` avec signature Stripe validée sur le corps brut ; événements TEST `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, remboursement et litige ; prix/ligne, montant EUR, client, Invoice Payment, PaymentIntent réussi et Charge réellement payée vérifiés ; création de l'entrée privée uniquement après rapprochement. Un checkout mensuel **n'est pas une preuve de paiement** : seule une facture payée est rapprochée.
- Les remboursements ou litiges d'une Charge identifiée passent `reversed`, indépendamment des autres dons. Un remboursement annoncé mais non effectif ne révoque pas prématurément. Les événements impossibles à relier de façon sûre demandent une nouvelle livraison/une revue.

**Aucun reçu fiscal automatique**, aucune déduction fiscale, aucun avantage Premium ou vote rattaché à un don TEST, aucun transfert vers un compte bancaire. Les conditions associatives/fiscales devront être approuvées par les personnes responsables.

## Séparation main / TEST

Un seul projet Supabase est actuellement connecté : `dahzewvbybujqhogumte`, projet principal. **Appliquer 86A seul** est sûr après validation des tests : aucun état financier. **Ne jamais appliquer 86B sur le projet principal et ne jamais y déployer les Edge Functions Stripe.** Toute mise en service du flux TEST nécessite un projet Supabase distinct, copie de schéma sans données personnelles, prix/produit Stripe TEST, secret de signature TEST et tests d'intégration hors production.

Secrets staging obligatoires : `STRIPE_TEST_RESTRICTED_KEY`, `STRIPE_TEST_DONATION_PRODUCT_ID`, `STRIPE_TEST_DONATION_WEBHOOK_SECRET`, `BOISSY_STAGING_ORIGIN`, `BOISSY_STAGING_PROJECT_REF`, `BOISSY_TEST_DONATION_ACK`, `BOISSY_TEST_DONATION_WEBHOOK_ACK` et secrets Supabase injectés côté serveur. Aucune clé serveur dans GitHub Pages.

Tests : `tests/step86-donation-campaigns.test.mjs`, tests globaux GitHub Actions, et vérifications SQL des droits/RLS. Les validations de vraies transactions simulées Stripe doivent se faire plus tard **dans le staging isolé** et ne sont pas couvertes par les tests unitaires.

**Prochaine étape 87** : règles de jauge, réservations et priorités d'événements indépendantes des contenus éditoriaux.
