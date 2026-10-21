# Étape 19 — Football à 11 et futsal séparés

## Référentiel confirmé par Boissy-UJ
| Discipline | Équipe | Niveau annoncé |
| --- | --- | --- |
| Football à 11 | Seniors A | Départemental 3 |
| Football à 11 | Seniors B | Départemental 4 |
| Football à 11 | Seniors C | Matchs amicaux |
| Football à 11 | Vétérans | Départemental 3 |
| Futsal | Boissy-UJ Futsal | Départemental 2 |

Le niveau de futsal **Départemental 2** a été fourni par le club. La source en base est `manual` tant qu'aucune synchronisation/référence FFF n'est vérifiée ; cela n’empêche pas sa présentation comme niveau communiqué par le club.

## Site
- Nouvelle page `#/equipes` subdivisée en **Football à 11 (4 équipes)** / **Futsal (1 équipe)**, avec raccourcis accessibles, cartes dédiées et sans fausses rencontres.
- Accueil : quatre cartes de football et un bandeau futsal D2 distinct, cinématique et palette inchangées.
- Notre club : groupes séparés, cinq équipes, historique et actualités toujours publiés sous contrôle.
- Match Center : filtre discipline en plus des filtres équipe/saison ; chaque résultat est affecté à la bonne équipe.
- Bilans : cinq équipes dans la vue calculée depuis les matchs terminés publiés ; zéro match futsal inventé.
- Ateliers de rédaction/matchs : choix explicite de l'équipe futsal sans altérer les droits d'accès d'entraîneur.
- Agenda : sélectionne les cinq équipes et affiche `Futsal · Boissy-UJ Futsal` sur les futures dates publiées.
- Awards : restent **uniquement** sur les Seniors A/B/C, sans extension automatique au futsal.

## Base Supabase
Migration `supabase/migrations/202610210019_football_futsal_teams.sql` :
- Ajoute `discipline` (valeurs `football` ou `futsal`) à `public.club_teams`.
- Conserve les UUID et liens existants pour Seniors A/B/C/Vétérans.
- Autorise `code='futsal'`, élargit la borne de tri de 4 à 5, ajoute une contrainte de cohérence discipline/code.
- Insère **une seule** fiche Boissy-UJ Futsal en D2, ordre 5, `source_kind='manual'`, sans duplication en cas de réapplication.
- Garde la politique RLS en lecture publique seulement et les droits d'écriture administratifs existants. Aucune mise à jour de rôles, licenciés, convocations, scores ou articles.
- Les affectations `staff_team_assignments` et les matchs utilisent la clé UUID d'équipe, donc les droits sportifs restent séparés entre les deux disciplines ; pas d'accès transversal implicite.

## Critères de recette
- Cinq équipes visibles dans Supabase avec répartition 4 football / 1 futsal.
- RLS activée, `anon/authenticated` sans INSERT/UPDATE/DELETE direct sur les équipes.
- Équipe Futsal D2 visible séparément dans Equipes, Notre club et Match Center.
- Sélection futsal n'affiche pas les matchs de football, et inversement.
- Tous les contenus non publiés, toutes les données personnelles et les paiements restent fermés.
- Tests automatisés GitHub verts, vérification réelle du rendu mobile à effectuer.

**Ne pas confondre :** ce lot prépare un annuaire et des formulaires, pas une connexion FFF, une saison futsal officielle synchronisée ou une validation du site à 85 %.
