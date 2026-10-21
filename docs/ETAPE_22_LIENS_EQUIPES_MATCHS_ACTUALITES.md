# Étape 22 — Navigation contextuelle entre équipes, matchs et actualités

## Objectif
Les cinq fiches d'équipes donnent maintenant accès en un clic à leurs matchs et leurs actualités, avec un **filtre prépositionné** qui préserve la discipline et l'identité de l'équipe.

## URL partagées
Les liens suivent le format de la SPA GitHub Pages :
- `#/matchs?equipe=a`, `#/matchs?equipe=b`, `#/matchs?equipe=c`, `#/matchs?equipe=veterans`, `#/matchs?equipe=futsal`.
- `#/actualites?equipe=a` et analogues pour les autres équipes.
- `#/equipes/{football|futsal}/...` reste le chemin de la fiche d'équipe.

Un référentiel statique de codes valides convertit les paramètres du navigateur en identités sportives. Les codes inconnus ne servent jamais aux requêtes API. La navigation directe au moyen d'un lien partagé fonctionne après chargement de la page.

## Match Center
Le filtre **discipline** et le filtre **équipe** sont initialisés automatiquement à partir du lien. Les rencontres restent limitées à `matches.published=true` et à l'équipe recherchée selon son UUID Supabase. Chaque rencontre publiée renvoie à la fiche de son équipe.

## Actualités
La page `#/actualites` possède désormais un troisième filtre **Équipe** en plus de la recherche et du type de publication. Les articles portent déjà un `team_id`, renvoyé dans le jeu de colonnes publiques. Le filtre choisit l'UUID de l'équipe, pas son nom affiché. Si les équipes ne peuvent pas être résolues, un lien ciblé ne montre pas par accident les articles de toutes les équipes. Les cartes d'actualité affichent un lien vers la fiche de l'équipe lorsqu'elle est reconnue.

Les publications affichées restent publiques, validées, déjà publiées, et ne contiennent que les colonnes publiques prévues par la RLS existante. Aucun article ni résultat n'est inventé.

## Confidentialité / déploiement
- Aucune modification de la base de données et aucune nouvelle permission.
- Aucun profil privé ni système de convocation consulté.
- Test Node des chemins, des codes autorisés, de l'isolation par UUID et des protections en cas de source indisponible.
- Code fusionné uniquement après réussite des workflows GitHub Actions.
