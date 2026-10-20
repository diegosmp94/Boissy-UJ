# Boissy-UJ — site officiel

Premier lot de développement du site Boissy-UJ sur la branche `feat/fondations-site-v1`.

## Lancer localement

```bash
node server.mjs
# puis ouvrir http://localhost:4173
```

Aucune dépendance à installer pour cette première fondation statique. Les pages sont adaptatives et la navigation est utilisable sans connexion serveur.

## Tests

```bash
node --test tests/spec.test.mjs
```

## Périmètre du premier lot

- Accueil en huit chapitres plein écran, introduction passable, réduction des mouvements.
- Navigation desktop et barre inférieure mobile.
- Pages Équipes, Match Center, Actualités, Communauté, Soutien et Mon espace.
- Deux formules premium : 10 €/mois sans engagement ; 100 €/12 mois, renouvellement manuel.
- Séparation visible des données de démonstration et des données sportives vérifiées.
- Matrice de recette pondérée sur 100 points.

## Limites et sécurité

La préversion **ne réalise aucune opération financière** et ne collecte **aucun identifiant**. Les éléments de compte, FFF, Stripe et Control Center sécurisé ne sont pas encore fonctionnels ; voir `docs/MATRICE_RECETTE.md`.

Le visuel `assets/ecusson.svg` est un **repère temporaire**. Il devra être remplacé par le vrai fichier d'écusson Boissy-UJ fourni par le club, après optimisation et validation graphique.

Ne pas déployer comme site public officiel avant validation des mentions légales, des contenus et de la recette.
