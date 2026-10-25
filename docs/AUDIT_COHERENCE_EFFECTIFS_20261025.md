# Audit P1 · Éditeur des effectifs et cohérence privé/public — 25 octobre 2026

## Défaut de production identifié et corrigé

Dans l'éditeur des fiches publiques `team-person-editor.mjs`, le code appelait `button('Actualiser les profils', …)` et `button('Préparer la dépublication', …)` sans jamais avoir déclaré `button`. L'ouverture de l'éditeur MFA était susceptible de déclencher `ReferenceError: button is not defined`. Le module dispose désormais d'un véritable constructeur de boutons secondaires.

Un test de montage avec `getUser`, MFA AAL2 et rôle administrateur simulés vérifie maintenant que le composant réel s'ouvre sans exception et charge correctement le répertoire des brouillons.

## Audit de cohérence réservé aux administrateurs

Dans **Administration → Effectifs publics**, une nouvelle section « État des effectifs par équipe » permet de lancer volontairement un diagnostic **en lecture seule**. Pour chacune des cinq équipes, elle affiche :

- Joueurs ayant une affiliation privée active et ceux ayant reçu catégorie et numéro ; joueurs sans poste ou numéro.
- Joueurs/éducateurs réellement publiés avec consentement ; fiches en brouillon ; joueurs publics dont le poste est ambigu.
- Échec de lecture explicite pour une équipe (ne jamais afficher `0` lorsque les accès sont refusés ou que le réseau échoue).

Les affiliations sont consultées avec le RPC existant `staff_list_affiliated_players` uniquement après une nouvelle vérification admin MFA. Cette vérification est répétée après le chargement : une perte de session en cours de requête ne laisse pas afficher les effectifs privés. Un changement de catalogue invalide le rapport précédent. Aucune lecture privée ne se produit à l'ouverture du module ; **le clic administrateur est obligatoire**.

### Frontière d'identité

Le catalogue public et les affiliations privées **n'ont pas de lien personne-à-personne approuvé**. Les nombres affichés sont donc un inventaire et ne prouvent jamais que les fiches publiques représentent les mêmes joueurs. **Aucune comparaison par nom, association automatique, copie de biographie/photo ou publication silencieuse.** L'administrateur continue de vérifier séparément l'identité, l'équipe, les catégories, le numéro, les droits et les consentements.

## Vérifications de l'environnement réel

Le contrôle agrégé de Supabase relève cinq équipes mais **0 joueur affilié actif, 0 position privée, 0 éducateur affecté et 0 fiche publique approuvée**. Une épreuve d'autorisation positive admin/éducateur/joueur nécessite donc encore des comptes réels approuvés et une instance de recette isolée. Aucun compte fictif n'est créé en production.

Les fonctions RPC utilisent les rôles stockés dans `public.user_roles`, les affiliations actives et la fonction `app_private.is_admin()` pour exiger AAL2. Cette architecture ne permet pas de déclarer terminés les scénarios multi-utilisateurs sans les exécuter réellement.

## Validation et suivi

- Nouveau test de montage de l'éditeur administrateur réel (et du bug `button`), indépendamment des tests de simple lecture du code.
- Test du rapport à cinq équipes et des rôles simulés, du refus après expiration MFA, de l'absence de lecture privée avant clic et de l'absence des noms/UUID dans les résultats.
- Tests de publication/consentement existants conservés.
- Maintenir ouverts la recette réelle 7 comptes MFA/RLS, les tests physiques Safari/Android/VoiceOver/TalkBack, la politique RGPD et les autorisations de photographies, et le rapprochement individuel approuvé.

Aucune migration SQL ; aucune écriture Supabase ; aucune identité ou photo inventée.