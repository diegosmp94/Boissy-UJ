# Correctif — Rubriques Nous rejoindre et Infos pratiques disponibles en mode dégradé

**24 octobre 2026 — Modification du site public uniquement.**

## Problème détecté

La page « Nous rejoindre » et la page « Infos pratiques » chargent indépendamment trois données déjà **publiées par Boissy-UJ** : annonces de recrutement, informations pratiques et canaux de contact. Le client utilisait `Promise.all` : une seule réponse HTTP en échec empêchait l'affichage de **tous** ces éléments, même si les deux autres réponses étaient valides.

Le délai maximum de 12 secondes introduit lors du correctif précédent ne résolvait pas cet effet domino ; il limitait seulement le temps d'attente.

## Corrections

- Lecture des trois catalogues via `Promise.allSettled`. Chaque jeu de données sain reste disponible même si un autre est en erreur (HTTP, réseau ou format JSON).
- Pour chaque catalogue, état indépendant `unavailable` ; une liste réellement vide n'est **pas** présentée comme identique à un catalogue inaccessible.
- Écran « Nous rejoindre » : disponibilité indépendante des annonces et des coordonnées. Les questions statiques restent accessibles et les questions officielles affichent une erreur distincte si leur catalogue ne répond pas.
- Écran « Infos pratiques » : horaires, lieux et annonces ne sont jamais inventés lorsque le catalogue manque ; le panneau des contacts officiels reste visible si sa propre lecture fonctionne.
- Messages temporaires accessibles aux lecteurs d'écran avec `role=status`.
- Le changement de route continue d'annuler les requêtes en vol ; une navigation interrompue n'est pas assimilée à une panne partielle réutilisable.
- Aucun nouveau formulaire nominatif, aucun compte de test, aucune permission élargie et **aucune écriture Supabase**.

## Tests ajoutés

Un cas sans panne, trois cas indépendants (une seule source indisponible), un cas de panne totale et un cas d'annulation avec serveur muet. Les tests vérifient également le filtrage explicite `published=true`, la séparation des contenus et l'absence de contenu fictif.

## Périmètre d'homologation

Ce correctif améliore la robustesse technique des pages publiques. Il ne confirme ni les horaires réellement pratiqués, ni les recrutements, ni les coordonnées des membres. Le club devra publier les informations approuvées depuis son administration sécurisée.

Aucun changement du statut des 14 chantiers réglementaires et fonctionnels non homologués.
