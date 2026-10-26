# Étape 67 — Revue complète des RPC sensibles et durcissement des révocations

**26 octobre 2026** · Développement du cahier des charges V1.5 · Exclut la saisie de contenu et la recette humaine à sept comptes.

## Revue des 30 RPC réellement exécutables par `authenticated`

Métadonnées consultées sur Supabase production via `pg_proc` : **30 fonctions `SECURITY DEFINER`**, toutes avec `SET search_path` fixé, accès `anon`/PUBLIC refusé et accès `authenticated` accordé. Elles ont toutes une référence explicite à l'identité `auth.uid()`. La liste est reproductible par **`scripts/db-step67-rpc-readonly-audit.sql`** ; elle ne consulte aucune donnée d'utilisateur ni ne renvoie de corps SQL.

| Famille | Noms / inspection | Fonctions |
|---|---|---:|
| Administration | `admin_decide_role_request`, `admin_list_club_identity`, `admin_list_free_events`, `admin_list_league_standings`, `admin_list_management_matches`, `admin_list_management_news`, `admin_list_management_seasons`, `admin_list_team_coaches`, `admin_list_team_players`, `admin_list_team_public_people`, `admin_revoke_member_role`, `admin_save_club_identity`, `admin_save_free_event`, `admin_save_league_standings`, `admin_save_season`, `admin_save_team_public_person`, `admin_set_coach_team_assignment`, `admin_set_match_competition`, `admin_set_player_team_membership`, `admin_update_member_display_name`. Les 20 fonctions référencent `app_private.is_admin()`, qui vérifie rôle `admin` et MFA AAL2. | **20** |
| Entraîneur et sport | `staff_list_affiliated_players`, `staff_list_match_roster`, `staff_list_squad_fixtures`, `staff_save_match`, `staff_save_news_article`, `staff_set_affiliated_player_position`, `staff_set_callup`. Chacune croise rôle `coach`, affectation d'équipe active et alternative admin sous MFA AAL2. | **7** |
| Joueur | `player_my_callups`, `player_respond_callup`. Contrôles du rôle `player` et du périmètre personnel ; la réponse possède le verrouillage de rôle et d'affiliation ajouté au premier lot #127. | **2** |
| Demandeur | `member_request_role`. Ne confère pas de rôle actif : enregistre une demande liée à `auth.uid()` dans une table privée de modifications et dans `role_requests`, avec anti-doublon en base. | **1** |

Ce sont des **constats sur les gardes du code et les droits SQL**, pas une attestation de l'absence de toutes les vulnérabilités : les arguments, les changements d'état, le RLS et les sessions JWT réelles restent à recetter sur un environnement isolé. Les résultats de la commande SQL sont une photographie, pas un monitoring continu.

## Correctifs identifiés

**Lot #127, déjà appliqué** : `player_respond_callup` exige un rôle Joueur actif, l'affiliation active à l'équipe et la propre invitation non annulée, avec verrouillage de la transaction.

**Second lot — `supabase/migrations/202610260007_rpc_revocation_consistency.sql`** : les contrôles de rôle ou d'affectation existants pouvaient être vrais au début d'une requête, puis révoqués avant l'écriture. Cinq fonctions ont été consolidées :

- `admin_set_coach_team_assignment` verrouille le rôle `coach` approuvé du bénéficiaire avant d'attribuer ou retirer une équipe.
- `admin_set_player_team_membership` verrouille le rôle `player` approuvé du bénéficiaire avant toute modification de rattachement.
- `staff_save_match` maintient le rôle administrateur AAL2 ou le double droit entraîneur+équipe active pendant la création/modification d'un match.
- `staff_save_news_article` protège pareillement les droits de publication pour l'équipe concernée.
- `staff_set_callup` maintient les droits du staff, le rôle `player` et l'affiliation du joueur, ainsi que la disponibilité du match, avant invitation ou annulation.

Les verrous suivent globalement l'ordre **rôle → affectation / affiliation → match / article / convocation** pour limiter les interblocages. Aucun utilisateur ni équipe n'est créé ; aucun privilège supplémentaire n'est accordé. Les signatures RPC, `search_path=''`, les permissions `EXECUTE authenticated` et les journaux d'audit existants sont conservés.

## Acceptation technique de l'étape

- [x] Inventaire complet des 30 RPC exposées et classification par usage.
- [x] Vérification de `EXECUTE anon`, des contrôles MFA admin et des périmètres staff / joueur.
- [x] Correction #127 appliquée et contrôlée côté schéma production.
- [x] Second correctif et tests de non-régression préparés dans Git.
- [x] Seconde migration appliquée à Supabase et contrôlée : cinq fonctions avec verrous attendus, 0 accès anonyme, 20/20 RLS, 20/20 gardes MFA admin.
- [x] Contrôles de la branche verts ; cette documentation est intégrée à `main` avec le correctif et le contrôle Pages après fusion de la PR.

La migration `rpc_revocation_consistency_20261026` a été confirmée dans l'historique Supabase. Les vérifications directes comptent **30/30 RPC avec structure conforme aux règles statiques** (20 admin, 7 staff, 2 player, 1 member), **0 exposée à anon**, et toujours **20/20 tables publiques avec RLS**. Le résultat des jobs de publication `main` reste consultable dans GitHub Actions. **L'étape 67 de développement est clôturée**, hors recette réelle multi-comptes distincte. La recette réelle de sept comptes MFA/RLS, le pentest de logique métier et la restauration restent des responsabilités hors du périmètre demandé.

### Warnings Supabase attendus / non contournés

- `authenticated_security_definer_function_executable` (30) : ces fonctions sont une interface métier voulue pour les comptes connectés, avec restrictions internes ; le warning ne peut être supprimé par une révocation globale sans casser le site. [Règle de l'advisor](https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0029_authenticated_security_definer_function_executable).
- `auth_leaked_password_protection` : option de protection Auth à activer depuis les réglages compatibles du projet par un responsable habilité, hors modification du code métier.
- `rls_enabled_no_policy` : avis informatif concernant principalement les tables `app_private` fermées à l'accès direct, pas la preuve d'une exposition.

**Aucun service Stripe, vote, billetterie, média ou SEO n'est activé dans ce lot.**
