# Étape 69 — Fiabilisation du Control Center

**Date : 26 octobre 2026.** Développement technique seulement ; aucun contenu club, compte de démonstration ou homologation multi-comptes.

## Écarts identifiés et corrections

| Écart | Correction versionnée |
|---|---|
| Authentification/MFA ou chargement des rôles sans échéance | `adminSessionStatus` utilise `withAuthDeadline` (12 secondes) sur identité + AAL et sur lecture des rôles, avec retour **non vérifié** en cas d'échec, sans afficher de droits antérieurs. |
| RPC d'un module optionnel absent ou bloqué faisant échouer toute l'administration | `adminCapabilities` vérifie **indépendamment et avec délai** événements, affectations entraîneurs, médias approuvés et historique éditorial. Un service indisponible ne désactive que son module. |
| Modification des permissions au cours de la préparation du panneau | Une **seconde vérification MFA/role** suit les sondes ; chaque changement de module vérifie encore les permissions avant d'afficher les données. |
| Échecs asynchrones pouvant laisser l'utilisateur sans recours | État générique sans identifiant privé et bouton **« Réessayer ce module »** ; promesses asynchrones de modules capturées ; échec d'ouverture du panel avec bouton **« Réessayer la vérification administrateur »**. |
| Module affichant des données antérieures pendant un nouveau chargement | Chaque navigation ou actualisation remplace d'abord le conteneur du module par une vue isolée, et retire les anciennes cartes. |
| Rafraîchissement nécessitant une fermeture complète de la page | Bouton **« Actualiser le module »** pour relire les données sous une **nouvelle vérification de rôle et MFA**. |
| Indicateurs d'accueil pouvant rester suspendus | Requêtes des quatre statistiques administratives sous une échéance bornée. Aucune statistique n'est inventée si la lecture échoue. |

## Garanties et limites

- `getUser`, contrôle des rôles `user_roles`, MFA `aal2`, RPC RLS et contrôles SQL restent les seules autorités. Les badges d'interface n'attribuent **aucun droit**.
- Aucun secret Supabase ni détail des erreurs serveur n'est affiché dans les messages. L'interface n'expose jamais de données d'un module ayant échoué à se charger.
- Les modules absents (billetterie, médias, versions) ne sont **pas activés artificiellement**.
- Aucune migration Supabase requise : modifications exclusivement client JavaScript et tests.
- Une expiration réseau n'annule pas matériellement une opération serveur déjà envoyée ; les modules d'édition doivent encore gérer les résultats incertains et relire l'état avant de renouveler une action sensible.
- La fermeture d'un panneau sur une perte d'accès lors de la reprise de l'onglet est héritée de l'étape 68. Une homologation à plusieurs comptes et appareils reste séparée, à réaliser par le club.

## Fichiers concernés

- `admin-control-reliability.mjs` — sondes bornées, gardes d'accès et messages.
- `admin-security.mjs` — contrôles d'identité/MFA/rôles bornés.
- `admin-center.mjs` — montée du panneau, refus d'accès, modules détachables, actualisation, reprise.
- `tests/step69-admin-control-reliability.test.mjs` et `tests/admin-navigation.test.mjs` — tests automatiques et nouveaux contrats.

**Clôture technique de l'étape 69 :** contrôles GitHub verts, fusion dans `main` et déploiement GitHub Pages réussi ; ne remplace pas la recette des sessions réelles.
