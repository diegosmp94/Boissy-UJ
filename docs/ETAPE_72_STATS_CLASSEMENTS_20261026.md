# Étape 72 — Statistiques et classements fiables

**26 octobre 2026.** Travail technique uniquement. Aucun résultat, classement ou rang n'est créé ou modifié artificiellement.

## Diagnostic avant correction

- `team_form_summary` agrège les résultats **publiés et joués**, mais mélange toutes les saisons, coupes, championnats et matchs amicaux. Son bilan est utile comme total général mais ne doit pas être présenté comme un bilan du championnat actuel.
- `team_league_standings` est un **classement complet de poule saisi manuellement et confirmé par un administrateur MFA AAL2**. Les résultats du seul Boissy UJ ne permettent pas de calculer le classement des adversaires, ni d'inférer des pénalités, résultats manquants ou départages.
- Le classement publié ne nécessitait pas obligatoirement de `season_id`, créant une ambiguïté de saison. Le message public d'absence de classement citait toujours « 2026–2027 », même lorsque aucune saison réelle n'était renseignée.
- Seniors C ne joue pas de championnat officiel : son bilan de matchs amicaux ne doit pas servir à publier un classement de championnat. Les archives de sites tiers sont présentées avec attribution **et sans certification du club**.
- Production vérifiée avant migration : **0 match, 0 classement, 0 saison** ; aucun tableau ou résultat du club inventé.

## Réalisation

### Base Supabase

`supabase/migrations/202610260011_verified_competition_stats.sql` :

1. Nouvelle vue publique `team_competition_form_summary WITH (security_invoker=true)` : compte uniquement les matchs stockés dans `public.matches`, **publiés, joués, avec scores**, séparés par `team_id`, `season_id` et `competition_kind` (`league`, `cup`, `friendly`). Les victoires et buts sont calculés du point de vue de Boissy UJ, domicile ou extérieur. La saison absente reste `NULL` au lieu d'être inventée.
2. La vue respecte **RLS de `matches`**. Accès public limité à la lecture de données collectives ; ni rôle/membre personnel ni convocation.
3. Nouvelle contrainte `published_standings_require_season` : impossible de publier un classement sans saison réellement choisie.
4. Déclencheur `published_league_scope_guard` : impossible de publier un classement de championnat pour Seniors C, équipe uniquement amicale. Aucun droit supplémentaire accordé sur les tables ni sur les fonctions privées.
5. Le calcul de **points de championnat de toute la poule reste volontairement dans le tableau administrateur existant**, avec contrôle des rangs, des statistiques (`J=V+N+D`) et ajustements ; il n'est jamais généré automatiquement depuis les seuls matchs du club.

### Application

- `team-stats.mjs` : conserve le total général explicitement étiqueté « toutes saisons et compétitions », et ajoute des lignes Championnat/Coupe/Amical par saison issue de la nouvelle vue. Les deux flux sont indépendants : une source indisponible ne fait pas apparaître de faux chiffres.
- `admin-league.mjs` : refuse une publication sans saison et la publication d'un classement pour Seniors C. La base reste l'autorité et les opérations passent toujours par la RPC auditable AAL2.
- `league-standings.mjs` : un tableau publié montre son **vrai libellé de saison lorsque celui-ci est disponible**. Il ne se fait jamais passer implicitement pour un classement actuel 2026–2027. En cas d'échec du catalogue de saisons, la période reste signalée comme non vérifiable.
- `tests/step72-verified-sports-metrics.test.mjs` : contrôles automatiques du périmètre de calcul, de la confidentialité, des scores domicile/extérieur, de l'absence de doublons, des saisons et des règles de publication.

## Limites maintenues

Un bilan « 2 victoires » calculé sur deux matchs publiés ne prouve ni que l'équipe n'a joué que deux fois, ni le rang de son groupe. **Les classements complets ne sont pas inférés** de quelques scores ; ils doivent être renseignés et confirmés à part par le club.

Les données `publicExternalFixtures` et `sourced-standings` restent des contextes documentaires de tiers, annoncés comme non confirmés et **jamais fusionnés** dans `team_competition_form_summary`. Aucune donnée de joueur ou de mineur n'est ajoutée à ce traitement collectif.

La table actuelle des classements publie un instantané par équipe (dernière journée enregistrée), pas un entrepôt historique exhaustif : les anciens relevés demeurent dans les journaux privés. La constitution d'un registre de snapshots complets multijournées est hors de cette correction ciblée.

**Clôture technique** : CI verte, migration appliquée et vérifiée dans Supabase, puis fusion et publication GitHub Pages. Les tests humains et la saisie des résultats restent hors du pourcentage de développement.
