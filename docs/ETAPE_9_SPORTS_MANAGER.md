# Étape 9 — Sports Manager et saisons

Projet Supabase : Boissy-UJ (dahzewvbybujqhogumte).

## Développement simultané site / base

### Sur le site
- Dans le Control Center, le module **Match Center** fournit maintenant un atelier de préparation complet en prévisualisation : équipe, adversaire, date, lieu, statut, domicile/extérieur, saison facultative, score et origine manuelle ou référence FFF.
- Contrôles de formulaire : score obligatoire pour une rencontre terminée (0 à 99), interdit pour les autres statuts ; Seniors C ne peut pas prétendre avoir une source FFF ; référence nécessaire pour les sources FFF.
- L'atelier affiche explicitement que les changements ne sont pas enregistrés. Ne saisir aucune donnée personnelle.
- Dans le Match Center public, un filtre **par saison** n'apparaît que lorsqu'une saison a réellement été configurée dans Supabase. Les rencontres restent en lecture seule et doivent être publiées explicitement.
- Les quatre équipes existantes restent inchangées. Aucune saison ni aucun match fictif créé.

### Dans Supabase
Migration `supabase/migrations/202610210009_sport_seasons_match_manager.sql`.
- Table `club_seasons` en lecture publique et sans droit client d'écriture, avec état planned/active/completed ; aucune saison initiale insérée.
- `matches.season_id` référencé à `club_seasons`.
- RPC `staff_save_match` avec permission de création et de mise à jour : seulement session authentifiée, coach affecté actif à l'équipe ou administrateur avec MFA AAL2.
- Contrôle de la portée de l'équipe lors des modifications d'un match existant.
- Contraintes métier vérifiées côté serveur (adversaire, date, statut, scores, référence FFF, équipe Seniors C).
- Journal des versions `app_private.match_change_log` hors du schéma public ; lecture et écriture refusées à anon/authenticated, insert réalisé exclusivement dans la transaction de la fonction privilégiée.
- Fonction `SECURITY DEFINER` explicitement exposée aux comptes `authenticated` et contrôlée en interne. Le linter peut avertir de cette exception; elle requiert des tests dynamiques avant tout accès réel.

## Limites / portes restantes
- L'authentification standard est activée (`auth-config.mjs`), mais les parcours administratifs exigent toujours rôle autorisé et MFA AAL2 ; leur recette multi-comptes réelle reste à faire. Voir [étape 25 — fiabilité des sessions](ETAPE_25_SESSIONS_AUTH.md).
- L'atelier de préparation ne déclenche aucune RPC. Les vrais écrans de sauvegarde seront activés uniquement après la recette des comptes, rôles, MFA, affectations et audits avec des identités d'essai.
- Ne pas représenter une référence FFF saisie par le club comme une donnée officielle synchronisée automatiquement.
- Pas de données individuelles de joueurs, convocations nominatives, licences, portraits ou paiements dans ce lot.
- Avant activation : test connecté pour supporter/joueur non autorisé, coach sans équipe, coach affecté à l'équipe A et tentant de modifier B, administrateur sans MFA, admin MFA AAL2, statut/score incorrect, rollback transactionnel, audit création + modification et dépublication.

## Contrôles
- Tests Node et GitHub Actions, code synchronisé sur `main` après validation.
- Migration appliquée sur Supabase : vérifier via la liste des migrations, colonnes, permissions et une transaction de test sans création permanente.
- Recette Safari mobile et navigateur réel différée selon décision de revoir le site à la fin.

## Vérification Supabase effectuée le 21/10/2026
- Migration `boissy_uj_seasons_staff_matches_20261021` **appliquée avec succès**.
- Tables `public.club_seasons` et `app_private.match_change_log` créées, RLS activée.
- La table des saisons contient **0 entrée** ; pas de résultat ou de rencontre ajouté.
- Droits contrôlés via `has_table_privilege` : lecture des saisons autorisée aux visiteurs, écritures refusées à `anon` et `authenticated` ; journal de match privé inaccessible.
- Test en transaction annulée avec rôle `authenticated` et identifiant sans affectation : tentative `staff_save_match` rejetée en `42501`, sans création de ligne.
- Le linter signale la fonction `SECURITY DEFINER` exposée aux utilisateurs connectés : garde interne volontaire ; **tests multi-comptes avec authentification réelle toujours indispensables**.
