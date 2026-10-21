# Étape 27 — Back-office réel, MFA et retrait des démonstrations publiques

## Nouvel accès
Le panneau **`#/control-center`** n'est plus une simulation publique. Il ne charge **aucune donnée administrative** si la session ne passe pas successivement :
1. `supabase.auth.getUser()` (identité réellement authentifiée) ;
2. `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` au niveau **AAL2** ;
3. lecture sécurisée du rôle `admin` dans `user_roles`.
Chaque changement de module recontrôle ces conditions. Chaque RPC critique les revalide **côté base** avec `auth.uid()` et `app_private.is_admin()`. Un simple rôle Supporter ne donne rien.

### Activation du MFA
Sur `#/mon-espace`, un administrateur AAL1 se voit proposer :
- l'enregistrement d'un second facteur **TOTP** via application d'authentification (QR code + saisie manuelle facultative) ;
- `mfa.challenge` puis `mfa.verify` avec code à six chiffres ;
- le lien vers le vrai panneau lorsque Supabase confirme AAL2.
Aucun secret MFA n'est écrit en stockage du navigateur par ce composant. Un facteur déjà vérifié demande seulement un code. Aucun numéro de téléphone obligatoire.

## Modules fonctionnels
| Module | Fonctionnement réel |
|---|---|
| Vue générale | Nombre d'équipes, demandes en attente, rencontres et articles issus de Supabase (avec limites affichées) |
| Utilisateurs | Affichage des comptes autorisés par la RLS admin ; recherche ; **retrait de rôle** via RPC sécurisé, avec confirmation. Ni suppression ni création de comptes Auth depuis ce panneau |
| Demandes de rôles | Consultation / approbation / rejet via RPC existante, MFA, vérification des droits et interdiction d'approuver sa propre demande |
| Effectifs publics | Brouillons et publication des joueurs / encadrants via `admin_save_team_public_person`, consentement explicite, journal privé |
| Saisons | Créer/modifier les saisons via `admin_save_season` avec validation des années |
| Matchs | Créer, modifier, dépublier ou publier une rencontre via `staff_save_match`. Source saisie par le club ; aucune fausse référence FFF |
| Actualités | Rédiger, éditer, dépublier et publier des **articles textuels publics** via `staff_save_news_article` avec attestation des droits |
| Contenus du club | Créer, modifier et publier des fiches d'identité via `admin_save_club_identity`, droits vérifiés |

Les listes de brouillons des matchs et articles nécessitent la migration additive `202610210021_private_admin_management_lists.sql`, qui fournit trois nouvelles RPC en lecture seule strictement administrateur + MFA.

## Suppression des accès aux démonstrations
- Suppression de l'entrée `#/presentation` de la navigation/routage publics.
- La page `#/control-center` affiche uniquement une invitation à se connecter / vérifier le MFA aux comptes non habilités ; **aucun aperçu simulé**.
- Ancien fichier de maquettes conservé dans l'historique Git pour la traçabilité technique, mais **plus importé ni monté** sur le site actif.
- Pas de faux comptes, scores, dons, paiements ou statistiques.
- Les fonctionnalités sans backend autorisé (tickets, finances, changements du design, gestion des abonnements) **ne sont pas présentées comme opérationnelles**.

## Limites de cette étape
- Aucun CRUD administrateur direct sur Auth `auth.users` : la création, suppression et réinitialisation forcée exigeraient un backend supplémentaire à privilèges contrôlés et une procédure de sécurité.
- Les fonctions de billetterie/premium/finances et la modification des sections de la page d'accueil restent à développer (plutôt que fournir des boutons factices).
- Pour les personnes mineures, le club doit obtenir les autorisations applicables avant publication d'identités, images ou données sportives.
- Un vrai test **navigateur** d'enrôlement TOTP, connexions après validation MFA, administration et fonctionnement sur mobile reste nécessaire ; les tests automatisés assurent la non-régression et les gardes de base mais ne simulent pas le service Auth réel.
- Aucun paiement LIVE n'est activé.

## Recette
GitHub Actions, 11 nouveaux tests de sécurité et des tests de non-régression historiques (ajustés lorsque le produit abandonne volontairement les démonstrations). Application et validation séparée de la migration, contrôle `has_function_privilege` pour interdire `anon`.

**Pour l'administrateur initial** : se connecter dans Mon espace avec le compte déjà promu, activer TOTP puis ouvrir **Centre de gestion**. Aucun changement de mot de passe n'est requis.
