# Étape 55 — Stripe TEST et webhook signé (code préparé)

**23 octobre 2026 — développement en branche, aucune mise en production ni paiement effectué.**

Ce lot prépare le traitement serveur de la facturation et des droits Premium, en continuité de l'étape 54. Il n'attribue pas d'abonnement depuis le navigateur, ne déploie aucune fonction Supabase et n'active pas le paiement sur le site public.

## Développé

| Composant | Fonction | Garde principale |
|---|---|---|
| **premium-stripe-test-checkout/index.ts** | Créer une session Stripe Checkout TEST après authentification Supabase staging, choisir mensuel ou annuel et rattacher au membre | JWT confirmé, origine HTTPS staging, restriction TEST, prix serveur de 10 €/mois ou 100 € unique |
| **premium-stripe-test-webhook/index.ts** | Recevoir les événements Stripe, vérifier la signature officielle sur le corps brut et enregistrer par RPC | Signature, secret endpoint, aucun LIVE, aucun log de données sensibles, erreurs 503 retry |
| **_shared/stripe-test-events.mjs** | Normaliser événements de Checkout, facture et abonnement | Prix et devise, client, ligne unique, période valide, mode TEST |
| **202610230004_stripe_test_billing_webhook.sql** | Tables privées de liaison Checkout/membre et d'idempotence ; rapprochement financier avec la table Premium de l'étape 54 | RPC service_role uniquement ; RLS et révocations ; droits uniquement après paiement signé |
| **supabase/config.toml** | Configuration d'authentification des deux Edge Functions | Webhook sans JWT mais signature Stripe obligatoire ; Checkout JWT obligatoire |
| **tests/stripe-test-billing.test.mjs** | Tests unitaires des événements acceptés, des prix et du contrat de sécurité | Scénarios positifs et négatifs, sans données Stripe réelles |

## Flux prévu, avec refus par défaut

1. Une personne s'authentifie sur **la préproduction** ; le serveur vérifie son compte Supabase et son email confirmé.
2. Le serveur lit la formule demandée et vérifie que le Price Stripe TEST correspond à **10 € / mois** en abonnement ou **100 € pour 12 mois** en paiement unique sans renouvellement.
3. Stripe crée une Checkout Session **en TEST seulement**. Avant de renvoyer son URL au client, le serveur inscrit une liaison privée immuable Checkout → identifiant Supabase ; l'utilisateur ne peut pas choisir l'identifiant d'un tiers.
4. Après une session Checkout complète, le **webhook signé** établit l'identité de la session et du client. Un abonnement mensuel ne donne **aucun avantage** sur la seule création de session.
5. La preuve **invoice.paid**, rattachée à l'abonnement TEST reconnu, active une échéance correspondant à la période facturée. Un paiement annuel Checkout payé active **12 mois calendaires** seulement. Les événements rejoués n'entraînent pas de double attribution.
6. En cas de suppression de l'abonnement, **seul le droit issu de ce même abonnement** est révoqué, après comparaison de sa référence ; un autre achat Premium plus récent ne doit pas être affecté. Une simple facture échouée ne retire pas prématurément une période déjà payée ; le droit s'éteint à son échéance. Les factures anciennes ne réduisent pas une période payée plus récente.

## Sécurité

Les tables de rapprochement, les événements déjà traités et les droits Premium restent dans **app_private** avec RLS et sans accès direct au navigateur. Les seules fonctions SQL de rapprochement sont accordées au **service_role**, utilisées uniquement dans l'Edge Function. Les appels issus de la page de retour du paiement, du rôle Supporter ou des métadonnées renseignées par un visiteur **ne peuvent pas accorder Premium**.

Il faut fournir uniquement via le coffre de secrets **du projet Supabase de staging** : STRIPE_TEST_RESTRICTED_KEY (clé restreinte TEST), STRIPE_TEST_WEBHOOK_SECRET (signature dédiée), STRIPE_TEST_PRICE_MONTHLY, STRIPE_TEST_PRICE_ANNUAL, BOISSY_STAGING_ORIGIN (origine HTTPS de staging), les acquittements BOISSY_TEST_CHECKOUT_ACK et BOISSY_TEST_WEBHOOK_ACK, ainsi que les paramètres Supabase injectés aux Edge Functions. Aucun secret ne doit être commité, envoyé dans le chat ou exposé aux pages publiques.

## Bloqueurs avant validation

- Seul un projet Supabase de production est connecté actuellement. **Aucune migration ni Edge Function de ce lot n'a été déployée sur ce projet.**
- Créer ou autoriser un **projet staging isolé** et un **Stripe sandbox**. Appliquer la migration Awards de l'étape 54 puis celle-ci sur staging.
- Tester la signature invalide, le Price inconnu, les factures non payées, le client étranger, les doublons et les événements hors ordre ; vérifier la reprise HTTP 503, les périodes et les révocations directement dans la base.
- Finaliser le traitement des remboursements/chargebacks de paiements annuels, de la suspension Stripe, des échecs de synchronisation, du support et des décisions de publication avant tout mode LIVE.
- Valider juridiquement l'association, sa politique de confidentialité et les abonnements. Examiner les obligations fiscales et **Stripe Tax** avant toute transaction réelle ; la taxation automatique n'est pas activée ici.
- Confirmer ensuite la recette réelle des votes Awards à deux comptes avec droits Premium TEST effectivement délivrés par le webhook signé.

**Bilan : infrastructure de Checkout et webhook en code et tests de simulation, mais aucune souscription activée ni recette Stripe authentifiée réalisée.**
