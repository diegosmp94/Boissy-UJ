# Étape 90 — Billetterie payante Stripe TEST et tarifs Premium

**27 octobre 2026 — développement en préproduction uniquement, sans paiement LIVE.**

## Ce qui est développé

- **Calcul fiable des tarifs** : la RPC `app_private.ticket_test_price()` décide du tarif public, Premium réduit ou Premium gratuit (0 €) depuis les données officielles de l'événement et un Premium encore valable avec preuve de Charge Stripe TEST. Jamais d'identité ou de réduction choisie par le navigateur.
- **Événements** : réservations gratuites de l'étape 88 intactes, payantes indiquées dans le catalogue privé des membres éligibles (y compris les événements Premium réservés). Les réservations ne peuvent être ouvertes qu'avec le verrou staging activé, par un administrateur MFA AAL2.
- **Places** : un Checkout TEST créé côté serveur réserve temporairement une place pour **35 minutes**, avec une session Stripe TEST expirant au bout de **30 minutes**. La capacité totale et celle du créneau sont contrôlées en transaction avec verrou `FOR UPDATE` du parent. Les utilisateurs ne peuvent pas ouvrir un deuxième Checkout lorsqu'une session active ou un billet payé existe.
- **Paiement** : la fonction `event-ticket-stripe-test-checkout` refuse les clés LIVE, les comptes non confirmés, les origines autres que le staging HTTPS exact, les corps contenant autre chose qu'un ID d'événement, et tout Checkout sans liaison en base. L'ID de l'événement et le tarif sont calculés côté serveur.
- **Webhook** : `event-ticket-stripe-test-webhook` vérifie la signature officielle du corps brut. Elle récupère ensuite l'unique ligne de produit/prix Stripe TEST, le PaymentIntent `succeeded`, la Charge réellement payée, la devise EUR, le client et le montant exact. La RPC privée `billing_apply_verified_test_ticket_payment` confronte la preuve au Checkout enregistré et émet le billet uniquement si le droit et la place restent valides.
- **Billet** : les billets payants sont émis dans le registre privé de billets déjà utilisé aux étapes 88 et 89, avec une référence d'origine `test_paid` et un Checkout unique. **Le secret QR n'est jamais renvoyé par le webhook** : le titulaire peut le générer/renouveler dans « Mes billets » après confirmation du serveur.
- **Premium gratuit** : pour un prix Premium de 0 €, aucune session Stripe n'est créée. La RPC membre émet un billet `premium_comp` seulement après confirmation serveur du droit Premium et des jauges. Le scanner vérifie de nouveau le Premium lors de l'entrée.
- **Scan d'entrée** : une seule RPC MFA AAL2 valide, avec verrou du billet, aussi bien les billets gratuits que les payants ou Premium gratuits ; un billet TEST remboursé ou dépourvu de preuve valide ne permet pas d'entrer.
- **Remboursements/litiges** : la file privée `ticket_test_reversal_inbox` garde l'événement signé même arrivé avant la confirmation de paiement. L'annulation de la Charge correspondante ne révoque que le billet lié. Une entrée déjà utilisée reste historique, pas une autorisation supplémentaire.
- **Paiement confirmé sans billet** : si la place temporaire a expiré, le billet est **refusé** et le registre indique `paid_unfulfilled`. Le club doit alors rapprocher le paiement et traiter la suite en mode TEST. Aucune fausse confirmation de réservation.
- **Mon espace** : les offres et tarifs sont lus depuis Supabase, un QR personnel est produit localement, et les commandes de Checkout TEST n'apparaissent que sur un **autre projet Supabase staging**, explicitement validé. Les tickets payants ne présentent pas de commande d'annulation gratuite qui court-circuiterait le registre de paiement.

## Fichiers

- `supabase/migrations/202610270009_step90_stripe_test_event_tickets.sql` : base, tarification Premium, comptes de paiement et reversals privés, jauges, émission, visibilité par titulaire et adaptation du scanner.
- `supabase/functions/event-ticket-stripe-test-checkout/index.ts`
- `supabase/functions/event-ticket-stripe-test-webhook/index.ts`
- `supabase/functions/_shared/stripe-test-ticket-verification.mjs`
- `member-paid-ticket-test.mjs`, `member-free-tickets.mjs`, `auth.mjs`, `premium-front.css`, `supabase/config.toml`
- `tests/step90-stripe-test-event-ticketing.test.mjs`

## Validation GitHub et état Supabase constaté — 27 octobre 2026

- **PR [#156](https://github.com/diegosmp94/Boissy-UJ/pull/156) fusionnée dans main**, commit `7d840b0c5231b9319d58d2bc49960066fa435019`.
- **909 tests automatisés réussis** (`# pass 909`, `# fail 0`) ; les deux workflows GitHub Actions se sont terminés avec succès, avec syntaxe et navigation mobile Chromium.
- Vérification PostgreSQL **sans installation** : la partie tarif/commandes/émission et la partie adaptation du scanner ont été exécutées séparément dans des transactions avec tables temporaires de dépendance et `ROLLBACK` vérifié. L'assemblage complet est réservé à une vraie instance staging en raison des limites de taille de l'interface de vérification.
- Contrôle après fusion du Supabase principal `dahzewvbybujqhogumte` : **1 événement, 0 ouvert à la réservation**, aucune table de commande `ticket_test_orders` / `ticket_test_reversal_inbox`, aucun registre de billetterie `free_ticketing_gate`, aucune fonction d'émission payante et aucun scanner opérationnel installé. Aucun débit Stripe activé.
- **L'étape est développée et fusionnée côté code, mais non homologuée en conditions Stripe TEST et multi-comptes.**

## Déploiement et contrôles

**Aucune des migrations Stripe financières, aucune Edge Function TEST et aucun encaissement LIVE n'ont été déployés sur le projet principal** `dahzewvbybujqhogumte`. L'interface commerciale y reste désactivée par défaut. La migration stage90 dépend des tables spécifiques des étapes 83, 84, 88 et 89 : seul un staging isolé correctement préparé peut l'exécuter.

L'analyse SQL a été testée séparément en deux transactions temporaires avec tables de dépendances minimales et **ROLLBACK** explicites : partie financière et adaptation du scanner ont validé la syntaxe. Une exécution combinée supérieure à la limite de taille de l'outil n'a pas été tenue pour une validation d'intégration.

La recette staging doit vérifier : compte sans Premium, Premium valide puis révoqué, prix réduit, Premium à 0 €, dernier billet simultané, Checkout expiré, webhook reçu avant enregistrement, événement payé puis remboursé, double scan, QR régénéré, paiement confirmé sans place et vérification du journal après coupure réseau.

Les tests unitaires automatisés ne constituent **pas** une preuve qu'une transaction Stripe ou un scan réel fonctionne. Il faut des comptes TEST, des callbacks Stripe signés, deux contrôleurs MFA et un projet Supabase indépendant avant toute ouverture. Les tarifs et capacités doivent être renseignés par le club ; aucune donnée fictive n'a été créée. Les billets payants LIVE et remboursements réels restent hors périmètre.
