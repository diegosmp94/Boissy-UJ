# Étape 67 — Autorisations serveur et révocation des droits sur les convocations

**26 octobre 2026 — Correctif SQL ciblé, sans création de comptes ni contenu.**

## Audit de l'état initial

- Production : **20/20 tables publiques sous RLS**, aucune RPC `SECURITY DEFINER` du schéma public accessible au rôle `anon`, 30 RPC publiques `SECURITY DEFINER` encore exposées au rôle `authenticated`. Ce dernier chiffre **n'implique pas que 30 RPC sont vulnérables** : l'API de gestion exige que certaines fonctions soient appelables par les membres, puis protégées à l'intérieur.
- Les fonctions `admin_*` consultées exigent `auth.uid()` et `app_private.is_admin()` (role admin + MFA AAL2).
- **Défaut réel** : `player_my_callups()` exige le rôle `player` et une affiliation active. En revanche, `player_respond_callup(uuid,text)` ne vérifiait que l'identité Auth et l'invitation. Un joueur ayant perdu son rôle ou son affiliation pouvait encore modifier une ancienne convocation non annulée, malgré sa disparition de la liste privée.

## Correctif

`supabase/migrations/202610260005_player_callup_active_role_scope.sql` :

1. Le répondant est obligatoirement le détenteur authentifié du rôle `player` validé.
2. L'affiliation à **l'équipe du match visé** doit être active ; un match annulé ou déjà joué n'accepte pas de réponse.
3. Verrous transactionnels déterministes : rôle joueur (`FOR SHARE`), affiliation (`FOR SHARE`), propre convocation (`FOR UPDATE`). Le retrait concurrent d'un rôle ou d'une affiliation ne peut pas être ignoré entre la vérification des droits et l'enregistrement.
4. Les seules réponses autorisées sont `confirmed`, `declined` et `unsure` ; une invitation `cancelled` est toujours refusée.
5. Maintien du journal privé, de `search_path=''`, de la signature de RPC existante et des privilèges **`EXECUTE authenticated` uniquement**. Pas de nouvelle table, politique RLS, utilisateur, rôle ou contenu.
6. Ajout de contrôles d'inspection dans `scripts/db-p1-permissions-readonly-audit.sql` et d'assertions de non-régression dans les tests Node.

## Activation et limites

L'analyse des fonctions serveur avec `pg_proc` est **statique** : elle vérifie des signes de présence de gardes sans reproduire les scénarios complets de sessions. La recette avec plusieurs comptes réels et révocations concurrentes demeure séparée.

L'alerte Supabase `authenticated_security_definer_function_executable` reste pertinente pour la revue des autres fonctions. Révoquer `EXECUTE` à `authenticated` sur toutes les RPC empêcherait les écrans métier de fonctionner. Il faut examiner la nécessité et l'autorisation de chacune, pas effacer globalement le warning.

Les autres durcissements transversaux restent à poursuivre au titre de l'étape 67 ; ce lot clôt spécifiquement la faille de réponse à une convocation après retrait de rôle/équipe.

Documentation des risques : https://supabase.com/docs/guides/observability/advisors?queryGroups=lint&lint=0029_authenticated_security_definer_function_executable
