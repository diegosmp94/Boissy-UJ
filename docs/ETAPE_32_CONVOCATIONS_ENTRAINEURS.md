# Étape 32 — Convocations privées des entraîneurs

## Interface
Dans **Mon espace → Entraîneur**, après validation du rôle `coach` et des équipes réellement attribuées, la nouvelle section **Convocations de mes équipes** permet de :
- choisir uniquement une des équipes autorisées ;
- sélectionner une rencontre prévue/reportée, y compris un brouillon créé précédemment ;
- consulter **les joueurs réellement rattachés** à cette équipe avec rôle `player` validé ;
- inviter ou annuler une convocation avec une double confirmation ;
- relire après action les réponses `En attente`, `Présent`, `Absent`, `Incertain` ou `Annulée`.

Aucun joueur, nom, numéro de licence ou match fictif n'est inséré pour rendre l'interface plus remplie. Les réponses des joueurs restent privées.

## SQL à appliquer avant recette de la fonctionnalité
Migration additive **`supabase/migrations/202610220001_coach_private_callups.sql`** :
- `staff_list_squad_fixtures(p_team_id uuid)` : liste limitée des rencontres `scheduled` ou `postponed` de l'équipe autorisée, brouillons compris. Les rencontres `played` et `cancelled` sont volontairement exclues ;
- `staff_list_match_roster(p_match_id uuid)` : identifiant interne joueur, nom d'affichage minimal et statut de réponse. Aucun e-mail, téléphone, donnée de santé ou détail de licence ;
- deux RPC `SECURITY DEFINER` à `search_path=''`, gardées côté serveur par `auth.uid()` + admin AAL2 ou entraîneur avec rôle `coach` et **affectation active sur l'équipe demandée**. `anon` et `PUBLIC` ne disposent pas d'EXECUTE ;
- les fonctions existantes `staff_set_callup`, `player_my_callups` et `player_respond_callup` restent **seules responsables des changements et de leur historique**, aucune RLS n'est assouplie.

Les politiques actuelles de la base interdisent un SELECT direct sur l'effectif privé ; le navigateur passe exclusivement par ces RPC vérifiées. Le résultat est borné à 100 rencontres et 150 joueurs au plus pour chaque équipe/rencontre.

## Repli en cas de migration manquante
Si la migration n'est pas déployée ou si une vérification de droits échoue, l'interface affiche un message explicite et **aucun bouton d'invitation actif**. Les fonctionnalités joueur et le formulaire de brouillon entraîneur de l'étape 31 ne sont pas bloqués.

## Dépendances métier
Les joueurs doivent préalablement disposer du rôle `player` et d'une inscription active dans `app_private.team_player_memberships` ; les entraîneurs doivent avoir le rôle `coach` et une affectation active dans `public.staff_team_assignments`. L'administration de ces affiliations n'est pas ouverte aux éducateurs par cette version ; une interface administrateur sécurisée distincte est à développer.

## Vérification
Huit tests spécifiques plus suite Node complète et deux GitHub Actions. La sécurité RLS/RPC doit être testée avec de vraies identités coach A, coach B, joueur A, supporter, admin AAL1 et admin AAL2 avant de valider le fonctionnement en situation réelle. Aucun appel de test ne doit modifier une convocation appartenant à une vraie personne.
