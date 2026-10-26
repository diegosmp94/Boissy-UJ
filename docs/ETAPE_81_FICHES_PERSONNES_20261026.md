# Étape 81 — Fiches publiques individuelles avec consentement distinct

**26 octobre 2026 · livraison technique** (la recette juridique et la saisie des personnes réelles restent hors du périmètre de la roadmap).

## Reprise de l'existant

Les sections Effectif / Éducateurs existent déjà pour cinq équipes via `team_public_people`. Une fiche joueur avec silhouette et valeurs non renseignées existait également (`#/joueurs/<uuid>`). Le travail ne crée ni un nouvel annuaire de comptes de connexion ni un lien à `auth.users` : les données privées des joueurs, leurs affiliations, coordonnées, date de naissance et détails de santé ne sont pas disponibles au public.

## Autorisation distincte d'une fiche individuelle

Migration : `supabase/migrations/202610260018_public_person_profile_consent.sql`.

- `published` + `consent_confirmed` autorisent uniquement l'affichage dans **l'effectif de l'équipe**, selon le modèle d'origine.
- `profile_visible` et `profile_consent_confirmed` sont ajoutés avec valeur par défaut `false`. Une contrainte SQL interdit la fiche complète sans publication autorisée de la personne **et consentement spécifique pour sa page**.
- Le seul flux de validation individuelle est la RPC `admin_set_public_person_profile`, avec vérification serveur d'`app_private.is_admin()` (rôle admin + MFA AAL2), verrou optimiste `updated_at`, audit interne et double confirmation côté interface.
- Un trigger réinitialise l'approbation de la fiche individuelle lors de tout changement de nom, équipe, type, rôle, numéro, présentation, publication ou consentement de base. Le retrait administratif est immédiat pour les nouvelles lectures.
- Le rôle administrateur n'est jamais inféré depuis l'email, le contenu du navigateur ou les métadonnées privées modifiables par utilisateur.

## Front public

- Les cartes joueurs ne créent un lien `#/joueurs/<uuid>` que lorsque **les quatre** drapeaux sont vrais. Les anciens profils déjà publiés dans l'effectif restent visibles comme cartes statiques, sans lien individuel, en attente de revue.
- Nouvelle fiche éducateur `#/educateurs/<uuid>` pour les entraîneurs ou membres d'encadrement explicitement décrits comme éducateurs. Lecture GET limitée à une personne publiée et autorisée, puis validation de la catégorie de l'une des cinq équipes.
- Les fiches utilisent uniquement le nom validé, le rôle, l'équipe, la discipline et la courte présentation existante. Silhouette neutre sans photographie réelle ; aucun âge, numéro de contact, statistique ou diplôme inventé. Aucun accès à `profiles`, `auth.users`, `user_roles` ou aux affectations privées.
- Gestion des mauvaises URLs, des retraits, des pannes et des requêtes tardives. Pas de publication automatique lors d'une affectation privée ou d'une modification de l'effectif.

## Ce qui reste à valider par le club

Le consentement, le droit à l'image et les autorisations des représentants des mineurs ne peuvent pas être attestés par le logiciel. Le responsable doit vérifier la portée de l'accord, la durée de conservation et les procédures de retrait. Une fiche n'expose **pas** de photo pour le moment. Les portraits et les statistiques individuelles exigeraient des droits et sources spécifiques supplémentaires.

Tests : `tests/step81-public-person-profiles.test.mjs`, adaptation des tests joueurs existants. Aucun joueur ni éducateur créé, aucun consentement simulé inscrit en production.

**Étape 82** : droits Premium côté serveur, indépendants du navigateur et des préférences client.
