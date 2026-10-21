# Étape 3 — comptes et rôles Boissy-UJ

**Avancement : fondation DB + interface intégrées sur la branche. Pas encore prêt pour production.**

## Réalisé et vérifié
- Migration `boissy_uj_auth_foundation_20261021` appliquée à Supabase : `public.profiles` et `public.user_roles`.
- Tables RLS activées. Un utilisateur ne peut pas écrire dans `user_roles` via le client.
- Trigger d'inscription accordant uniquement le rôle `supporter` ; `player`, `coach` et `admin` nécessitent une attribution privilégiée côté serveur.
- Deuxième migration `boissy_uj_admin_mfa_gate_20261021` appliquée : les accès administratifs à travers les politiques nécessitent **le rôle admin ET un JWT de niveau AAL2**.
- Page « Mon espace » intégrée au routeur : inscription, connexion, déconnexion, demande de récupération et changement de mot de passe.
- Utilisation exclusive de la clé **publishable** Supabase. Aucune clé privée ni donnée de carte dans le navigateur.
- Rôles lus après authentification et rendus avec `textContent` ; pas d'élévation depuis le navigateur.
- **19 tests GitHub sur 19 réussis** lors du dernier cycle de développement, et deux workflows verts.
- Base encore vide : **aucun utilisateur, aucun rôle attribué manuellement, aucun paiement**.

## Limitations restantes importantes
1. L'intégration browser utilise temporairement l'ESM CDN de Supabase JS ; avant publication, fixer la version, contrôler le chargement et définir la politique CSP.
2. Tester les parcours avec deux **comptes d'essai autorisés** : confirmation e-mail, connexion, session persistante, récupération, déconnexion, réactivation et erreurs.
3. Configurer les **URL de redirection autorisées**, l'URL officielle et la délivrabilité e-mail dans Supabase.
4. Tester les RLS de façon dynamique avec deux identités et les accès non autorisés : profil d'autrui inaccessible, rôles impossibles à modifier.
5. Concevoir l'attribution sécurisée des rôles supplémentaires, l'amorçage administrateur et la révocation auditée.
6. Prévoir l'inscription / vérification des facteurs MFA pour administrateurs, et bloquer l'interface Control Center tant que AAL2 n'est pas atteint.
7. Achever l'information RGPD et les règles de protection des mineurs avant toute ouverture publique.
8. Vérifier les comportements sur Safari iPhone, Android et desktop ; pas encore de recette navigateur exhaustive.

## Conditions de sortie
L'étape 3 sera terminée uniquement après les tests en conditions réelles ci-dessus. La matrice de recette pondérée reste à **0 point certifié pour la mise en production** tant que le flux complet n'est pas homologué.

## Séparation des sujets
Le statut **Premium** n'est pas un rôle modifiable par l'utilisateur. Il dépendra ultérieurement des événements serveur Stripe vérifiés.
Aucun paiement LIVE n'est activé. `main` est inchangée.
