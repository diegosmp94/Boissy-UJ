# Boissy-UJ — Auto-approbation sportive nominative (28 octobre 2026)

## But
Conserver l'interdiction générale d'approuver ses propres demandes, sauf pour **un seul compte administrateur expressément autorisé**. L'exception ne concerne que les rôles **Joueur** et **Entraîneur** et nécessite une session administrateur **MFA AAL2**.

## Sécurité
- Le code de la migration ne contient aucun identifiant de compte : la désignation du compte est conservée dans une table privée Supabase, sans accès direct pour les clients du site. Un index unique impose qu'un seul compte puisse figurer dans cette liste.
- La RPC de décision utilise `auth.uid()`, revalide `app_private.is_admin()`, verrouille la demande en attente et vérifie la liste nominative privée.
- L'auto-attribution d'**Administrateur** demeure interdite. Les refus de ses propres demandes ne sont pas autorisés.
- La contrainte historique `never_self_review` reste inchangée. Une auto-approbation sportive autorisée utilise la colonne `self_approved_by` et l'audit privé `role_change_audit`, avec le membre authentifié comme acteur réel.
- La révocation du rôle technique Administrateur révoque également l'exception nominative.
- Le navigateur affiche le bouton uniquement après une vérification AAL2 et la confirmation de l'autorisation par la base ; une modification de l'interface ne contourne jamais les vérifications serveur.

## Parcours de validation
Centre de gestion → Validation des rôles → Demandes en attente → Approbation (double confirmation). Les autres membres restent soumis à l'approbation par un administrateur distinct.

## Déploiement
1. Exécuter `supabase/migrations/202610280003_nominative_sport_self_approval.sql`.
2. Dans Supabase, affecter **manuellement et dans le schéma privé uniquement** l'unique compte autorisé dans `app_private.role_self_approval_allowlist` ; ne publier aucun identifiant personnel dans GitHub.
3. Tester le refus pour les utilisateurs non autorisés, le refus en AAL1, l'interdiction du rôle Administrateur, ainsi que l'attribution pour un compte nominativement autorisé et authentifié AAL2.
4. Vérifier les journaux d'audit et les affectations d'équipes ; aucun paiement n'est concerné.

Les migrations ne valident pas automatiquement les demandes existantes.
