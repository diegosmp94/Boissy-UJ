# Chantiers encore ouverts — Boissy-UJ

**Révision : 23 octobre 2026.** Les fonctionnalités déjà développées et vérifiées par la CI ne figurent **plus dans cette liste active**. Leur historique reste dans les documents d'étapes du dépôt. Un développement techniquement terminé peut toutefois laisser **une homologation réelle** à faire ; celle-ci reste ici tant que sa preuve n'existe pas.

Les priorités P1 bloquent la validation complète ; P2 sont les services non homologués ou les interfaces incomplètes ; P3 dépend d'accords externes.

## Exploitation publique prioritaire

La publication est maintenant préparée via un workflow GitHub Pages déclenché depuis main, avec vérification post-déploiement de la version réelle. **L'activation effective de GitHub Pages et le statut du dernier job restent à vérifier** (Settings → Pages → Source = GitHub Actions si besoin). Les quatre catalogues publics ne restent plus indéfiniment sur un chargement réseau. Les contenus réels restent soumis à validation. [Détails](LOT_PRIORITAIRE_SITE_PUBLIC_OPERATIONNEL.md).

## P1 — Priorités bloquantes

| Chantier restant | Ce qui doit être fait | Dépendance réelle |
|---|---|---|
| Recette des comptes et permissions | Préflight de staging sécurisé développé à l'étape 58 ; créer un projet indépendant puis exécuter la recette à 7 identités + deux convocations et valider MFA/RLS | Comptes consentants, référent staging |
| Sauvegarde et restauration | Produire un export autorisé, restaurer en instance isolée, comparer les inventaires SQL et checksums ; consigner le PV | Base isolée et responsable autorisé |
| Safari/Android et accessibilité | Valider l'accueil, le compte, les formulaires, le Control Center avec VoiceOver, TalkBack, clavier | Matériel et testeurs réels |
| RGPD, mineurs et droits à l'image | Valider politique, conservation, mentions, consentements, effacement des médias Storage | Association et personnes responsables |
| Données sportives officielles | Revue MFA des sources extérieures et détection des écarts préparées à l'étape 62 ; faire signer la validation des scores et dates avant publication | Club / sources et droit de réutilisation |
| Publications initiales | Créer les premières actualités autorisées, sans contenu ou identité inventés | Responsable éditorial et droits |

## P2 — Fonctions à achever / homologuer

| Chantier restant | Suite |
|---|---|
| Réactions aux actualités | Tests RLS à deux comptes, revue RGPD, migration préparée mais non appliquée |
| Galeries et vidéos | Recette sur staging et validation droits, puis migration et import approuvé ; jamais de média privé dans un bucket public |
| Administration avancée | Suivi éditorial en lecture seule intégré au centre de gestion ; historique et restauration en brouillon codés ; recettes réelles MFA/RLS et audit de publication restent à homologuer |
| Premium, dons, finances et Stripe TEST | Étape 60 : montant fixe et destination staging durcis ; événements de remboursement/litige bloqués, **sans réconciliation ni révocation**. Développer ces traitements, faire les tests staging puis homologuer dons, fiscalité et conditions avant toute activation |
| Billetterie et QR | Étape 61 : diagnostic des jauges en lecture seule sous MFA + protocole QR opaque préparés. Reste à développer une réservation transactionnelle privée, annulation, lecteur en ligne à usage unique, contrôle des droits et recette deux scanners avant activation |
| Awards et communauté | Catalogue rendu résilient aux pannes nominations/résultats à l'étape 61 ; migration de vote unique et retrait toujours non déployée. Tests staging à deux comptes, webhook vérifié, règlement et activation restent nécessaires |

## P3 — Après les dépendances

| Chantier restant | Prérequis |
|---|---|
| Synchronisation FFF | Licence/API et droits de réutilisation expressément confirmés |
| Ouverture SEO | PV de recette, identité légale et accord du responsable avant levée de `noindex` |

## Ce qui a changé dans l'interface

Le **Control Center → État de mise en service** montre désormais les **chantiers actifs seulement**, avec priorité et prochaine action. Les services qui répondent déjà aux vérifications techniques sortent automatiquement **des chantiers d'intégration** lorsqu'ils sont prêts, mais les validations humaines ne disparaissent jamais sur cette seule base. Le détail des lectures techniques réussies/échouées est replié par défaut.

## État de l'environnement connecté

La création de Boissy-UJ Staging à **0 €/mois** a été refusée par Supabase, car le compte atteint sa limite de **deux projets Free actifs toutes organisations confondues**. Dans l'organisation Boissy-UJ, seul le projet de production est accessible, et aucune branche n'est créée. L'étape 58 B prépare à la place un environnement **Docker local** avec vérification avant démarrage, mais aucun test réel n'a été validé. Il serait incorrect de déclarer achevées les recettes à plusieurs identités ou une restauration isolée. Ne pas créer de nouveaux utilisateurs/équipes fictifs ou projet facturable sans préparation adaptée.

## Outil de comparaison des restaurations

Le nouvel utilitaire `scripts/compare-recovery-inventories.mjs` compare **hors ligne** deux instantanés JSON agrégés issus de `scripts/db-recovery-verification.sql` :

```bash
node scripts/compare-recovery-inventories.mjs source.json restauration.json
```

Il valide strictement les champs autorisés, compare les empreintes de schéma et de politiques, les nombres agrégés, les drapeaux de permissions, et refuse les écarts ou permissions manifestement dangereuses. Il ne lit aucune ligne personnelle et ne se connecte à aucune base ; sa sortie ne contient que les noms de colonnes agrégées différentes. Les deux fichiers sont privés et restent hors GitHub.

**Attention : ce résultat ne réalise pas une restauration.** Le PV ne peut être approuvé qu'après restauration effectivement exécutée, preuve SHA-256 des dumps, comparaison des inventaires et vérifications indépendantes de Storage/Auth, de la conformité et des tests métier.

Pour retrouver les développements déjà livrés, consulter `docs/PLAN_DEVELOPPEMENT.md` et les documents `ETAPE_*.md`.
