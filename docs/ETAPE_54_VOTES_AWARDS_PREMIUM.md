# Étape 54 — Awards : vote Premium unique, privé et contrôlé par Supabase

**Date : 23 octobre 2026.** La migration, l'audit et le script de recette ont été développés **sans les exécuter sur la production**. Le catalogue Awards est présent dans Supabase, mais aucune catégorie n'est actuellement renseignée ; il serait erroné de publier des résultats, de créer des votes ou de déclarer une fonctionnalité déjà activée.

## Ce qui a été codé

Le fichier `supabase/migrations/202610230003_premium_awards_ballots.sql` crée deux tables **dans `app_private`**, hors schéma API public :

- `award_vote_entitlements` : preuve d'un Premium en cours de validité, exclusivement attestée par un futur **webhook de facturation signé et vérifié côté serveur**. `valid_from`, `valid_until`, `verified_at`, `revoked_at` et `source_reference` sont vérifiés. Le rôle client ne peut ni lire ni écrire la table. Aucune attestation n'est créée par la migration et aucun endpoint d'attribution n'est fourni.
- `award_ballots` : un vote actif **par compte et par catégorie** garanti par `primary key (award_id,user_id)`, plus une clé étrangère composite `(award_id,nominee_id)` qui empêche de voter pour le nominé d'une autre catégorie. Les bulletins ne sont jamais exposés par PostgREST et ne comportent ni email ni nom.

Trois RPC `SECURITY DEFINER`, avec `search_path=''` et permissions explicites **`authenticated` uniquement**, sont préparées :

| RPC | Contrôle serveur |
|---|---|
| `member_cast_award_vote(p_award_id, p_nominee_id)` | Email vérifié, droit Premium attesté non expiré, catégorie publiée et ouverte **dans les dates exactes**, publication/consentement nominatif, doublon refusé, vote privé |
| `member_my_award_vote(p_award_id)` | Retourne exclusivement **l'identifiant du propre vote** ou `null`; aucune liste de votants ni total public |
| `member_withdraw_award_vote(p_award_id)` | Retire uniquement son propre vote, **y compris après la clôture et après la fin du Premium** |

Un vote retiré peut être remis pendant une période encore ouverte si le droit Premium est toujours valide. Il ne peut y avoir qu'**un vote comptabilisé à un instant donné** pour chaque compte/catégorie. Aucune publication de palmarès n'est calculée automatiquement par ce changement.

## Sécurité et vie privée

- Aucun insert seed, pas d'abonnement Premium « gratuit » accordé au démarrage, aucun abonnement facturé, aucun formulaire de paiement ni vote dans l'interface publique tant que la migration n'est pas homologuée.
- Accès direct `anon` et `authenticated` explicitement **révoqué** aux deux tables privées. RLS activée, sans politique ouverte. RPC accessibles uniquement aux comptes authentifiés avec vérification systématique de leur propre `auth.uid()`.
- La présence d'un rôle `admin`, `coach` ou `player` ne remplace pas un Premium véritablement attesté. Aucun choix fondé sur `user_metadata`.
- Seules les nominations publiées avec accord sur le nom, et liées à leur catégorie, sont éligibles ; rien ne réutilise les photos ou données privées.
- Le retrait du vote ne nécessite pas un abonnement toujours valide. La suppression d'un compte Supabase entraîne la suppression de ses droits et de ses bulletins.
- Les changements d'ouverture/fermeture de catégorie sont coordonnés par `FOR SHARE`. La contrainte primaire protège contre le double vote concurrent.
- Aucune réponse ne fournit de données d'autrui, de comptes, d'email ou de totals de votes.

## Recette réelle à exécuter sur staging uniquement

La recette `scripts/real-awards-voting-smoke.mjs` est volontairement **écrivante sur une base de test isolée** ; elle ne doit **jamais** être exécutée sur la production. Elle refuse la référence de production, une URL non correspondante, une clé secrète, des utilisateurs test identiques, un acquittement manquant et des IDs de fixtures invalides.

Préparer préalablement dans un Supabase **de staging non partagé avec les membres réels** :

1. La migration de catalogue existante et la migration de vote #54.
2. Une catégorie Awards de test *publiée et ouverte dans l'intervalle réel* avec deux nominations : l'une publiée et consentie dans cette catégorie, l'autre liée à une catégorie différente.
3. Deux comptes de test réellement distincts, avec email confirmé : l'un **sans** Premium, l'autre doté **uniquement pour staging** d'une attestation de facturation fictive contrôlée par un opérateur habilité. Cette fixture n'est pas une vraie souscription et ne prouve pas le webhook.
4. Un accord écrit d'exécuter les tests, une sauvegarde de staging et des garanties d'absence de données réelles. Vérifier qu'aucun des deux comptes ne possède déjà un vote sur la catégorie de test.

Renseigner **localement, sans commit ni copie dans le chat**, les variables :

- `BOISSY_AWARD_TEST_ACK=YES_WRITE_AWARD_TEST_BALLOTS_ON_ISOLATED_STAGING`
- `BOISSY_AWARD_TEST_PROJECT_REF`, `BOISSY_AWARD_TEST_URL`, `BOISSY_AWARD_TEST_KEY` (clé publique ou anon de staging seulement)
- `BOISSY_AWARD_TEST_PERSONAS_JSON` contenant `premium` et `supporter`, chacun avec `email` et `password` de staging.
- `BOISSY_AWARD_TEST_FIXTURES_JSON` contenant les vrais UUID de staging `awardId`, `nomineeId`, `foreignNomineeId`.

Commande : `npm run smoke:awards-voting`. La recette utilise les endpoints Auth et RPC de staging, refuse le vote anonyme, le vote du Supporter non Premium, le mauvais nominé et le doublon, prouve la lecture privée du propriétaire puis exécute un retrait. Une tentative de nettoyage est effectuée en fin de recette, y compris si l'API a accepté à tort une écriture ; une vérification humaine de staging reste recommandée en cas d'échec réseau.

L'audit **SQL read-only** `scripts/db-awards-voting-audit.sql` examine les tables, RLS et droits des RPC sans retourner d'identité ni de vote.

## Blocages restants

- **Pas de projet Supabase de staging connecté** actuellement ; le test réseau réel et la migration restent donc non exécutés.
- Le **code de Checkout et webhook Stripe TEST** a été préparé à l'étape 55, mais il doit encore être déployé et validé sur staging isolé avant de servir de preuve fiable d'attribution/révocation. Les remboursements et litiges restent à traiter avant homologation.
- Le club doit approuver le règlement Awards, les conditions d'éligibilité et la publication des nominés, notamment mineurs et droit à l'image.
- L'interface de vote ne peut être activée que lorsque la migration, la facture vérifiée et la recette multi-comptes sont validées. Les pages Awards actuelles restent purement informatives.
- Tests CI statiques + simulation HTTP ne prouvent pas que la migration PostgreSQL a réellement été exécutée ; une recette Supabase isolée est indispensable avant homologation.

**Conclusion : fondations serveur des votes rédigées et testables ; fonction Premium NON encore activée.**
