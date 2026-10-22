# Étape 35 — P2 : correction sécurisée des noms des membres

## Périmètre
Dans **Centre de gestion → Membres et rôles**, un administrateur AAL2 peut corriger le nom d'affichage d'un autre membre sans modifier son compte, son e-mail, son mot de passe, ses rôles ou ses affectations. Le formulaire apparaît directement sur chaque fiche non personnelle et exige une confirmation explicite en deux temps.

## Back-end
La migration additive `supabase/migrations/202610220005_p2_member_profile_edit.sql` crée :
- `admin_update_member_display_name(p_member_id uuid,p_display_name text)`, une RPC `SECURITY DEFINER` avec `search_path=''`, contrôlée par `auth.uid()` et `app_private.is_admin()` (MFA AAL2).
- `app_private.member_profile_change_audit` : journal privé des anciens et nouveaux noms, du compte concerné, de l'administrateur et de l'horodatage. RLS activée sans accès SELECT/INSERT aux rôles Web.
- La RPC refuse l'auto-modification, les noms vides, les noms inchangés, les caractères de contrôle, les noms de moins de 2 caractères ou de plus de 80 caractères. Les éditions concurrentes sur un profil sont sérialisées avec `FOR UPDATE`.

Les sessions anonymes ne peuvent pas exécuter la RPC et les sessions ordinaires échouent au contrôle MFA/rôle du serveur. Les noms sont rendus avec `textContent` et jamais interpolés comme HTML. Aucune clé de service n'est envoyée au navigateur.

## Activation et recette
La lecture des membres et la révocation de rôles existantes continuent de fonctionner même si la nouvelle fonction n'a pas encore été déployée. Sans la RPC, toute tentative de modification échoue sans mise à jour locale ni contournement des permissions.

La migration doit être vérifiée dans Supabase avant d'annoncer l'activation. Les tests CI vérifient les règles, les permissions codées et l'intégration front-end. La recette en navigateur exige un administrateur MFA et un compte membre distinct ; **aucun profil réel ne doit être modifié simplement pour tester la livraison**.

## Étapes P2 suivantes
Créer/archiver des comptes et envoyer des liens de récupération nécessitent un parcours administratif dédié à permissions renforcées, une politique RGPD et un backend serveur qui ne divulgue ni identifiants ni jetons. Ces opérations ne sont pas activées dans ce sprint.
