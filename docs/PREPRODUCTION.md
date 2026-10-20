# Préproduction Boissy-UJ

## État vérifié
- GitHub Pages : création refusée à l'intégration (`Resource not accessible by integration`). Le workflow temporaire a été retiré.
- Vercel : proposé, **connexion du propriétaire requise** avant tout déploiement depuis ChatGPT.
- GitHub privé et branche de travail : `feat/fondations-site-v1`.
- Pas de données personnelles, pas de checkout LIVE, pas d'utilisation de FFF automatisée sans autorisation.

## Préparation
- Importer le dépôt privé dans Vercel sous le compte habilité et sélectionner la branche de prévisualisation.
- Projet statique sans build ; fichier `vercel.json` et `robots.txt` fournis.
- Vérifier que la preview affiche bien les fichiers de la branche choisie avant de partager l'URL.
- Remplacer l'écusson SVG temporaire sur la branche par l'écusson officiel de la variante locale avant d'annoncer le rendu final.
- Effectuer les tests sur iPhone Safari, ordinateur et le menu / huit chapitres.

**Important** : `noindex` limite l'indexation mais ne protège pas une URL. Utiliser la protection d'accès du fournisseur si la preview doit rester privée.
