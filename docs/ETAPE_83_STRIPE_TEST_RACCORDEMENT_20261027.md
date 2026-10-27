# Étape 83 — Stripe TEST raccordé au modèle Premium serveur

**27 octobre 2026 · livraison du code, déploiement financier bloqué en l'absence de staging indépendant.**

## Audit de départ

Les Edge Functions `premium-stripe-test-checkout` et `premium-stripe-test-webhook` ainsi que les projections Stripe signées existaient (ancienne étape 55), mais l'ancienne migration `202610230004_stripe_test_billing_webhook.sql` attribuait encore les droits dans `app_private.award_vote_entitlements`, la table historique destinée aux Awards. **Ne pas appliquer cette ancienne migration seule pour activer Premium.**

L'étape 82 a ajouté la source unique et lisible `app_private.premium_access_grants` avec la RPC `public.member_my_premium_status()`, sans aucune autorisation par défaut. Étape 83 doit relier les événements de paiement TEST vérifiés **à cette source**, pas maintenir deux états contradictoires.

## Nouveau schéma de rapprochement : staging uniquement

Migration : `supabase/migrations/202610270001_step83_stripe_test_grants.sql`. Elle requiert l'étape 82 et remplace la fonction de traitement des événements de l'ancien prototype.

- `app_private.premium_test_checkout_links` : association immuable session Checkout TEST → `auth.users.id`, formule et price-id côté serveur, puis client et abonnement Stripe attestés.
- `app_private.premium_test_webhook_receipts` : événements consommés une fois, sans payload personnel ni informations de carte.
- `app_private.premium_test_grant_sources` : rattachement de chaque attribution à son propre Checkout pour des annulations ciblées.
- `public.billing_register_test_checkout()` : `service_role` uniquement ; inscrit la session après confirmation d'identité et de l'adresse du compte staging. Le navigateur ne transmet ni l'UUID du titulaire ni un price-id arbitraire.
- `public.billing_apply_verified_test_event()` : `service_role` uniquement ; appelé **après** validation Stripe de la signature et du contenu. Vérifie références, lien de prix, client et abonnement et traite chaque événement de façon idempotente.

Le groupe des trois tables privées est protégé par RLS et sans GRANT au navigateur. Les RPC de facturation ne sont pas exécutables par `anon` ou `authenticated`.

## Règles appliquées

| Cas TEST signé | Résultat serveur |
|---|---|
| Checkout mensuel 10 € terminé, sans facture payée | Lier l'abonnement ; **aucun Premium** |
| `invoice.paid` mensuelle 10 €, facture et période valides | Nouveau droit mensuel jusqu'à la fin de cette période |
| Checkout annuel 100 € réellement payé | Droit unique de 12 mois calendaires, sans renouvellement |
| `invoice.payment_failed` | Aucun droit supplémentaire, période déjà réglée préservée |
| `customer.subscription.deleted` | Révoquer les droits **de ce seul abonnement**, pas ceux d'un autre |
| Événement répété | Accusé de réception idempotent, pas de seconde attribution |
| Invoice reçue avant l'association Checkout | Erreur transactionnelle : le webhook redemandera la livraison |
| Session inconnue, prix/client inattendu, événement LIVE | Refus |
| Remboursement ou chargeback | Maintien en attente de réconciliation : **étape 84** ; jamais accepté comme événement inoffensif |

Les contrôles existants des Edge Functions restent inchangés : origine HTTPS staging exactement configurée, projet distinct du projet de production, clé restreinte `rk_test_`, montant exact 10 €/100 €, vérification de signature sur le corps brut, sans `service_role` dans le navigateur. Le `success_url` ne prouve pas le paiement.

## Déploiement bloqué tant que staging absent

Au dernier inventaire Supabase, **un seul projet est relié : `dahzewvbybujqhogumte` (Boissy-UJ)**. Le garde `verifiedStripeTestProjectOrigin` interdit explicitement cet identifiant. **La migration Stripe TEST 83 n'a pas été exécutée sur ce projet et les Edge Functions Stripe n'y ont pas été déployées.** Les paiements sur le site public restent désactivés.

Avant une vraie recette isolée : créer et approuver une instance staging distincte ; reprendre sa structure de base et la migration 82 ; ajouter uniquement la nouvelle migration de raccordement 83 ; publier les deux Edge Functions sur **ce staging** ; configurer les secrets TEST dans Supabase sans les commiter ; valider des comptes de test, les règles de sécurité et les callbacks Stripe signés. Ne pas copier des comptes ni des données de production.

**Point restant avant une éventuelle ouverture :** étape 84 (remboursements, litiges, événements hors ordre et reprise durable), puis étape 85 (gestion du cycle par les membres), conformité et homologation par le club. Aucun paiement réel n'est autorisé.
