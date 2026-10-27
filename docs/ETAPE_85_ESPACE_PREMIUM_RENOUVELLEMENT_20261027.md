# Étape 85 — Mon espace Premium et gestion du renouvellement TEST

**27 octobre 2026 — développement livré dans GitHub ; backend financier à déployer uniquement en staging isolé.**

## Fonctionnalités côté supporter

Dans **Mon espace → Mon Premium**, le membre authentifié consulte l'état du droit renvoyé par la fonction serveur `member_my_premium_status()` :

- Droit actif, formule mensuelle ou annuelle et échéance connue.
- Droit révoqué, expiré, futur, absent ou non vérifié, avec un message explicatif sans inventer un abonnement.
- Explication de l'offre annuelle **100 € / 12 mois sans reconduction automatique**.
- Explication du modèle mensuel **10 € / mois**, du renouvellement et des conditions d'arrêt en fin de période payée.
- Lien de contact vers la page **Contact** du club, sans adresse électronique fictive.
- Un contrôle d'actualisation et des états d'erreur respectant la session en cours.

Sur le site principal, la gestion des renouvellements **n'est pas activée**. Une configuration frontale `premium-test-member-config.mjs` bloquée par défaut (`enabled:false`) interdit d'afficher un bouton d'annulation actif ou d'appeler une Edge Function financière. L'activation nécessite un **autre projet Supabase**, une origine HTTPS de staging exacte et des comptes de test.

## Backend TEST préparé

Nouveau fichier `supabase/migrations/202610270003_step85_premium_renewal_management.sql`, dépendant **obligatoirement** des étapes 82, 83 et 84, sans exécution sur le projet principal.

- `app_private.premium_test_checkout_links` : état `cancel_at_period_end`, demande datée, date de fin confirmée. Contraintes d'intégrité et table privée RLS déjà en place.
- `public.member_my_premium_renewal()` : fonction authentifiée qui affiche seulement **son propre** état de renouvellement, son échéance mensuelle payée, l'échéance annuelle et la date d'arrêt programmée ; aucun identifiant Stripe n'est renvoyé.
- `public.billing_get_member_test_renewal_target(p_user_id)` : `service_role` seulement, sélectionne **un unique** abonnement mensuel actif, payé et lié à une Charge Stripe attestée. Plusieurs mensuels simultanés déclenchent un refus : contacter le club plutôt que risquer d'annuler le mauvais.
- `public.billing_confirm_member_test_cancellation(...)` : `service_role` seulement, écrit la programmation uniquement après vérification par Stripe, avec contrôle du propriétaire et d'une date d'arrêt dans les 45 jours.

Nouvelle fonction `supabase/functions/premium-stripe-test-cancel/index.ts`, avec `verify_jwt=true` :

1. Refuse un projet Supabase identique à la production, une origine différente, une requête mal formée, une clé non TEST ou un compte non vérifié.
2. Vérifie le JWT utilisateur avec Supabase Auth ; le navigateur ne fournit **aucun ID d'utilisateur, d'abonnement, de client Stripe ou de prix**.
3. Sélectionne l'abonnement TEST à l'aide de la RPC service-role ; vérifie auprès de Stripe le client, l'identifiant, le prix exact **10 € / mois**, un seul élément facturé, l'état `active` et la période courante sur **`subscription.items.data[0].current_period_end`** (le champ de période n'existe plus au niveau racine avec l'API Stripe moderne).
4. Demande `stripe.subscriptions.update(id,{cancel_at_period_end:true})` sans annuler immédiatement la période réglée ; confirme en base uniquement après réponse cohérente de Stripe.
5. Une requête répétée est idempotente ; un échec de la confirmation conserve un état d'erreur, jamais un succès inventé.

**Important** : l'état local est rafraîchi à la lecture ; si Stripe a validé une demande mais que l'enregistrement Supabase échoue, la même demande peut être répétée. Aucun statut de résiliation n'est promis à l'utilisateur avant confirmation du serveur.

## Contrôles

Tests `tests/step85-premium-member-management.test.mjs` : séparation staging/production, identité, privilèges SQL, formules, échéance mensuelle, annuel sans renouvellement, arrêt au terme de la période payée et absence d'identifiants financiers dans la page publique.

Les actions de l'étape 85 restent **TEST uniquement**, sous réserve d'un déploiement séparé et d'une recette avec de vrais événements simulés Stripe. Aucun abonnement n'est créé, aucun paiement LIVE n'est ouvert, aucune migration financière n'est appliquée au projet Supabase principal.

## À valider avant exploitation

Créer un projet staging approuvé et isolé, appliquer les migrations 82→85 dans l'ordre, configurer les secrets TEST **sur le serveur uniquement**, publier les trois fonctions Stripe TEST, autoriser explicitement l'interface staging et vérifier avec des comptes de test : un mensuel actif, un annuel seul, un annuel + mensuel, un mensuel déjà programmé, un doublon d'abonnement, une annulation Stripe réussie et un échec de synchronisation DB.

**La résiliation de renouvellement n'est pas un remboursement.** Les droits payés restent soumis aux règles de validité et de révocation de l'étape 84. Les conditions commerciales et légales doivent être validées par le club avant une ouverture réelle.
