# Étape 16 — Page « Le club » : identité, histoire, organisation et projets

## Fonctionnalités publiques
- Nouvelle page `#/club` accessible par la navigation mobile/ordinateur, le chapitre « Bienvenue » de l'accueil, le pied de page et la démonstration interactive.
- Présentation visuelle bleu nuit et doré de l'écusson et des **quatre équipes attestées** : Seniors A D3, Seniors B D4, Seniors C amicaux et Vétérans D3.
- Blocs de présentation éditoriale (collectif, football, vie associative), sans inventer un fondateur, une date, un dirigeant, une subvention ni un programme sportif.
- Navigateur de rubriques vérifiées : histoire, valeurs, organisation, projets ; lecture seule, filtrage sans inscription.
- Chronologie du club : **aucune date fictive** ; les étapes apparaissent uniquement après publication par le club.
- Organisation : responsabilités et, facultativement, noms **expressément autorisés à la publication**. Les données de membres, leurs adresses et leurs contacts privés ne sont jamais affichés.
- Liens vers les équipes, Nous rejoindre et Infos pratiques. Interface mobile adaptée aux petits écrans avec navigation clavier.
- Si le catalogue officiel est vide, les quatre équipes et la présentation éditoriale restent visibles et un message explique les archives à compléter. Aucune page blanche ou faux historique.

## Modèle Supabase
Migration `supabase/migrations/202610210016_club_story_public.sql`.
- `public.club_story_sections` : textes vérifiés pour histoire, valeurs, organisation, projets. Non publié par défaut.
- `public.club_story_milestones` : chronologie (période, fait, description). Non publié par défaut.
- `public.club_public_positions` : fonction, présentation et nom optionnel ; nom nominatif publié uniquement après revue des autorisations.
- Sur les trois tables : RLS activée, lecture des **seules lignes explicitement publiées**, aucune écriture directe depuis les navigateurs `anon` ou `authenticated`.
- Le frontend effectue uniquement des GET PostgREST avec la clé publique et utilise `textContent` pour afficher des contenus non fiables.
- Aucun enregistrement d'exemple, nom, date ou responsable créé par la migration.

## Critères de recette
1. Tests Node des filtres, de la visibilité des noms, des appels REST en lecture seule, des routes et du repli réseau.
2. Contrôle Supabase : trois tables installées, RLS activée, client en lecture seule et base vide en attente des contenus autorisés.
3. Démonstration de `#/club` sur téléphone puis ordinateur, sans activation des fonctions privées.
4. Réception et validation par le club de son **histoire réelle, ses fonctions, les personnes consentantes et ses projets** avant toute insertion en production.
5. Aucun passage en mode Auth, Stripe LIVE ou vote Premium dans ce lot.

Les tests automatisés vérifient la logique et la structure, pas une recette visuelle réelle sur tous les navigateurs.
