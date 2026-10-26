# Étape 68 — Cohérence des rôles cumulables et des affectations

**26 octobre 2026.** Le développement de cette étape ne crée aucun joueur, entraîneur, administrateur, match ni article. Les homologations humaines restent hors périmètre.

## État initial (audité)

- Les rôles `player`, `coach`, `admin` peuvent coexister sur un même compte. Les demandes sont déposées via `member_request_role`, puis décidées par `admin_decide_role_request` avec un administrateur distinct et MFA AAL2.
- La révocation d'un rôle via `admin_revoke_member_role` conserve les autres rôles, désactive les affectations correspondantes et annule les convocations si le rôle `player` est retiré.
- Les affectations aux équipes des entraîneurs peuvent être retirées sans révoquer le rôle Entraîneur et sans supprimer les autres équipes.
- **Incohérence identifiée** : une demande `pending` de la même fonction ou équipe pouvait encore être approuvée après une révocation explicite, provoquant la réouverture d'un droit retiré.
- **Interface périmée** : les onglets Joueur/Entraîneur/Admin ou les éléments privés du Control Center pouvaient rester affichés si une révocation avait eu lieu depuis un autre appareil pendant que la page était déjà ouverte.

## Corrections

### Supabase — migration `202610260008_cancel_stale_role_requests.sql`

- Lors d'une révocation complète d'un rôle : les **seules demandes encore en attente** de ce rôle pour le membre sont passées à `cancelled`.
- Lors du retrait d'une équipe Entraîneur, que ce soit dans `admin_revoke_member_role` ou `admin_set_coach_team_assignment` : seules les demandes `coach` en attente pour cette équipe sont annulées. Les autres équipes et les autres fonctions demeurent intactes.
- La suppression des demandes obsolètes est faite **avant les verrous sur les rôles et affiliations**, conformément à l'ordre verrou demande → rôle → affectation utilisé lors de l'approbation. Les changements et le journal d'audit sont conservés dans la même transaction : une révocation refusée n'annule pas des demandes.
- Les fonctions conservent `SECURITY DEFINER SET search_path=''`, `auth.uid()`, le garde `app_private.is_admin()` (MFA AAL2), l'interdiction d'agir sur soi-même et les privilèges `EXECUTE authenticated` uniquement. **Aucun droit direct aux tables privées n'est accordé.**

### Frontend — revalidation des espaces privés

- `Mon espace` : au retour sur l'onglet ou au retour du focus, les anciennes cartes privées sont effacées immédiatement ; la session, les rôles et les affectations sont relus auprès de Supabase. Les onglets de rôles révoqués disparaissent et les droits restants restent consultables.
- `Centre de gestion` : l'ancienne interface et les identifiants affichés sont effacés dès le retour au site ; le panneau se remonte uniquement après une **nouvelle vérification de l'identité, du rôle administrateur et du MFA AAL2**.
- Les écouteurs `focus` et `visibilitychange` sont retirés au démontage de la route pour éviter les doublons et les panneaux privés issus d'une ancienne session. Le délai de 900 ms absorbe le doublon courant focus + changement de visibilité.
- Une opération en cours reste soumise aux permissions **serveur** au moment de son exécution : les revalidations client servent à corriger l'affichage et ne remplacent jamais RLS ou les verrous transactionnels.

## Livrables et limites de certification

1. Migration SQL additive sur les deux RPC existantes, sans modification de schéma ni seed.
2. Rafraîchissement et occultation de vues privées sur reprise de l'onglet.
3. Tests contractuels `tests/step68-revocation-coherence.test.mjs` et CI du socle.
4. Audit avant/après sur les définitions des deux RPC, les droits `EXECUTE`, les tables RLS et l'historique de migration.

La confidentialité visuelle est renforcée au retour sur la page ; **l'effacement instantané à distance sans changement de focus et le test avec plusieurs sessions réelles** ne sont pas démontrés par ces contrôles et restent hors homologation finale.

L'étape 68 constitue la cohérence technique attendue par le cahier des charges ; elle ne donne aucune autorisation de publication des données de mineurs ni d'ouverture d'une fonction financière.
