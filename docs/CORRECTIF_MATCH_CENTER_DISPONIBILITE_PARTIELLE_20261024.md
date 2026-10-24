# Correctif P1 — Match Center résilient aux indisponibilités partielles

**24 octobre 2026 · Frontend public uniquement**

## Défaut

Le Match Center utilisait `Promise.all` pour les lectures Supabase des équipes, matchs publiés et saisons. Une erreur isolée — par exemple une indisponibilité de `club_seasons` — provoquait le basculement intégral en mode de démonstration, masquant des résultats réellement disponibles. L'interface annonçait alors à tort l'absence d'informations de calendrier.

## Solution

- `loadPublicSportCatalogs` effectue trois GET indépendants avec `Promise.allSettled`, conserve les données saines, signale `unavailable` par catalogue et transmet le signal d'annulation.
- Si seules les saisons sont indisponibles, les matchs vérifiés continuent à s'afficher, sans filtre de saison ; l'avertissement précise ce qui manque.
- Si le catalogue de matchs est indisponible, la page ne présente pas un faux compteur à zéro et distingue panne et absence de résultat.
- Si certaines équipes sont absentes ou invalides, seules leurs fiches de présentation utilisent les identifiants `pending-*`. Les matchs sont conservés pour les seules équipes dont l'identifiant réel et la discipline ont été vérifiés, et jamais associés aux identifiants fictifs.
- Le calendrier et les scores issus des sources sportives extérieures restent consultables sur le site, avec attribution et mention de non-homologation.
- Le garde-fou de **12 secondes** et l'annulation en navigation restent actifs ; aucune écriture de base, attribution de rôle, donnée personnelle, paiement ni activation de publication.

## Tests

Le fichier `tests/match-center-partial-catalogues.test.mjs` vérifie successivement : réponse complète, panne isolée des saisons, panne des matchs, panne des équipes, référentiel partiel, mauvaise discipline/doublons et requêtes interrompues. La CI Node et les parcours navigateur Chromium doivent réussir avant fusion.

## Ce que ce correctif ne valide pas

Aucune homologation réelle des scores ou dates, de leurs droits de réutilisation, des sept profils MFA/RLS, des appareils physiques et des sauvegardes. Le `noindex` doit rester en place tant que le club n'a pas approuvé la mise en service complète.
