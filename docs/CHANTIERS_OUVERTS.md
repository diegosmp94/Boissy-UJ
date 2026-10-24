# Chantiers encore ouverts — Boissy-UJ

**Révision : 24 octobre 2026.** Les fonctionnalités déjà développées et vérifiées par la CI ne figurent **plus dans cette liste active**. Leur historique reste dans les documents d'étapes du dépôt. Un développement techniquement terminé peut toutefois laisser **une homologation réelle** à faire ; celle-ci reste ici tant que sa preuve n'existe pas.

Les priorités P1 bloquent la validation complète ; P2 sont les services non homologués ou les interfaces incomplètes ; P3 dépend d'accords externes.

## Exploitation publique prioritaire

La publication est préparée depuis main ; l’étape 64 renforce sa vérification avec MIME, adresse exacte, manifeste JSON du commit et rapports anonymisés d’homologation. **La publication GitHub Pages est maintenant confirmée** : le workflow du commit `f776646524074079b2bbb20eaca71faae092d23c` a réussi après nouvelle publication et ses 11/11 contrôles HTTP sont verts, dont `release.json` et le commit `main`. La disponibilité technique du site ne certifie pas les 14 chantiers métier encore ouverts. Les quatre catalogues publics ne restent plus indéfiniment sur un chargement réseau. Les contenus réels restent soumis à validation. [Détails](LOT_PRIORITAIRE_SITE_PUBLIC_OPERATIONNEL.md).

## P1 — Priorités bloquantes

| Chantier restant | Ce qui doit être fait | Dépendance réelle |
|---|---|---|
| Recette des comptes et permissions | Préflight de staging et recette à sept identités existants ; mode Supabase Docker local indépendant ajouté au P1 pour contourner le quota cloud sans coût. Préparer le schéma de test, sept identités et deux convocations, puis exécuter la vraie recette MFA/RLS | Comptes consentants, référent staging |
| Sauvegarde et restauration | Produire un export autorisé, restaurer en instance isolée, comparer les inventaires SQL et checksums ; consigner le PV | Base isolée et responsable autorisé |
| Safari/Android et accessibilité | Étape 63 : tests Chromium renforcés, focus clavier, cibles tactiles 44 px et réduction des animations codés ; reste la recette réelle VoiceOver, TalkBack, zoom et formulaire sur appareils physiques | Matériel et testeurs réels |
| RGPD, mineurs et droits à l'image | Étape 63 : suppression de Google Fonts, `no-referrer`, CSP et contrôle des domaines tiers codés ; homologuer responsable, conservation, mentions, consentements, effacement Storage et droits des mineurs | Association et personnes responsables |
| Données sportives officielles | Revue MFA des sources extérieures et détection des écarts préparées à l'étape 62 ; faire signer la validation des scores et dates avant publication | Club / sources et droit de réutilisation |
| Publications initiales | Détecter les publications réellement consenties depuis la revue admin, puis créer au moins un communiqué approuvé sans contenu ni identité inventés | Responsable éditorial et droits |

## P2 — Fonctions à achever / homologuer

| Chantier restant | Suite |
|---|---|
| Réactions aux actualités | Tests RLS à deux comptes, revue RGPD, migration préparée mais non appliquée |
| Galeries et vidéos | Recette sur staging et validation droits, puis migration et import approuvé ; jamais de média privé dans un bucket public |
| Administration avancée | Suivi éditorial en lecture seule intégré au centre de gestion ; historique et restauration en brouillon codés ; recettes réelles MFA/RLS et audit de publication restent à homologuer |
| Premium, dons, finances et Stripe TEST | Étape 60 : montant fixe et destination staging durcis ; événements de remboursement/litige bloqués, **sans réconciliation ni révocation**. Développer ces traitements, faire les tests staging puis homologuer dons, fiscalité et conditions avant toute activation |
| Billetterie et QR | Étape 65 : backend SQL de réservation transactionnelle, annulation et scan unique sous MFA rédigé mais **désactivé et non déployé** ; restent l'interface QR membre/lecteur, la recette PostgreSQL réelle à deux comptes et deux scanners, la conformité et l'homologation avant activation |
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
