# Étape 20 — Navigation hiérarchique « Équipes »

## Navigation publique
- `#/equipes` — annuaire général
- `#/equipes/football` — catégorie Football à 11
  - `#/equipes/football/seniors-a` — Seniors A · Départemental 3
  - `#/equipes/football/seniors-b` — Seniors B · Départemental 4
  - `#/equipes/football/seniors-c` — Seniors C · Matchs amicaux
  - `#/equipes/football/veterans` — Vétérans · Départemental 3
- `#/equipes/futsal` — catégorie Futsal
  - `#/equipes/futsal/boissy-uj-futsal` — Boissy-UJ Futsal · Départemental 2

## Menus et expérience
Le menu principal ordinateur propose « Équipes » (lien général) et un bouton ouvrant un sous-menu : Football à 11 et Futsal, avec chaque équipe. Les commandes `aria-expanded`, `aria-controls`, `hidden`, Escape et les liens avec `aria-current` renforcent les usages clavier.

Sur mobile, `<details>`/ `<summary>` permet d'ouvrir « Équipes », puis Football ou Futsal ; chaque rubrique comporte un lien vers sa page catégorie et des accès directs aux équipes. La navigation fixe en bas propose désormais un raccourci Équipes. Le menu reste scrollable sur les petits écrans.

## Fiches et données officielles
Chaque sous-page affiche l'écusson, l'équipe, sa discipline et son niveau fourni par le club. Les rubriques « Prochaines rencontres » et « Derniers résultats » sont lues uniquement depuis Supabase, via deux requêtes GET limitées : une recherche d'équipe par son code, puis les matchs **publiés** de son UUID.

Les résultats ne sont pas inventés. Les données non publiées, les autres équipes et les convocations privées ne sont pas consultées. Les données distantes sont toujours injectées avec `textContent`, jamais `innerHTML`, et les requêtes sont annulées au changement de page.

Le site ne nécessite aucune migration supplémentaire : les cinq équipes et les droits RLS ont été mis en place à l'étape 19. L'authentification publique et les paiements restent désactivés.

## Vérifications
- 2 pages catégorie + 5 pages équipe, avec route fixe et référencement interne.
- Menu ordinateur / mobile, clavier, indicateurs actif, CSS responsive et préférence de mouvement réduit.
- Liaison depuis l'accueil et l'annuaire, fil d'Ariane vers les niveaux supérieurs.
- Requêtes GET uniquement, restriction par UUID d'équipe et `published=eq.true`.
- Test GitHub Actions, revue de confidentialité et vérification visuelle Pages à effectuer avant d'affirmer une recette mobile réelle.
