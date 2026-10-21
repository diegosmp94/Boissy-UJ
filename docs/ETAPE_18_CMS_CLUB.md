# Étape 18 — CMS sécurisé « Histoire & identité »

**État visé :** les textes `Notre club` de l’étape 16 doivent pouvoir être préparés en brouillon et publiés exclusivement par un administrateur habilité, sans ajouter de fausse histoire ni de données personnelles.

## Interface et scénarios
- Control Center public : nouveau module « Histoire & identité », **atelier de prévisualisation seulement**. Les modifications sont perdues en quittant la page et aucune lecture privée ou écriture backend n’est déclenchée.
- Espace privé `Mon espace` : le module réel sera chargé uniquement après ouverture contrôlée de l’authentification, vérification de l'identité par `auth.getUser()`, rôle `admin` effectivement attribué en base et MFA `AAL2`.
- Champs : rubrique (Histoire / Valeurs / Organisation / Projets), titre, contenu, ordre d’affichage, publication et attestation des droits. Les textes distants sont toujours rendus via `textContent` et non `innerHTML`.
- L’administrateur peut enregistrer un brouillon, publier après attestation, modifier ou retirer de publication, avec double confirmation avant une action touchant à la publication.
- Le refus serveur (droits, MFA, conflit de version, validation) n’est jamais interprété comme un succès.

## Base Supabase
Migration : `supabase/migrations/202610210018_club_identity_admin_cms.sql`.

- `public.admin_list_club_identity()` est une RPC `SECURITY DEFINER` volontairement exposée aux **seuls comptes authenticated**, avec contrôle interne du rôle admin + MFA AAL2. Elle permet aux administrateurs habilités de voir les brouillons **sans ouvrir la politique RLS publique**.
- `public.admin_save_club_identity(id,section,title,body,sort_order,publish,rights_confirmed,expected_updated_at)` applique les mêmes contrôles *en base* et valide tous les champs. Publier exige une attestation. La comparaison `updated_at` sous `FOR UPDATE` empêche d'écraser silencieusement la version d'un autre administrateur.
- Chaque modification est inscrite dans `app_private.club_identity_change_log` (RLS active, aucun droit client), avec auteur, instant, action et états précédent/suivant ; pas de suppression directe.
- Les visiteurs publics ne voient que les sections avec `published=true` grâce à la politique RLS inchangée. Les accès directs INSERT/UPDATE/DELETE à cette table restent refusés.
- Aucun article réel n’est inséré automatiquement.

**Attention :** les nouvelles fonctions SECURITY DEFINER dans `public` sont intentionnellement appelables via RPC par les membres *authentifiés*. C'est pourquoi les vérifications admin + MFA doivent rester impératives côté SQL, indépendamment de l’interface. Voir la documentation officielle : https://supabase.com/docs/guides/database/postgres/row-level-security

## Vérifications
- `npm test` : validations, droits, politique de publication, aperçus hors-ligne et versionnement.
- Supabase : rôle `anon` ne peut exécuter aucune RPC ; `authenticated` sans identité/MFA ne peut lire de brouillon ni écrire. Droits RLS inchangés, journal non accessible aux clients.
- Une recette réelle avec au moins deux administrateurs distincts, MFA activé et autorisations de contenu valides reste obligatoire avant toute ouverture des comptes.

## État de déploiement — 21 octobre 2026
- Migration **`boissy_uj_secure_club_cms_20261021` effectivement appliquée** au projet Boissy-UJ (17 migrations enregistrées).
- Aucune section ni entrée d'audit créée au déploiement : **0 contenu / 0 événement**.
- Contrôles SQL : les rôles anonymes n'ont pas d'exécution sur les RPC ; aucune écriture directe des contenus depuis `anon` ou `authenticated` ; la lecture directe du journal est refusée.
- Tests de refus des deux RPC sans utilisateur connecté : succès (erreur d'authentification attendue).
- CI du lot : **161 tests sur 161 réussis**, deux workflows GitHub verts avant intégration.
- Deux avertissements du linter Supabase concernent les nouvelles RPC `SECURITY DEFINER` exécutables par les sessions `authenticated` : c'est volontaire et **elles refusent toute requête dépourvue de rôle admin confirmé et de MFA AAL2**. Le linter ne certifie pas à lui seul la sécurité fonctionnelle.
- Test avec véritables comptes administrateur MFA AAL2 toujours à mener, aucune activation des comptes dans la préversion.

## Limites
L’authentification publique **reste désactivée** dans `auth-config.mjs`. Aucun utilisateur n’a été créé, aucun abonnement, paiement ou vote n'a été activé. Le module en production restera invisible jusqu’à la recette des comptes et de la MFA. Cette étape ne fait pas atteindre, à elle seule, les 85 % de recette globale.
