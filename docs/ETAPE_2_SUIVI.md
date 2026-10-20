# Étape 2 — consolidation du prototype visuel

**Statut** : en cours ; aucune fusion dans main autorisée à ce stade.

## Travaux effectués
- Le dépôt et la branche de développement sont présents.
- GitHub contient un site public de préversion (accueil à huit chapitres et pages publiques).
- Navigation et compatibilité de base vérifiées par des tests statiques et Node.
- Les tests automatisés supplémentaires valident les pages et leurs liens, la présence des huit chapitres, les prix premium et l'absence de formulaires de paiement.
- Une variante locale `boissy-dev` utilise le véritable écusson et une interface cinématique plus travaillée ; elle dispose de **7 tests locaux réussis**.
- La matrice des 100 points et la règle de recette finale à 85 % sont documentées.

## Écarts à résoudre avant étape 3
- Le logo du dépôt GitHub reste temporaire (SVG) : copier le vrai fichier `ecusson-boissy-uj.webp` de la variante locale sur la branche et ajuster les chemins.
- Ne pas juxtaposer deux réalisations concurrentes : choisir, comparer et fusionner le contenu du prototype local et de la branche GitHub.
- Les contrôles réels via Chromium/Playwright local sont bloqués par une restriction d'administration du navigateur. **Pas de validation visuelle mobile attestée**.
- Faire la recette manuelle Safari iOS et ordinateur, notamment débordements, menus, huit chapitres, liens, bouton 'passer', préférences de réduction des mouvements.
- Ne pas considérer les pages de démonstration comme des fonctionnalités métier terminées.

## Sécurité et release
- Supabase, Stripe et données officielles FFF non activés.
- Pas de paiement LIVE ni d'identifiants collectés.
- Aucun contenu privé ne doit être ajouté tant que Auth et RLS n'ont pas de tests.
- Ne pas fusionner dans main avant validation visuelle et fonctionnelle.

## Priorité immédiate
**Finaliser et comparer le rendu local et GitHub, intégrer le vrai logo et vérifier le mobile**, puis engager l'étape 3 : structure Auth + RLS.
