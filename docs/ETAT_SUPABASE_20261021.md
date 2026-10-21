# État Supabase — Boissy-UJ — 21 octobre 2026

Projet : `dahzewvbybujqhogumte` (Boissy-UJ, eu-west-2).
Ce document décrit **l'état effectivement vérifié dans Supabase**, et remplace les mentions historiques « migration non appliquée » des documents d'étapes 4, 5, 6 et 8.

## Migrations appliquées et confirmées

1. `boissy_uj_auth_foundation_20261021` : profils et rôles, RLS, rôle supporter initial.
2. `boissy_uj_admin_mfa_gate_20261021` : contrôles administrateur avec JWT MFA AAL2.
3. `boissy_uj_sport_public_v1_20261021` : 4 équipes publiques, matchs avec publication explicite et RLS.
4. `boissy_uj_news_public_v1_20261021` : actualités publiques publiées, droits à l'image, RLS.
5. `boissy_uj_events_public_v1_20261021` : calendrier public d'événements avec RLS.
6. `boissy_uj_staff_content_workflows_20261021` : affectations coach/équipe, historique des articles et fonction SQL de publication supervisée.
7. `boissy_uj_security_indexes_20261021` : révocation des droits d'exécution de la fonction événementielle `public.rls_auto_enable()` aux rôles `anon` et `authenticated`; six index de FK ; maintien des catalogues en lecture seule.
8. `boissy_uj_news_column_privacy_20261021` : lecture des colonnes nécessaires aux actualités publiques, sans exposer `author_user_id` ni les horodatages techniques.

## Migrations complémentaires appliquées le 21 octobre

9. `boissy_uj_seasons_staff_matches_20261021` : registre des saisons, affectation des rencontres, sauvegarde sécurisée par rôle/équipe et audit privé.
10. `boissy_uj_admin_season_management_20261021` : création et modification des saisons réservées à l'administration MFA AAL2, journal privé et unicité de la saison active.
11. `boissy_uj_private_callups_team_form_20261021` : bilans publics agrégés par équipe, affiliations joueur-équipe privées, convocations et réponses personnelles protégées.
12. `boissy_uj_callups_final_match_guard_20261021` : blocage des invitations pour rencontres jouées ou annulées.

**Contrôles complémentaires :** `club_seasons` et `app_private.season_change_log` ont RLS activée ; droits INSERT/UPDATE absents pour les clients ordinaires, audit inaccessible ; RPC `admin_save_season` refusée à `anon` et bloquée sans session `auth.uid()`. Zéro saison, zéro rencontre et zéro trace d'audit créée durant le test (transaction annulée). Les parcours réellement authentifiés n'ont pas encore été exécutés.

**Contrôles convocations du 21 octobre :** test sous rôle `anon` validé pour la vue `team_form_summary` (4 lignes, 0 résultat) ; schéma `app_private` interdit aux visiteurs et fonctions d'invitation inaccessibles. Test sous rôle `authenticated` sans session réelle : les RPC d'invitation et de réponse rejettent l'appel avec SQLSTATE `28000`. Aucun joueur, convocation ni historique créé. Les tests avec plusieurs identités réelles restent indispensables.

## État des données

- `public.club_teams` : **4 équipes réelles comme catégories**, A D3 / B D4 / C amicaux / Vétérans D3.
- `public.matches`, `public.news_posts`, `public.club_events` : **0 entrée** au contrôle ; aucun score, article ou événement fictif.
- `public.profiles`, `public.user_roles`, `public.staff_team_assignments`, `public.staff_news_audit` : **0 entrée** au contrôle.
- Aucun compte créé, aucune affectation admin/coach, aucun billet, aucun paiement Stripe.

## Résultats sécurité

- RLS activée sur les tables applicatives et privées inspectées, avec refus d'accès direct aux convocations, affiliations et journaux d'audit.
- Lecture anonyme sur les quatre équipes et uniquement sur matchs/actualités/événements explicitement publiés.
- Aucun INSERT / UPDATE / DELETE permis au navigateur `anon` ou `authenticated` sur les catalogues.
- **Tests SQL simulant les rôles** `anon` et `authenticated` : lecture des quatre équipes confirmée, accès aux écritures et à l'audit refusé, appel du RPC sans `auth.uid()` rejeté avec SQLSTATE `28000`. Ces contrôles ne remplacent pas les tests avec des sessions réelles.
- Lecture des colonnes d'article (`title`, `body`, `status`) autorisée ; lecture de l'identifiant de l'auteur et des horodatages internes refusée, vérification `has_column_privilege` réussie.
- Le journal `staff_news_audit` est volontairement inaccessible aux comptes ordinaires (RLS active sans politique cliente ; linter Supabase INFO).
- `public.rls_auto_enable()` n'est plus exécutable par `anon` et `authenticated` (alerte de sécurité éliminée).
- `public.staff_save_news_article(...)` reste un RPC `SECURITY DEFINER` exécutable par `authenticated` et **refuse par code** toute session absente, tout coach non autorisé et tout admin sans MFA AAL2. Le linter signale ce point en WARN ; il s'agit d'une **exception intentionnelle à retester en dynamique**. Voir la documentation Supabase :
  https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- L'alerte d'index de FK manquants est corrigée ; les avis « unused indexes » sont attendus sur ces tables actuellement vides.

## Encore nécessaire avant de considérer les fonctionnalités opérationnelles

1. Vérifier le comportement REST depuis l'hébergement GitHub Pages et contrôler l'absence d'erreurs CORS / politiques / CDN, sur Safari et ordinateur.
2. Régler Supabase Auth (URL officielle et redirections, confirmation email, récupération, sessions) ; `auth-config.mjs` sur le site public contient volontairement `enabled: false`.
3. Tester la sécurité RLS/RPC avec plusieurs identités d'essai autorisées (supporter, coach équipe A, coach équipe B, admin sans MFA, admin AAL2), sans exposer de données personnelles réelles.
4. Construire l'éditeur qui sauvegarde réellement les données, l'attribution sécurisée des rôles, l'export des audits et le parcours de révocation.
5. Finaliser les informations juridiques, RGPD et consentements mineurs.
6. Ne pas activer Stripe LIVE sans les validations prévues.

**Note :** migrations réellement installées ≠ recette de mise en production. Les fonctions de gestion restent en prévisualisation front-end.
