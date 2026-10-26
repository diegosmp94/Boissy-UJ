# Étape 74 — Convocations et feuilles de match privées

**26 octobre 2026 — Développement technique uniquement.** Aucun joueur, match, invitation ou résultat réel n'est créé.

## Audit de la version de production

Les fonctions existantes couvraient déjà les droits essentiels : `staff_list_squad_fixtures` (rencontres d'une équipe sous droits entraîneur), `staff_list_match_roster` (seuls joueurs avec rôle Joueur et affiliation active), `staff_set_callup` (invitation/annulation, équipe, rôle et locks), `player_my_callups` (uniquement ses propres invitations) et `player_respond_callup` (Présent/Absent/Incertain après validation du rôle et de l'affiliation). Les écritures alimentent `app_private.callup_action_audit` et restent privées. Les tables `app_private` ne sont pas directement exposées par l'API publique.

Deux lacunes identifiées : une convocation d'un match terminé ou annulé pouvait encore figurer dans la **liste personnelle** malgré l'impossibilité de répondre côté serveur ; aucune feuille de match consolidée ne rassemblait les joueurs convoqués avec poste/numéro et réponses. Une réponse concurrente à une clôture de match ne verrouillait pas explicitement la ligne de match jusqu'à son commit.

## Compléments réalisés

1. **`staff_list_match_sheet(p_match_id)`** : nouvelle RPC privée `SECURITY DEFINER SET search_path=''`, invoquable par `authenticated` mais vérifiant en son sein soit un administrateur MFA AAL2, soit un entraîneur à rôle validé **et affectation active à l'équipe du match**. Requête limitée à la rencontre en état `scheduled` ou `postponed`, au plus 150 joueurs réellement convoqués et toujours membres actifs de l'équipe avec rôle Joueur validé. Renvoie nom affiché, poste/numéro privés (s'ils existent), état de réponse, équipe/rencontre/date ; jamais email, téléphone, données de naissance, ni membre non convié.
2. **`player_my_callups()`** : ne présente plus les invitations non annulées d'une rencontre terminée ou annulée. Les réponses et l'historique restent stockés, sans exposition dans l'espace de réponse aux convocations en cours.
3. **`player_respond_callup`** : verrou de lecture `FOR SHARE` sur le **match courant** entre le verrou d'affiliation et celui de la convocation ; si le match vient d'être terminé ou annulé, la transaction refuse d'enregistrer la réponse. L'ordre est rôle → affiliation → match → convocation.
4. **Interface Entraîneur** : bouton « Afficher la feuille de match privée » sur la rencontre active. La lecture n'est déclenchée qu'au clic, après vérification de l'identité et de l'affectation ; affichage read-only avec présents, absents, incertains et réponses attendues. Fermer ou changer d'équipe/rencontre efface la feuille, et les réponses réseau tardives sont ignorées.
5. **Interface Joueur** : exclusion côté backend des rencontres finalisées ; le formulaire de réponse désactive les soumissions concurrentes et restaure les boutons en fonction de la valeur du statut (pas d'un libellé traduit).
6. **Mobile et tests** : `private-match-sheet.css`, modèles purs `private-match-sheet-rules.mjs`, sept contrôles automatisés ciblant la confidentialité, les droits, les verrous, l'interface et les réponses.

## Sécurité et limites

Les anciens journaux de convocations, fonctions de gestion et index restent en place ; la nouvelle feuille n'est **pas** une page publique, n'est pas indexée et n'est pas sauvegardée dans le navigateur. Aucun PDF nominatif ni export public n'est généré, notamment pour les joueurs mineurs.

La migration `supabase/migrations/202610260013_private_match_sheets.sql` ne crée aucune table, aucun compte, aucun match et aucune donnée de convocation. Les trois RPC ont seulement `EXECUTE authenticated` et contrôlent l'identité/les droits de manière stricte. La publication du site n'ouvre pas les endpoints à `anon`.

Les contrôles de présence dans les fonctions, les tests automatisés et la vérification Supabase sont des recettes **techniques** ; tester des sessions de joueurs et entraîneurs avec autorisations opposées, un match basculant en terminé en plein appel et des scénarios de déconnexion nécessite une homologation multi-comptes distincte.

**Prochaine étape 75** : synchronisation des vues publiques (accueil, Match Center, calendrier et fiches équipe) uniquement depuis les matchs autorisés et publiés.
