# Boissy-UJ — préversion du site officiel

Le dépôt contient le prototype visuel de Boissy-UJ en cours de développement. La branche `main` recevra les versions stabilisées, tandis que les prochaines améliorations pourront être réalisées sur des branches dédiées.

## Contenu disponible
- Accueil immersif avec huit chapitres et véritable écusson.
- Navigation ordinateur et mobile.
- Présentation des équipes, des matchs, des actualités, des événements, de la communauté et des dons.
- Interface « Mon espace » implémentée et reliée à Supabase, mais **inscription et connexion désactivées dans cette préversion publique** en attendant la recette réelle (RGPD, e-mails et sécurité).
- Premium : 10 € mensuels ou 100 € pour douze mois, sans renouvellement automatique annuel ; aucune transaction réelle.
- Matrice de recette pondérée, seuil des 85 % pour lancer la recette finale.

## État réel de Supabase

Les migrations de comptes, équipes, matchs, actualités, événements, affectations éducateurs, audit et sécurité ont été **appliquées au projet Boissy-UJ**. Les tables métier sont vides, à l’exception des quatre équipes déclarées ; aucun compte, billet ni paiement réel créé. La connexion publique demeure désactivée dans cette préversion. Voir [État Supabase vérifié](docs/ETAT_SUPABASE_20261021.md).

## Tests
Exécuter `npm test`. Les tests GitHub Actions sont lancés sur les branches de développement, les pull requests et `main`.

## Publication
Le projet est statique et peut être visualisé via GitHub Pages depuis la branche `main`, dossier `/(root)`, une fois Pages activé dans les paramètres GitHub.

**Attention : version de prévisualisation uniquement.** Les modules métier, les tests d'authentification en conditions réelles, la configuration légale et les paiements restent à homologuer. Les statistiques FFF ne sont pas simulées. Ne saisir aucune donnée personnelle réelle dans les fonctionnalités non validées.
