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
**Amélioration du 21 octobre 2026 :** sur ordinateur, la flèche/bouton séparé a été retirée. Un simple survol de « Équipes » dévoile immédiatement un panneau premium bleu nuit/doré (transition très courte, neutralisée si réduction du mouvement demandée), sans aucun clic. Une zone de survol continue relie le libellé au panneau pour éviter sa fermeture accidentelle. Les deux catégories et les cinq liens sont préservés. Le clic sur « Équipes » garde son accès à l'annuaire général. Le focus au clavier ouvre également le menu ; Escape, le départ du pointeur et le clic ailleurs le referment, avec synchronisation de `aria-expanded` et `hidden`. Une navigation clavier après Escape ne rouvre pas involontairement le panneau.

Sur mobile, `<details>`/ `<summary>` permet d'ouvrir « Équipes », puis Football ou Futsal ; chaque rubrique comporte un lien vers sa page catégorie et des accès directs aux équipes. La navigation fixe en bas propose désormais un raccourci Équipes. Le menu reste scrollable sur les petits écrans.

## Fiches et données officielles
Chaque sous-page affiche l'écusson, l'équipe, sa discipline et son niveau fourni par le club. Les rubriques « Prochaines rencontres » et « Derniers résultats » sont lues uniquement depuis Supabase, via deux requêtes GET limitées : une recherche d'équipe par son code, puis les matchs **publiés** de son UUID.

Les résultats ne sont pas inventés. Les données non publiées, les autres équipes et les convocations privées ne sont pas consultées. Les données distantes sont toujours injectées avec `textContent`, jamais `innerHTML`, et les requêtes sont annulées au changement de page.

Le site ne nécessite aucune migration supplémentaire pour les cinq équipes déjà mises en place à l'étape 19. L'authentification standard est disponible ; les paiements Premium restent désactivés.

## Vérifications
- 2 pages catégorie + 5 pages équipe, avec route fixe et référencement interne.
- Ouverture ordinateur au survol sans bouton « flèche », fermeture en quittant le panneau, clic ailleurs et Escape ; clavier, indicateurs actifs et respect du mouvement réduit.
- Tests de comportement simulant réellement les événements de pointeur, de focus, de clic et d'Escape, plus couverture mobile inchangée.
- Liaison depuis l'accueil et l'annuaire, fil d'Ariane vers les niveaux supérieurs.
- Requêtes GET uniquement, restriction par UUID d'équipe et `published=eq.true`.
- Test GitHub Actions, revue de confidentialité et vérification visuelle Pages à effectuer avant d'affirmer une recette mobile réelle.
