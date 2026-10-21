# Étape 21 — Fiches d’équipes enrichies, annuaire à publication contrôlée

## Fonctionnalités publiques
Chacune des cinq fiches (`#/equipes/football/...` et `#/equipes/futsal/boissy-uj-futsal`) contient désormais :
- **Effectif** : uniquement les joueurs explicitement publiés avec autorisations vérifiées ;
- **Encadrement** : entraîneurs et personnel public, indépendant des affectations internes ;
- **Bilan collectif** : V/N/D, matchs joués, buts marqués et encaissés depuis `team_form_summary` (uniquement les matchs terminés publiés ; pas de classement FFF inventé) ;
- **Actualités** : seulement les publications `news_posts` rattachées à cette équipe, publiques, validées, publiées et non futures.

Les sections sont adaptées au mobile et les erreurs réseau d'une source n'empêchent pas l'affichage des autres. Aucun résultat, identité, biographie, numéro ou image n'est inventé. Les données sont injectées par `textContent`, sans interprétation HTML.

## Modèle de publication
Une nouvelle table `public.team_public_people` n'utilise pas `profiles`, `auth.users`, `user_roles` ou les tables privées d'appartenance sportive.
Ses fiches comportent :
- Équipe (UUID), nom public, catégorie `player/coach/staff`, rôle/poste, numéro facultatif pour les joueurs, présentation facultative, ordre de tri ;
- États `published=false` et `consent_confirmed=false` par défaut. La base **interdit** `published=true` sans vérification du consentement ;
- Aucun champ date de naissance, âge, contact privé, géolocalisation ou photo.

Le club doit confirmer ses droits sur toutes les données publiées. Pour les personnes mineures, obtenir les autorisations parentales ou légales nécessaires selon le contexte et la réglementation. Les fiches sont entièrement facultatives : l'absence d'accord laisse la personne invisible, sans impact sur les comptes ou les équipes.

## RLS et édition
- Les rôles `anon` et `authenticated` obtiennent exclusivement `SELECT` sur les fiches `published=true AND consent_confirmed=true`.
- Aucune écriture directe depuis un navigateur. Deux fonctions `admin_list_team_public_people()` et `admin_save_team_public_person(...)` sont **réservées** à `authenticated` et revalident `auth.uid()`, `app_private.is_admin()` et donc MFA AAL2 et rôle admin.
- Les modifications contrôlent une version `updated_at` pour éviter l'écrasement de modifications concurrentes.
- Chaque édition et dépublication alimente `app_private.team_public_people_audit` inaccessible aux clients publics.
- Les utilisateurs peuvent être joueurs et éducateurs simultanément au niveau associatif, mais une fiche publiée représente un affichage sportif, pas une attribution de rôle.

Dans `#/mon-espace`, le module éditeur est conçu pour un vrai administrateur AAL2, lorsque l'authentification sera homologuée. `#/control-center` propose seulement un aperçu **local** sans sauvegarde. Auth demeure désactivée à ce stade : les premières publications ne peuvent être effectuées depuis le site public.

## Liaison équipes
Les articles existants possèdent déjà `news_posts.team_id`. Aucun changement de leur schéma n'est nécessaire. Les rencontres restent gérées dans l'étape 20 ; les bilans proviennent exclusivement de la vue sportive filtrée par UUID.

## Recette
- Vérification SQL après application : table vide, RLS active, droits lecture seule, contrainte consentement, RPC anonymes interdits et table d'audit privée.
- Tests de filtrage des données publiées, de non-divulgation inter-équipes, de défaillance partielle, de permissions MFA et de cohérence des statistiques.
- Tests GitHub Actions `npm test` et vérification de syntaxe avant fusion `main`.
- Homologation authentification, MFA réel, revue des données personnelles et contrôle visuel mobile à finaliser avant exploitation.
