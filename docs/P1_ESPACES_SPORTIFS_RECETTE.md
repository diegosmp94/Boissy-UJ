# P1 — Clôture du développement Joueur / Entraîneur (étapes 31 à 34)

## Fonctionnel livré dans les étapes 31 à 34

| Besoin prioritaire du cahier des charges | État du code | Autorisation |
|---|---|---|
| Compte multi-rôles : Joueur, Entraîneur, Administrateur | Livré | Rôles persistés dans `user_roles`; bascule de contexte dans Mon espace |
| Demande d'un rôle supplémentaire | Livré | RPC `member_request_role`; rôle non actif avant approbation |
| Approbation/refus administratif | Livré | RPC `admin_decide_role_request`; autre administrateur + MFA AAL2 |
| Joueur : voir et répondre à ses convocations | Livré | RPC `player_my_callups` + `player_respond_callup`, scope utilisateur |
| Entraîneur : voir ses équipes et matchs | Livré | RLS `staff_team_assignments`; seules équipes actives et matchs publiés |
| Entraîneur : créer un match en brouillon | Livré | `staff_save_match` contrôle rôle et équipe, `published=false` |
| Entraîneur : inviter/annuler les convocations | Livré | RPC privées `staff_list_squad_fixtures`, `staff_list_match_roster`, `staff_set_callup` |
| Administrateur : associer un joueur à une équipe | Livré | RPC `admin_list_team_players` et `admin_set_player_team_membership`; MFA AAL2 |
| **Administrateur : associer un entraîneur à une équipe** | **Livré à l'étape 34** | **RPC `admin_list_team_coaches` et `admin_set_coach_team_assignment`; MFA AAL2** |
| Retrait d'un rôle/équipe sans perte des autres rôles | Livré | RPC `admin_revoke_member_role` ; scope au rôle ou à l'équipe |

## Étape 34 — Affectations entraîneurs

Le module **Centre de gestion → Sport → Affectations entraîneurs** permet de choisir l'équipe, de chercher les comptes ayant **déjà** le rôle Entraîneur validé, puis d'activer ou de retirer une affectation avec une seconde confirmation. Il ne modifie pas le rôle ou les identifiants du membre.

Nouvelle migration additive `supabase/migrations/202610220003_admin_coach_team_assignments.sql` :
- `admin_list_team_coaches(p_team_id)` : noms d'affichage minimaux et statut d'affectation, maximum 250 comptes, aucun e-mail ou coordonnée.
- `admin_set_coach_team_assignment(p_team_id,p_coach_user_id,p_active)` : rôle Entraîneur préalable, refus d'auto-affectation, équipe valide, verrou contre les changements concurrents, journalisation.
- `app_private.coach_team_assignment_audit` : journal sous RLS, non accessible par lecture directe depuis un navigateur.
- Les fonctions exigent **un compte administrateur avec MFA AAL2**, la présence de `auth.uid()` et l'absence de droits d'exécution anonymes. Aucun `GRANT` en écriture sur les tables privées.

## Activation de l'étape 34 — prérequis à l'utilisation

Le code applicatif peut être intégré sans altérer les autres écrans. Tant que les RPC `admin_list_team_coaches(uuid)` et `admin_set_coach_team_assignment(uuid,uuid,boolean)` ne sont pas en base, **Affectations entraîneurs reste masqué** grâce à une vérification réelle de la lecture pour une équipe autorisée. Le seul déploiement GitHub ne signifie pas que les affectations sont utilisables.

Pour l'activer, exécuter la migration revue dans `supabase/migrations/202610220003_admin_coach_team_assignments.sql` via [SQL Editor Supabase](https://supabase.com/dashboard/project/dahzewvbybujqhogumte/sql/new), puis contrôler les droits EXECUTE et RLS avant d'essayer avec un vrai compte coach validé. Aucune opération de création de compte ou affectation de joueur n'est requise au déploiement.

## Recette automatisée et tests réels

Les tests Node couvrent notamment l'absence d'élévation de rôle côté client/serveur, l'interdiction d'auto-affectation, les gardes MFA, les restrictions des équipes privées, l'audit, le cumul des rôles et les formulaires de convocation. Les tests GitHub ne remplacent pas une session réelle de chaque catégorie.

**Scénarios de recette navigateur encore nécessaires**, lorsqu'il existera des comptes de test approuvés :
1. Compte Supporter : accès refusé aux convocations et aux affectations.
2. Joueur A membre de l'équipe A : ne voit que ses propres invitations, peut répondre sans lire celles du joueur B.
3. Entraîneur A affecté à A : voit les joueurs de A, sans lire ceux de B ; prépare un brouillon pour A uniquement.
4. Entraîneur B affecté à B : accès indépendant de A.
5. Administrateur AAL1 : accès aux outils AAL2 refusé ; AAL2 : lecture et changement autorisés sur un autre compte, jamais soi-même.
6. Compte Joueur + Entraîneur + Admin : conserve les trois contextes sans autoriser une écriture hors scope.
7. Révocation de l'équipe A à l'entraîneur : bloque les futures convocations A sans altérer ses autres équipes/son rôle.
8. Révocation du rôle Joueur : les affiliations sont désactivées et les invitations deviennent inactives.

Aucune donnée factice ou rôle supplémentaire n'est introduit par ce sprint. La validation des règles SQL et des workflows automatisés ne suffit **pas** pour déclarer la recette multi-utilisateurs achevée : celle-ci doit se faire avec de vrais comptes de test consentants.

## Étape 51 — Recette RLS multi-comptes durcie

Le script `scripts/real-permissions-smoke.mjs` contrôle à présent les quatre tables sensibles `profiles`, `user_roles`, `role_requests` et `staff_team_assignments` par des requêtes isolées entre comptes, et exige des personnes distinctes, même si deux identifiants différents avaient été fournis pour la même personne. Il refuse tout lancement avec les fixtures de convocations manquantes, afin d'empêcher un rapport artificiellement « vert » sans vérification joueur A/B.

**L'exécution avec sept comptes et deux convocations réelles sur un Supabase de staging isolé est toujours nécessaire.** Ni création de comptes, ni mutation métier, ni test intrusif en production n'a eu lieu. Voir [Étape 51](ETAPE_51_RECETTE_RLS_MULTICOMPTES.md).

## Hors P1
Gestion avancée des médias, Premium, dons, billetterie et paramétrage global du site relèvent des priorités suivantes et ne sont pas activés par cette livraison.
