# Étape 17 — Agenda unifié du club

## Fonctionnalité livrée sur branche dédiée
- Nouvelle route publique `#/agenda`, accessible dans les menus ordinateur et mobile et depuis la séquence Match Center de l'accueil.
- Regroupement en **lecture seule** des matchs programmés, événements publics et libellés des équipes publiés dans Supabase.
- Filtre **Tous / Matchs / Événements**, période **À venir / 7 prochains jours / Toutes les dates**, recherche insensible aux accents, affichage responsive et navigation accessible.
- Exclusion stricte côté interface des matchs non publiés, annulés, reportés et joués ; exclusion des événements non publiés et réservés au Premium.
- Dates affichées dans le fuseau **Europe/Paris**. Lieu absent = « Lieu à confirmer ». Les trois requêtes GET sont plafonnées à 100/100/4 enregistrements, et la période de 7 jours est glissante.
- Requêtes annulées au changement de page, protection contre l'affichage de réponses périmées, contenu distant rendu par `textContent` et liens internes fixes.
- Si un catalogue ne répond pas, l'agenda présente les données réellement accessibles et indique explicitement qu'elles sont **partielles**, sans affirmer une absence d'événement.
- Aucune donnée fictive, aucune écriture Supabase ni nouveau schéma, aucun compte, aucune réservation ou paiement activé.

## Vérifications attendues
- `npm test` : cas publiques/privés, premium, brouillons, dates invalides, événements en cours, recherches, filtrage, abort réseau et navigation.
- `node --check app.js` et `node --check agenda.mjs`.
- GitHub Actions sur la branche et PR.
- Visite navigateur puis iPhone à réaliser après fusion, avec vérification de la configuration GitHub Pages.

## Contrainte de publication
Cette fonctionnalité améliore la vitrine et la démonstration du 22 octobre, mais **ne constitue pas une recette à 85 %**. Supabase Auth, MFA, écritures administratives, Premium et Stripe TEST restent hors de ce lot. Les vrais contenus du club sont à publier par les responsables habilités après vérification.
