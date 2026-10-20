# Boissy-UJ — développement par étapes

Dépôt privé. Branche de travail : `feat/fondations-site-v1`. Aucune fusion dans `main` sans tests et validation.

## Plan
1. **Audit : effectué.** Dépôt créé, branche présente. Projet Supabase existant, schéma applicatif vide.
2. **Socle visuel : en cours de validation.** La branche GitHub contient déjà un prototype statique avec plusieurs pages, navigation mobile, huit chapitres et tests de structure. Une autre variante locale utilise le véritable écusson. Il reste à **consolider les deux versions**, remplacer le monogramme temporaire de la branche par l'écusson du club et réaliser des tests navigateur.
3. Supabase : authentification, profils, rôles, RLS.
4. Sport : quatre équipes, effectifs, matchs, convocations, FFF autorisée ou mode manuel.
5. Médias et communauté : actualités, réactions, premium et Awards.
6. Stripe : exclusivement TEST tant que conformité et accord LIVE ne sont pas confirmés.
7. Control Center : administration, versioning, sécurité et rapports.
8. Recette : contrôle pondéré sur 100 points, lancement de recette finale à 85 %, puis blocages critiques à lever avant production.

## Règles de sécurité et de produit
- Pas de paiements réels ni de données de membres tant que les parcours ne sont pas sécurisés.
- Premium : 10 €/mois sans engagement ou 100 €/12 mois sans reconduction automatique.
- Pas de score officiel FFF non vérifié.
- Aucune fonctionnalité non testée n'est considérée comme livrée.
- Aucun déploiement public effectif n'est attesté par ce README.

Voir `docs/MATRICE_RECETTE.md` pour les pondérations, validations obligatoires et seuil des 85 %.
