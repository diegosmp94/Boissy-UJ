# Étape 31 — Espaces personnels Joueur et Entraîneur

## Livré
Dans **Mon espace**, après authentification et lecture des rôles réels dans `public.user_roles`, l'utilisateur peut passer entre **Joueur**, **Entraîneur** et **Administration** si ces rôles lui ont été effectivement accordés. Le rôle `supporter` seul ne donne pas accès à ces outils.

### Joueur
- Lister **ses propres convocations** grâce à la RPC déjà en production `player_my_callups()`. Ni la table `app_private.match_callups` ni l'effectif privé de l'équipe ne sont exposés au front-end.
- Afficher adversaire, équipe, date et état de réponse sans données personnelles des autres joueurs.
- Répondre **Présent**, **Absent** ou **Incertain** via `player_respond_callup(p_match_id,p_response)`. Un contrôle de la session et du rôle précède l'appel ; le serveur vérifie le propriétaire de la convocation et journalise l'action.
- Actualiser depuis le serveur ; si aucune convocation n'existe, un message explicite apparaît. Ne crée aucune convocation fictive.

### Entraîneur
- Récupérer exclusivement ses affectations actives via la RLS `public.staff_team_assignments`, puis afficher les équipes correspondantes.
- Consulter seulement les rencontres **publiées** de ses équipes autorisées, sans ouvrir les brouillons d'une autre équipe.
- Préparer une nouvelle rencontre par `staff_save_match` : équipe attribuée, adversaire, horaire, lieu facultatif, domicile/extérieur. Le payload force `p_publish:false`, `p_source_kind:'manual'`, `p_match_status:'scheduled'` et aucun score, et reste soumis au contrôle serveur et à l'audit du club.
- Vérifier les affectations à nouveau juste avant tout enregistrement : le choix d'onglet ne remplace jamais les permissions serveur.
- La **sélection de joueurs et la gestion de convocations par l'éducateur** ne sont pas activées dans cette étape : elles nécessitent une RPC privée pour le listing des licenciés autorisés par équipe, avec protection des données.

## Règles d'isolation
- Chaque chargement refait `auth.getUser()` + lecture de `user_roles`. Aucune permission ne provient de `user_metadata`, du titre d'une page ou d'un paramètre d'URL.
- Chaque onglet dispose de son propre conteneur détachable ; les anciennes réponses asynchrones ne peuvent pas repeindre le nouvel onglet après un changement de contexte.
- Un administrateur qui possède aussi `player` ou `coach` conserve chaque contexte séparément. L'accès à **Administration** renvoie toujours vers le centre de gestion qui exige MFA AAL2.
- RLS et RPC restent les arbitres de chaque écriture. Pas de stockage de coordonnées, d'identités d'autres joueurs ou de secrets.
- Aucune migration nouvelle, changement de droits, notification e-mail ou paiement.

## Dépendances et limites
La base du 21 octobre 2026 possède les fonctions `player_my_callups`, `player_respond_callup`, `staff_set_callup`, `staff_save_match` et la table `staff_team_assignments` sous RLS. Cette livraison réutilise leurs signatures existantes, sans création de membres ou matchs fictifs.

Le site ne contient actuellement **aucune appartenance joueur/équipe, aucune convocation et aucune affectation entraîneur**. Les écrans afficheront donc normalement un état vide pour tous les rôles non attribués. Il faut impérativement vérifier le parcours avec au moins un joueur et un entraîneur correctement affectés, sous comptes distincts, avant de déclarer la recette terminée.

Les tests Node contrôlent les données purement locales, les garde-fous d'accès et la composition des RPC ; ils ne remplacent pas des tests multi-identités avec une session réelle.
