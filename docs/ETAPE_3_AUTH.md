# Étape 3 — comptes et rôles Boissy-UJ

**Périmètre de cette migration :** fondations de sécurité, pas encore un formulaire de connexion.

## Tables
- `public.profiles` : ID Auth Supabase, nom d'affichage, dates. Aucune donnée sensible relative à des mineurs.
- `public.user_roles` : rôles cumulables `supporter`, `player`, `coach`, `admin`. **Premium n'est pas un rôle** : il viendra d'un droit d'accès attribué uniquement après confirmation serveur du paiement.
- Toutes les inscriptions reçoivent seulement le rôle `supporter`. La valeur de `raw_user_meta_data` ne détermine jamais les droits.

## Principes de sécurité
- RLS activée sur chaque table.
- L'utilisateur lit et modifie son profil uniquement ; les admins peuvent superviser.
- Un utilisateur peut lire ses rôles ; il ne peut pas les ajouter, les modifier ou les retirer.
- L'attribution des droits supplémentaires est réservée à une action administrative **serveur vérifiée**, à développer dans un lot ultérieur.
- Pas d'admin initial créé automatiquement : la procédure sécurisée d'amorçage reste à documenter/tester.
- Pas de mot de passe enregistré dans les tables publiques.

## Critères de sortie de l'étape 3
1. Migration appliquée et vérifiée sur Supabase.
2. Tests RLS réalisés avec deux comptes d'essai distincts et un administrateur d'essai : lecture du profil propre autorisée, lecture d'autrui interdite, élévation de rôle refusée.
3. Authentification : inscription, connexion, confirmation mail, récupération, déconnexion.
4. État de session fiable et protection des pages privées.
5. MFA pour les comptes administrateurs.
6. Audit des opérations d'administration.

La présence d'une migration et des tests de structure ne valide **pas** à elle seule cette étape.
