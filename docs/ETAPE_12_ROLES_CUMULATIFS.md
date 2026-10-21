# Étape 12 — Demandes et validation des rôles cumulés

## Ce qui est développé

Le **cahier des charges V1.1** autorise le cumul indépendant des rôles joueur, entraîneur, administrateur, par deux ou par trois. La demande et l'approbation sont distinctes : aucun droit nouveau n'est acquis avant l'approbation d'un autre administrateur avec MFA AAL2.

Migration : `supabase/migrations/202610210013_cumulative_roles_approvals.sql`.

- `public.role_requests` : demandes `player`, `coach` ou `admin`, statut `pending/approved/rejected/cancelled`, destinataire et éventuelle équipe. Une demande d'entraîneur doit désigner une équipe. Les requêtes déjà accordées et les doublons en attente sont bloqués.
- La lecture des demandes est limitée par RLS au titulaire ou à un administrateur MFA AAL2, avec **zéro permission client d'écriture**.
- `public.member_request_role` : propose le rôle ou une équipe entraîneur au nom **exclusif du compte connecté** ; n'attribue aucun rôle.
- `public.admin_decide_role_request` : décision par admin MFA AAL2 **différent du demandeur**, prend un verrou de demande, attribue le rôle demandé **sans supprimer les rôles déjà détenus**, réactive l'affectation précise de l'entraîneur et enregistre la décision. Refus sans attribution.
- `public.admin_revoke_member_role` : retrait indépendant d'un rôle ou d'une seule affectation entraîneur ; interdit à l'admin de se retirer un rôle lui-même et protège le dernier administrateur restant. Une révocation du rôle joueur désactive ses affectations et ses convocations.
- `app_private.role_change_audit` : journal de demandes, approbations, refus, révocations d'équipes et révocations de rôles. Aucune permission client ; RLS activée.
- Durcissement de `player_my_callups` : une personne doit encore posséder le rôle joueur et être membre actif de son équipe pour voir ses anciennes convocations.

## Site

- Control Center, « Utilisateurs & rôles » : nouvelle **prévisualisation locale** décrivant le parcours, ses étapes, les rôles déjà détenus et un deuxième/troisième rôle possible. Aucun compte, demande ou rôle réel n'est chargé dans cette prévisualisation publique.
- « Mon espace », **une fois l'authentification homologuée et activée** : formulaire préparé pour déposer un rôle/une équipe via la RPC sécurisée et consulter seulement les demandes du titulaire. Il demeure inactif tant que `auth-config.mjs` contient `enabled: false`.
- L'interface d'approbation administrative réelle et la configuration MFA doivent rester non exposées tant qu'une véritable vérification de la session et des permissions n'a pas été reçue par les tests de sécurité.

## Tests avant ouverture réelle

1. Vérifier dans Supabase les permissions `anon`/`authenticated`, les protections du journal et les refus d'appels sans session.
2. Tester avec un compte joueur, entraîneur, un administrateur MFA AAL2 et **un autre administrateur distinct** : demande, approbation, refus, suppression indépendante, ajout d'une équipe et triple rôle.
3. Empêcher l'auto-approbation et la suppression du dernier administrateur actif, y compris en concurrence.
4. Tester le cas d'un joueur révoqué, la disparition de ses convocations et la révocation coach qui garde les droits admin ou joueur.
5. Créer le **premier administrateur uniquement par une procédure d'amorçage séparée et auditée** ; il n'existe volontairement aucune fonction de libre-service pour cela.
6. Vérifier protection des mineurs, confidentialité et conservation des historiques avant invitations réelles.
7. Aucune donnée de production créée par la migration. Aucun paiement LIVE activé.

**Statut à compléter après CI et application :** la migration et les tests SQL pourront être signalés comme terminés. Les **tests E2E avec sessions réelles** restent nécessaires avant d'activer les outils administratifs.
