# Boissy-UJ — Étape 11 : convocations privées et bilans collectifs

## Pages du site
- Le Match Center présente les résultats cumulés par équipe depuis une vue Supabase. Seules les rencontres **terminées ET publiées** sont comptées : victoires, nuls, défaites, buts pour/contre, avec prise en compte du domicile/extérieur.
- Aucune saison ou résultat fictif, aucun classement FFF inventé.
- Lorsque l'équipe n'a pas de rencontre terminée publiée, le site affiche « Aucun résultat terminé publié » plutôt qu'une prétendue performance.
- Dans le Control Center, sous Match Center, un **aperçu des convocations** présente les trois étapes : invitation sécurisée par l'éducateur, lecture de sa propre convocation par le joueur, réponse Présent/Absent/Incertain.
- Ce panneau public est une **simulation sans joueur, nom, identifiant ou enregistrement**. Le portail de connexion reste désactivé jusqu'à la recette de sécurité.

**État confirmé :** les migrations `boissy_uj_private_callups_team_form_20261021` et `boissy_uj_callups_final_match_guard_20261021` ont été appliquées à Supabase. Les tests anonymes de lecture des bilans, de verrouillage du schéma privé et de refus des RPC sans session ont réussi. Toutes les tables de joueurs et convocations restent vides.

## Base Supabase
Migration `supabase/migrations/202610210011_callups_team_stats.sql`.
- `team_form_summary` : vue en mode `security_invoker=true` afin de respecter la RLS des matchs publiés ; lecture publique des seules sommes agrégées.
- `app_private.team_player_memberships` : présence d'un joueur dans une équipe, lié à un UUID Supabase Auth, sans adresse, téléphone, âge ou informations médicales.
- `app_private.match_callups` : invitation nominative **privée** par UUID et statut (`invited`, `confirmed`, `declined`, `unsure`, `cancelled`).
- `app_private.callup_action_audit` : journal privé des invitations et réponses. Les références aux comptes dans l'audit peuvent être mises à null à la suppression des comptes.
- Aucune politique de lecture/écriture directe des tables privées depuis le navigateur ; RLS et révocations explicites.
- `staff_set_callup` : RPC réservée à l'éducateur disposant du rôle coach ET de l'affectation active à l'équipe du match, ou à l'administrateur avec MFA AAL2 ; un joueur invité doit avoir le rôle player et appartenir activement à la même équipe.
- Migration complémentaire `202610210012_callups_final_match_guard.sql` : interdit les convocations sur matchs terminés ou annulés.
- `player_respond_callup` : le joueur répond seulement à sa propre invitation, jamais à celle d'un autre ; impossible si le match est joué/annulé ou si l'invitation est retirée.
- `player_my_callups` : renvoie seulement les invitations non annulées du compte connecté. Aucune liste publique des convocations.

## Tests et critères de mise en service
1. Migrations et droits vérifiés par Supabase avec tests transactionnels sans données persistantes.
2. Tests Node de la vue `security_invoker`, du calcul domicile/extérieur, de la cohérence des bilans et des règles de portée par équipe.
3. Plus tard : tests en conditions réelles de plusieurs comptes (coach équipe A, coach B, joueur A, joueur B, supporter, admin sans MFA, admin AAL2), avec identité et suppression d'essai, sans utiliser de dossiers de mineurs.
4. Les ateliers réels, invitations, notifications et statistiques individuelles doivent rester désactivés sur le site public tant que les conditions Auth, RGPD et MFA ne sont pas validées.
5. Définir une durée de conservation et un mécanisme d'effacement des convocations avant mise en service auprès de licenciés.
6. Aucun Stripe LIVE, aucune inscription publique, aucune donnée personnelle réelle dans le prototype.

Cette étape installe le socle technique ; elle n'ouvre pas les convocations aux utilisateurs.
