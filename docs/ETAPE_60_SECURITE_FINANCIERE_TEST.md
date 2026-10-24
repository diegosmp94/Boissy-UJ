# Étape 60 — Sécurité Premium, finances et Stripe TEST (lot A)

**24 octobre 2026.** Mise à jour **uniquement du code de test**. Cette étape ne crée pas de projet Supabase, ne déploie aucune fonction financière, ne déclenche aucun paiement et n'active ni don ni abonnement.

## Audit avant modification

- Le projet Supabase de production Boissy-UJ est le **seul** projet accessible dans son organisation.
- Il ne contient **aucune Edge Function**, aucune table privée de facturation TEST ni migration Premium/Awards des étapes 54–55.
- Le site public Premium décrit **10 € par mois** ou **100 € pour une période non renouvelée automatiquement de 12 mois**. Il ne comporte aucune fonction de paiement activée.
- Le code de webhook Stripe TEST traitait cinq types d'événements. Les événements de remboursements et litiges n'étaient pas encore réconciliés avec des droits individuels ; une réponse 200 « ignored » aurait perdu le signal.

## Correctifs développés

### Montants exacts

Les sessions TEST et les factures payées sont désormais refusées si les montants sont différents des prix prévus par le club : **1 000 centimes pour un mois**, **10 000 centimes pour l'achat unique annuel**, devise **EUR**. Les remboursements partiels, remises et proratisations ne sont **pas encore pris en charge** comme source automatique d'un accès Premium. La validation côté serveur ne se contente plus d'un montant simplement positif.

### Sécurité des clés et des destinations

Les deux fonctions serveur exigent le paramètre **BOISSY_STAGING_PROJECT_REF** et vérifient que SUPABASE_URL est **exactement** la racine HTTPS de ce projet de test. Tout projet production, domaine tiers, port explicite, chemin, requête, fragment ou URL avec identifiants est rejeté **avant** tout appel contenant une clé serveur. Les acquittements d'activation déjà présents et les clés **Stripe TEST seulement** restent obligatoires.

### Traitement des remboursements et litiges

Le module de classification reconnaît les événements de remboursement et de contestation suivants, uniquement **après signature Stripe valide** : refund.created / refund.updated, charge.refunded / charge.refund.updated et les événements charge.dispute.* concernés.

Ces signaux sont classés **financial_hold**, et le webhook TEST répond **503 reversal_needs_reconciliation** : aucun événement de ce type n'est déclaré traité par erreur. Cette réponse est volontairement **temporaire et réessayable**, et n'est **pas** un traitement complet. **Elle ne révoque pas les droits Premium** : une réconciliation fiable entre charge/refund/PaymentIntent, facture ou Checkout initial et l'utilisateur est indispensable. Stripe limite ses tentatives de réémission ; un futur traitement durable devra sauvegarder et traiter ces incidents, et prévoir un contrôle de rattrapage.

Le code ne doit donc **pas être déployé comme système de paiement opérationnel**, même en environnement de test partagé, avant d'avoir intégré le traitement vérifié des reversals. Cette étape prépare des garde-fous, pas l'encaissement.

### Tests

Les tests automatisés couvrent : remboursement/litige non ignoré, rejet du mode LIVE, objet d'événement malformé, montants faux / partiels, devises interdites, rejet des URLs usurpées, interdiction de clés LIVE, absence de paiement depuis la page publique.

## À faire pour terminer l'étape 60 et activer quoi que ce soit

1. Créer un vrai **environnement de staging isolé** ; le quota Free du compte empêchait sa création lors de l'étape 58.
2. Mettre en place un traitement fiable des remboursements, contestations, captures, réessais et retraits de droits pour chaque type de plan, avec rapprochement et journal privé. Tester au minimum les situations hors ordre, doublons, paiement partiel, remboursement total/partiel, contestation perdue ou gagnée.
3. Exécuter les migrations Premium et facturation seulement sur staging, tester les conditions RLS et les deux authentifications ; contrôler un webhook Stripe réellement signé avec des données TEST.
4. Documenter les cas d'annulation et de réclamation ; homologuer les aspects juridiques, dons, reçus, fiscalité et obligations du responsable de l'association avant d'envisager de véritables offres.
5. Conserver le site public **sans checkout, paiement LIVE, lien de donation ou débit** d'ici là.

Références techniques : https://docs.stripe.com/api/events/types ; https://docs.stripe.com/api/refunds ; https://supabase.com/docs/guides/functions ; https://supabase.com/changelog?types=breaking-change

**Statut : tests et garde-fous préparés. Aucune recette bancaire réelle, aucun Stripe TEST déployé et aucun flux monétaire disponible.**
