# Boissy UJ — Recette backend du 26 octobre 2026

## Observations réelles (base de production)

Contrôles en lecture seule du projet Supabase `dahzewvbybujqhogumte` :

- **12 / 12 PASS** : cinq équipes, index d'unicité des numéros, déclencheur actif de libération, RLS sur tables privées, RPC indisponibles aux anonymes, permissions authentifiées attendues, `search_path` vide des fonctions privilégiées, verrou transactionnel avant affiliation, revalidation des droits éducateur et absence de numéros affectés à une affiliation inactive.
- **2 / 2 BLOCKED** : comportement de sept comptes distincts et simulation réelle de deux transactions concurrentes. Ce sont des homologations métier et sécurité **non exécutées**.
- La base contient actuellement **0 affiliation joueur active, 0 éducateur affecté, 0 numéro attribué et 0 profil public approuvé**. Aucun compte fictif n'a été créé pour contourner ce manque.

Commande de vérification depuis SQL Editor : contenu exact de `scripts/backend-roster-production-preflight.sql`. Aucune écriture ni lecture de nom, email ou identité personnelle.

## Pourquoi il reste deux cases bloquées

Le dépôt contient `scripts/real-permissions-smoke.mjs`, dont la sécurité exige un environnement local Docker **non lié à la production** ou un projet Supabase de test séparé, sept comptes distincts et deux convocations de test isolées. Les vérifications de rôles, RLS, MFA AAL2, isolation entre équipes et concurrence sur un numéro ne sont pas démontrées par le code seul. Les exécuter sur les comptes du club serait risqué.

## Suivi de validation

- [x] Migration déclencheur de libération installée et visible.
- [x] Index d'unicité et verrouillage des deux fonctions vérifiés en production.
- [x] Fonction d'écriture protégée par nouvelle vérification de la délégation éducateur.
- [x] Vérifications en lecture seule disponibles dans le dépôt, testées contre le vrai schéma.
- [ ] Recette de sept comptes isolés MFA, RLS et séparation de profils.
- [ ] Tests transactionnels simultanés (départ joueur, changement numéro, numéro déjà attribué) en base isolée.
- [ ] Accord du club pour la publication de vrais effectifs et portraits, non présumé.

**Statut : socle backend technique vérifié. Validation métier complète en attente de la recette isolée.**
