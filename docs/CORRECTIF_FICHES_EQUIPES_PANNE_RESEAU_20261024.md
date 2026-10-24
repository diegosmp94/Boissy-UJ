# Correctif — fiches d'équipes accessibles en cas de panne des données sportives

**24 octobre 2026 — Travail frontend, aucun changement de base de données.**

## Défaut reproduit par revue de code

Sur une fiche d'équipe, `mountTeamProfile` attendait les requêtes Supabase sans limite de temps et, en cas d'erreur, remplaçait la totalité de la page sportive par un message générique. Pourtant, les calendriers et résultats sourcés déjà embarqués localement pour la saison 2026–2027 pouvaient continuer à être affichés, sans être présentés comme validés par le club.

## Correctifs

- Délai de **12 secondes** via le helper commun `boundedPublicRequest`, nettoyé en `finally` et annulé au changement de route.
- Une erreur de lecture des matchs publiés n'empêche plus l'affichage des archives provenant des relevés externes embarqués.
- Un avertissement accessible (`role=status`) distingue clairement données club temporairement indisponibles et archives tierces non homologuées.
- Une équipe encore non configurée dans la base n'est plus privée de ses éventuelles archives consultables ; aucune date, score ou rencontre fictifs.
- L'onglet « Nous rejoindre » tire maintenant ses filtres des cinq équipes du référentiel commun. L'équipe en discipline futsal reste nommée **« Senior »**, non « Seniors futsal ».
- La FAQ ne prétend plus que le Match Center contient exclusivement des rencontres validées par le club.

## Recette technique

Nouveau test `tests/team-profile-resilience.test.mjs` : délai et annulation, conservation du fallback public, distinction de la provenance, toutes les équipes présentes et aucune écriture à la base.

La recette réelle iPhone Safari/Android, MFA/RLS, droits à l'image, publication des résultats officiels et sauvegardes **restent ouvertes** ; ce changement n'autorise ni levée du `noindex`, ni activation de paiement.
