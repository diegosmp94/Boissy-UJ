# Étape 38 — Calendrier mensuel, archives et résultats (22 octobre 2026)

## Réalisé
- Agenda : grille mensuelle interactive, du lundi au dimanche, avec navigation vers les mois passés et futurs, bouton Aujourd'hui, affichage mobile et navigation clavier.
- Détail de chaque date : match / événement, provenance, date, horaire uniquement lorsqu'il est connu, résultat connu, lien de source.
- Match Center : les archives sourcées apparaissent avec les dates futures lorsqu'aucune rencontre n'a encore été publiée dans Supabase.
- Les publications du club et les références SportCorico sont distinguées visuellement. Les matchs réels terminés publiés dans Supabase apparaissent dans l'archive avec leur score. Les références tierces ne sont pas automatiquement écrites en base.
- L'export iCalendar reste limité aux matchs à venir publiés par le club et aux événements autorisés.

## Résultats externes répertoriés

| Date | Équipe | Affiche | Score relevé |
| --- | --- | --- | --- |
| 20/09/2026 | Seniors A | Boissy U.J. — Bann'zanmi 2 | 6-1 |
| 04/10/2026 | Seniors A | Moldavie FC 1 — Boissy U.J. | 1-3 |
| 11/10/2026 | Seniors A | Villejuif US 1 — Boissy U.J. | 6-0 |
| 18/10/2026 | Seniors A | Villiers S/M. ES 2 — Boissy U.J. | 1-0 |
| 03/10/2026 | Senior futsal | Boissy U.J. — Petits Anges ES 1 | 3-7 |

Sources consultées :
- Seniors A : https://www.sportcorico.com/clubs/boissy-uj/boissy-uj
- Futsal : https://www.sportcorico.com/clubs/boissy-uj/boissy-uj-1
- Vétérans : https://www.sportcorico.com/clubs/boissy-uj/boissy-uj-6?season=2026-2027
- Seniors B, affiche du 1er novembre : https://www.sportcorico.com/clubs/val-de-fontenay-as/val-de-fontenay-as-39

**Correction du précédent lot :** la rencontre attribuée à tort à Seniors B contre SFC Canavérois a été retirée. Les équipes du club distinct « Boissy FC » sont exclues.

## Ce que le terme « confirmé » veut dire

Un résultat **relevé sur SportCorico** est sourcé, mais pas homologué par un administrateur du club ni certifié officiellement par la FFF. Le calendrier l'indique explicitement. Une rencontre **publiée par le club dans Supabase** est signalée séparément, et prend la priorité sur les références tierces ayant les mêmes équipe/date/adversaire.

Les matchs passés sans score public vérifié affichent « résultat non communiqué ». L'heure précise des résultats anciens ne fait jamais l'objet d'une invention.

## Étapes restantes pour une homologation de toutes les rencontres

Chaque match futur et ancien doit être vérifié / approuvé par une personne habilitée du club, puis enregistré via les RPC d'administration existantes. La connexion API FFF n'est pas autorisée et ne fonctionne pas à ce stade. Aucun score tiers n'est importé automatiquement dans Supabase.

La recette technique couvre les mois historiques, fuseaux, scores, refus d'écriture directe, non-duplication et affichage accessible.
