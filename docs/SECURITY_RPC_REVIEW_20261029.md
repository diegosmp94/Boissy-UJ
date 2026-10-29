# Boissy-UJ — revue des RPC privilégiées (29 octobre 2026)

## Portée et preuves

Contrôle SQL **en lecture seule** exécuté sur le projet Supabase Boissy-UJ le 29/10/2026, à partir des catalogues `pg_proc`, `pg_namespace` et des privilèges d'exécution. La requête reproductible est `scripts/db-definer-rpc-readonly-review.sql` ; aucun contenu d'utilisateur ni secret n'est récupéré.

| Groupe d'appelants métier (préfixe RPC) | Fonctions `SECURITY DEFINER` exécutables par `authenticated` |
| --- | ---: |
| Administrateur (`admin_*`) | 61 |
| Éducateur / staff (`staff_*`) | 8 |
| Membre (`member_*`) | 9 |
| Joueur (`player_*`) | 2 |
| **Total** | **80** |

- Aucune RPC `SECURITY DEFINER` publique exécutable par `anon` dans l'instantané.
- Les 61 RPC `admin_*` font référence au contrôle central `app_private.is_admin`.
- Les 19 RPC non-administrateur font référence à `auth.uid`.
- Les 80 RPC ont un `search_path` défini.
- La RPC `admin_news_revisions_ready` ne fait pas référence explicitement à `auth.uid`, mais elle appelle le contrôle central `is_admin` (observation statique).

Ces observations sont des **indicateurs** de présence de garde-fous, pas une preuve exhaustive de non-contournement. Les 80 alertes de l'advisor ne justifient pas une révocation aveugle : ces RPC sont destinées à fournir des opérations spécifiques du backend.

## Priorités de recette multi-identités

1. **Administrateur :** vérifier le refus sans MFA AAL2, le refus pour tout compte non-admin, et la réussite uniquement avec un compte admin habilité en AAL2. Tester les révocations de rôles.
2. **Éducateur :** vérifier que `staff_*` refuse une équipe non affectée, les demandes d'autres joueurs, la publication hors périmètre et une affectation révoquée. Refaire les mêmes tests pour un éducateur administrateur ou joueur.
3. **Joueur :** vérifier `player_my_callups` et `player_respond_callup` sur son propre compte uniquement et sur une rencontre autorisée, puis vérifier les refus après retrait du rôle.
4. **Membre :** vérifier les votes Awards, les demandes de rôles et de confidentialité, les titres officiels et l'accès premium, sans accès transversal aux comptes d'autrui.
5. **Anon :** vérifier que toutes les RPC privilégiées restent inaccessibles et qu'aucune donnée privée n'est lisible directement.

Utiliser des comptes de recette habilités, éviter les données personnelles réelles, et consigner les seuls codes de réponse / verdicts sans jetons, identifiants personnels ni captures de secrets.

## Suivi

- **Statut :** revue statique/metadata terminée ; tests authentifiés multi-rôles **non exécutés** à ce stade.
- **Risque résiduel :** les politiques RLS et les conditions métier doivent être vérifiées sur chaque parcours, et la protection de branche ainsi que la protection des mots de passe compromis restent ouvertes.
- **Décision :** aucune fonction n'est modifiée ou rendue publique/privée par ce rapport. Les modifications de droits nécessitent une correction ciblée après preuve d'une faille, avec migration, revue et tests.

Suivi de l'homologation : issue GitHub #181.
