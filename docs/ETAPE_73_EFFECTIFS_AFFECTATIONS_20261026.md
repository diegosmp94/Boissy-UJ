# Étape 73 — Effectifs, affiliations multi-équipes et historique privé

**26 octobre 2026 — Développement technique, sans création de joueur réel, d'affiliation ni de numéro.**

## Audit de départ

Le club possède déjà une implémentation sécurisée des effectifs :
- Appartenance Joueur ↔ Équipe : `app_private.team_player_memberships`, clé composite `(team_id,player_user_id)`. Le même joueur peut donc être affilié à **plusieurs équipes distinctes**, avec validation administrateur MFA AAL2 et historique privé.
- Poste et numéro : `app_private.team_player_positions`, groupes gardien/défenseur/milieu/attaquant, numéro 1–99. L'index unique **`(team_id,shirt_number)`** empêche deux joueurs actifs d'une même équipe de se partager le numéro. Il ne doit pas empêcher le n° 8 d'exister dans deux équipes différentes.
- Une sortie d'effectif libère le poste/numéro par le déclencheur `team_membership_release_jersey` et conserve un historique privé. Les modifications optimistes sont contrôlées par `updated_at` ; l'écriture est limitée aux entraîneurs effectivement affectés à l'équipe ou aux administrateurs MFA AAL2.
- Les trois tables de rattachement, de postes et d'audit sont privées, sous RLS et sans permission `SELECT` pour `anon` ou `authenticated`.
- **Lacune** : le gestionnaire admin listait les joueurs une équipe après l'autre, sans vue des autres équipes ni consultation directe des mouvements d'affiliation, de numéro et de libération.

## Correction livrée

La migration `202610260012_player_team_affiliations_history.sql` ajoute deux fonctions `SECURITY DEFINER SET search_path=''`, accessibles uniquement via `EXECUTE authenticated` et une **validation interne de l'administrateur MFA AAL2** :

1. `admin_player_team_overview(p_player_user_id)` : retourne au plus 50 rattachements historiques pour **un seul membre**, avec équipe, statut actif/retiré et, seulement si actif, poste et numéro actuellement affectés. Le rôle et les équipes ne sont jamais publiés par cet appel.
2. `admin_player_assignment_history(p_player_user_id)` : retourne au plus 50 événements les plus récents dans l'ordre chronologique inverse. Les sources sont les audits privés d'attribution/retrait de l'équipe, de modification des postes et numéros, et de libération d'un maillot. Ni email ni identifiants des personnes ayant opéré les changements ne sont transmis.
3. Aucune table, aucune politique RLS, aucun rôle de compte et aucun membre n'est créé ou modifié par la migration. Les numéros restent uniques **par équipe**, non globalement.

L'interface `Administration → Affectation des joueurs aux équipes` propose **« Équipes et historique »** pour chaque joueur déjà éligible. Le chargement reste volontairement **à la demande** (aucune requête de masse sur les historiques), exige une nouvelle vérification du MFA et abandonne toute réponse arrivée après un changement d'équipe ou de session. Les historiques ne sont pas affichés dans les pages publiques ni stockés dans le navigateur.

Le rendu mobile est dans `admin-player-history.css`. Les tests automatisés `tests/step73-private-affiliations-history.test.mjs` couvrent notamment les doubles affectations, le contrôle des rôles, l'accès privé, l'historique et les contraintes de numéro préexistantes.

## Hypothèses et limites

- Les droits joueurs et entraîneurs restent cumulatifs **uniquement après validations administrateur** (étapes 67–68) ; cette étape n'attribue aucun rôle et ne permet aucune auto-affectation.
- Aucun numéro et poste n'est publié automatiquement. La publication d'une fiche publique de joueur nécessite toujours un consentement explicite et une validation éditoriale séparée, notamment pour les mineurs.
- La vue présente les 50 événements les plus récents et non une restitution exhaustive si le joueur possède davantage d'actions historiques.
- Aucun essai avec des identités réelles / plusieurs comptes n'est prétendu. La certification correspond aux contrôles du code, de la base et de la CI ; la recette humaine est hors du périmètre du développement convenu.

**Étape 74 à suivre :** convocations et feuilles de match privées, à partir des joueurs réellement affiliés et autorisés.
