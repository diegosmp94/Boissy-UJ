# Étape 84 — Remboursements, litiges et reprise durable Stripe TEST

**27 octobre 2026 — code livré en branche ; uniquement pour staging séparé et approuvé.**

## Audit préalable
- Le site public est hébergé sur GitHub Pages et n'active aucun paiement.
- La migration 82 est appliquée sur la seule base connectée Boissy-UJ, mais les migrations 83/84 et les Edge Functions Stripe restent volontairement **non déployées** en l'absence de staging indépendant.
- La migration 83 sait identifier les droits à partir de Checkout et de `invoice.paid`, mais elle ne lie pas encore chaque attribution à une `charge` Stripe et maintenait les remboursements/litiges en réponse HTTP 503 sans enregistrement durable.

## Réalisation

1. **Preuve de paiement stricte** : `premium_test_charge_proofs` lie un droit (référence unique) à un PaymentIntent et une Charge TEST uniques. Le webhook effectue un contrôle Stripe supplémentaire de la facture payée (un seul Invoice Payment), du PaymentIntent réussi, du débit réellement payé, du montant exact (10 € mensuel / 100 € annuel), de la devise et du client. Une preuve facturée n'est pas déduite d'une URL de succès ou des métadonnées du navigateur.
2. **Autorisation à deux phases** : la source `premium_access_grants` peut être enregistrée après l'événement payé, mais `member_has_active_premium()` et `member_my_premium_status()` ne reconnaissent l'accès **qu'après** rattachement de la preuve du débit. Si la seconde requête échoue, un nouvel essai du webhook ne redouble pas le droit et peut terminer le rapprochement. Aucun accès transitoire n'est délivré.
3. **Boîte de réception durable** : `premium_test_reversal_inbox` conserve uniquement les identifiants techniques du webhook signé, du débit, du client et son horodatage. Les remboursements et litiges identifiables sont validés contre la Charge Stripe TEST, stockés en transaction côté serveur puis acquittés HTTP 200 **uniquement si l'écriture a réussi**. Aucun payload financier ou secret n'est journalisé.
4. **Réception dans le désordre** : si la révocation arrive avant la preuve de paiement, elle reste `pending` ; l'insertion ultérieure du lien de paiement la rapproche et révoque **ce droit précis** dans la même transaction. Un événement identique est idempotent. Une charge ayant déjà `refunded`, `amount_refunded > 0` ou `disputed` ne donne jamais l'accès après rattachement.
5. **Suspension ciblée irréversible automatiquement** : en cas de remboursement même partiel, litige ou changement d'état critique, seule la source rattachée à cette charge est révoquée. Un autre abonnement ou un paiement annuel indépendant reste intact. Une dispute résolue ou un remboursement échoué ne réactive **jamais automatiquement** un droit sans revue autorisée.
6. **Suivi d'exploitation** : `billing_test_reversal_backlog()` accessible au seul `service_role` retourne le nombre d'événements en attente, le plus ancien et le total rapproché ; aucun identifiant utilisateur ou Stripe n'est exposé.

## Fichiers
- `supabase/migrations/202610270002_step84_stripe_test_reversals.sql`
- `supabase/functions/_shared/stripe-test-reversals.mjs`
- `supabase/functions/_shared/stripe-test-financial-guards.mjs`
- `supabase/functions/premium-stripe-test-webhook/index.ts`
- `tests/step84-stripe-test-reversal-recovery.test.mjs`
- `tests/step60-financial-guards.test.mjs` (assertion de sécurité actualisée)

## Contrôles et limites

Le code conserve `verify_jwt=false` pour le webhook **uniquement parce que la signature Stripe est obligatoirement vérifiée sur les octets bruts**, et `verify_jwt=true` pour Checkout. Les 3 nouvelles fonctions financières SQL sont exécutables par `service_role` seulement. Tables privées avec RLS sans accès `anon` / `authenticated`.

Une erreur de réseau avant insertion de l'événement reste **503 réessayable** : contrairement à une inversion non liée, elle n'est jamais acquittée sans stockage. Une inversion ne portant aucune référence permettant de retrouver une Charge Stripe (ni Charge ni PaymentIntent) ne peut pas être attribuée de manière sûre et doit être contrôlée à part sur la plateforme Stripe. Les événements reçus et durablement stockés mais non liés à un paiement sont visibles par le compteur `pending` : **une alerte ou procédure de revue d'exploitation est indispensable** si des liens de paiement ne sont jamais établis. Le mécanisme garantit le rattrapage automatique des inversions antérieures à une preuve qui arrive plus tard ; il ne réconcilie pas automatiquement des paiements tiers inconnus.

**Statut de déploiement** : pas de staging connecté, aucun secret Stripe, fonction financière, ni migration 83/84 installé sur le projet principal. Recette isolée avec comptes et paiements **fictifs** toujours requise avant homologation. Ne pas activer le débit LIVE.

## Sources techniques contrôlées
- Stripe : [charge et PaymentIntent](https://docs.stripe.com/api/charges/object), [Checkout Session](https://docs.stripe.com/api/checkout/sessions/object), [Invoice Payments](https://docs.stripe.com/api/invoice-payment), [événements de litige et de remboursement](https://docs.stripe.com/api/events/types).
- Supabase : [MFA et politiques d'accès](https://supabase.com/docs/guides/auth/auth-mfa), [sécurisation des API](https://supabase.com/docs/guides/api/securing-your-api).
