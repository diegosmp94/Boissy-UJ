# P1 — Délais réseau et reprise des demandes de rôles (26 octobre 2026)

## Défaut traité

Les appels Supabase de la rubrique **Mon espace → Demander un rôle** et du panneau **Administration → Demandes à valider** n'étaient pas systématiquement soumis à un délai maximal. En cas de connexion interrompue, certaines actions pouvaient rester figées et des décisions administratives demeurer en attente sans retour visuel clair.

## Correctifs livrés

- Délai maximal de 12 secondes par appel Supabase via le helper existant `withAuthDeadline`.
- Le formulaire de demande de rôle est réactivé après exception réseau ; son message distingue **résultat non confirmé** et refus explicite, puisqu'un timeout ne prouve pas que l'opération a échoué côté serveur.
- Le bouton **Actualiser mes demandes** permet de vérifier l'historique privé avant un nouvel envoi.
- Si le catalogue des équipes est indisponible, le formulaire reste bloqué et propose **Réessayer le chargement des équipes**. La tentative précédente est invalidée et la section recréée proprement.
- Les vérifications identité/MFA, la lecture des demandes et la décision d'approbation/refus sont bornées dans le temps. Sur échec de revérification, les éléments privés sont masqués.
- Les demandes concurrentes obsolètes ne doivent pas remplacer des données plus récentes. L'autorité d'approbation demeure intégralement **côté Supabase**, avec MFA AAL2, sans droit supplémentaire côté navigateur.

## Validation

- Tests Node des timeouts / exceptions et assertions de chemin d'appel.
- Tests de non-régression existants sur concurrence et réponses asynchrones.
- Vérification `npm test` et recette navigateur Chromium dans GitHub Actions.
- Pas de migration SQL, pas de modification de comptes, de rôles ou de données personnelles.

## Ce que cela ne clôt pas

La recette **réelle** des sept comptes distincts, de l'isolation joueur A/B, de l'administrateur AAL1/AAL2 et des deux convocations reste à réaliser dans un environnement de staging isolé et autorisé. Aucun résultat réel multi-comptes n'est revendiqué par le présent correctif.
