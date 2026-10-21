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

## Limites
L’authentification publique **reste désactivée** dans `auth-config.mjs`. Aucun utilisateur n’a été créé, aucun abonnement, paiement ou vote n'a été activé. Le module en production restera invisible jusqu’à la recette des comptes et de la MFA. Cette étape ne fait pas atteindre, à elle seule, les 85 % de recette globale.
