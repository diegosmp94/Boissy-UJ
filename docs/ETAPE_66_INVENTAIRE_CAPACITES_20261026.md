# Étape 66 — Inventaire réel du schéma et des fonctionnalités Boissy UJ

**26 octobre 2026 · état observé sur Supabase production ; aucune écriture effectuée.**

## Livré

- `scripts/capability-inventory.mjs` compare un **instantané de métadonnées SQL en lecture seule** aux sources du dépôt. Il classe les fonctionnalités par état : `connected-schema-only` (présence structurelle, **pas** validation de droits), `prepared-not-deployed` (code/migration présents mais backend manquant), `deployed-awaiting-approval` (installé, mais activation toujours bloquée), `runtime-mismatch` ou `source-incomplete`.
- `docs/inventaire-supabase-20261026.json` constitue la preuve datée des **noms** de tables, RPC, entrées d'historique de migration, buckets et Edge Functions, et des compteurs de RLS. Le fichier ne contient **aucune ligne métier**, nom, e-mail, rôle individuel, mot de passe, jeton ou secret.
- `npm run audit:features` effectue la revue locale ; `npm run audit:features -- --json` imprime le rapport machine. La commande est intégrée à `npm run release:check`. Le mode normal **ne contacte pas** Supabase, et n'exécute aucune migration.
- Tests unitaires : distinguent une dépendance serveur absente d'un fichier absent, un backend installé mais encore non autorisé, un schéma altéré et un instantané non fiable.

## Constats réels (photographie, pas supervision continue)

| Contrôle | Constat |
|---|---|
| Tables publiques avec RLS | **20 / 20** |
| Tables inventoriées (public + app_private) | **37** |
| Noms de RPC métier exposés dans `public` inventoriés | **30** |
| Entrées dans l'historique des migrations Supabase | **35** |
| Fichiers SQL versionnés dans le dépôt | **45** |
| Edge Functions déployées | **0** |
| Bucket Storage `boissy-uj-approved` | **Absent** |
| Composants fondamentaux dont objets requis sont trouvés | **10 / 10** (preuve de présence uniquement) |
| Modules avancés préparés, mais backend absent | **6 / 6** |

Les six modules avancés sont : réactions, médias, votes Awards, facturation Stripe TEST, historique/restauration des actualités et tickets gratuits.

**Important : 35 entrées Supabase contre 45 fichiers Git ne signifie PAS « 10 migrations manquantes ».** Plusieurs migrations anciennes ont été appliquées manuellement avec des versions/noms différents ; l'inventaire croise donc les **objets du schéma et les capacités** sans déduire une absence de la seule divergence des noms. Les six migrations P2 préparées sont clairement indépendantes et **non appliquées**, ce qui ne justifie pas de les lancer directement en production.

### Tableau d'avancement de développement

La présence du socle Supabase permet de concentrer les étapes 67–97 sur la sécurisation des RPC, la cohérence des parcours déjà présents et les intégrations non déployées. **L'étape 66 est terminée comme audit technique reproductible**, sans prétendre que ses 10 modules raccordés sont homologués.

## Usage et limites

```sh
npm run audit:features
npm run audit:features -- --json
```

Le fichier JSON est un **instantané horodaté** : si la production change après son observation, il faut refaire les lectures de métadonnées par un opérateur habilité et actualiser cet inventaire. Relancer la commande seule ne rafraîchit pas Supabase et **n'autorise jamais** une fonctionnalité. L'état `connected-schema-only` ne prouve ni l'isolation multi-comptes, ni les protections des fonctions SECURITY DEFINER, ni les flux MFA AAL2.

**Pas de modification de production à cette étape.** Ne pas déployer les migrations de paiement, vote, billetterie ou fichiers personnels sans préproduction isolée et accord de mise en service du club.
