# Correction — horaire d'hiver/d'été et disponibilité du « prochain match »

**24 octobre 2026 — Site public uniquement, aucune écriture Supabase.**

## Problème identifié

Une rencontre qui ne comporte qu'une **date** doit rester affichée jusqu'à minuit, heure de Paris, à la fin de ce jour. La fonction `parisNextMidnight()` évaluait le décalage UTC **à midi le lendemain**. Lorsque l'heure d'été commence ou se termine durant cette matinée, le décalage de midi n'est pas celui de minuit : le bandeau pouvait passer au match suivant **une heure trop tôt ou trop tard**.

De plus, quand Supabase échouait mais que le calendrier externe embarqué avait encore des rencontres, l'accueil montrait celles-ci sans avertir que l'actualisation des publications officielles du club était temporairement impossible.

## Mesures développées

- Calcul de la borne de changement pour les matchs sans horaire en utilisant l'heure observée à **00:00 UTC le lendemain**, qui est antérieure aux bascules DST nocturnes de Paris. On applique donc le bon décalage *en vigueur à minuit heure locale*, pas celui de midi.
- Validation stricte de la date `AAAA-MM-JJ` : dates inexistantes rejetées, pas de transformation automatique de février 30 en mars.
- Distinguer une réponse Supabase disponible, une panne et la restauration du service via `remoteUnavailable`, sans enregistrer ni simuler de résultats.
- Si le service est momentanément inaccessible, avertissement accessible via `role=status` sur une rencontre référencée ou déjà chargée ; si aucune rencontre connue, message « Programme momentanément indisponible ».
- Maintien des liens vers le Match Center et la fiche de l'équipe, du rafraîchissement horaire, du déclenchement au coup d'envoi et au retour du focus.

## Vérifications

`tests/home-next-match-dst-resilience.test.mjs` couvre les deux changements d'heure, les jours suivant le changement, le 29 février bissextile, les dates invalides, le minuteur de bascule, les deux états de la carte et le maintien du statut de source tierce non homologuée.

Ce développement ne confirme **aucune** date sportive, ni les droits de reproduction, ni les contrôles MFA/RLS, RGPD ou sauvegardes. `noindex` reste activé avant approbation du club.
