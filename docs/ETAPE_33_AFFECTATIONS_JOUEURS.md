# Étape 33 — Affectations de joueurs aux équipes (administration)

## Objectif
Rendre exploitable la gestion privée des convocations développée aux étapes 31–32 : un joueur n'apparaît dans l'effectif autorisé d'un entraîneur **que lorsqu'un administrateur l'a explicitement rattaché à une équipe**.

## Ce qui est implémenté
Dans **Centre de gestion → Sport → Affectations joueurs**, un administrateur connecté avec MFA AAL2 choisit l'équipe et voit uniquement les comptes dont le rôle `player` est déjà validé (nom d'affichage minimal, sans e-mail). Il peut chercher un joueur et l'ajouter / retirer de l'équipe après confirmation. Toutes les opérations sont journalisées en base, sans créer de comptes ni accorder de nouveaux rôles.

Deux nouvelles fonctions SQL dans `supabase/migrations/202610220002_admin_player_team_memberships.sql` :
- `admin_list_team_players(p_team_id uuid)` : lecture de l'annuaire minimal de joueurs habilités et de l'état de leur appartenance à l'équipe sélectionnée, **seulement pour un admin avec MFA AAL2** ;
- `admin_set_player_team_membership(p_team_id uuid,p_player_user_id uuid,p_active boolean)` : affiliation / désaffiliation pour une équipe valide, nécessitant un rôle `player` existant, un administrateur MFA AAL2, et refusant l'affectation de son propre compte ;
- `app_private.team_membership_admin_audit` : historique privé avec rôle RLS, sans accès navigateur direct.

Les fonctions sont `SECURITY DEFINER` à chemin de recherche vide, avec vérification explicite de `auth.uid()` et `app_private.is_admin()`. Aucun rôle `anon` / `PUBLIC` n'a `EXECUTE`. Aucune permission directe nouvelle sur `app_private.team_player_memberships`.

## Dépendances
1. Un membre demande le rôle Joueur dans **Mon espace**.
2. Un autre administrateur habilité approuve le rôle.
3. Un administrateur utilise **Affectations joueurs** pour l'équipe autorisée.
4. Un éducateur qui a lui-même le rôle Entraîneur et son équipe attribuée pourra convoquer ce joueur via l'étape 32.

Les comptes qui n'ont pas de rôle `player` n'apparaissent pas dans cet éditeur. Les changements d'affiliation ne modifient pas un rôle, un mot de passe ou un compte.

## Limites et sécurité
- Seuls le nom d'affichage et l'identifiant technique nécessaire à l'opération sont utilisés : jamais de téléphone, date de naissance, e-mail, document d'identité ou données de santé.
- Cette étape n'ajoute pas encore d'interface pour attribuer une **équipe supplémentaire à un entraîneur** (l'interface de demandes de rôles demeure le canal autorisé).
- Les tests automatisés contrôlent les permissions codées, la double confirmation et l'absence d'octroi de rôle. **Les essais sur plusieurs comptes réels restent indispensables pour homologuer l'isolation entre équipes**.
- Aucun joueur fictif ou nouveau membre n'est créé lors de la migration.
