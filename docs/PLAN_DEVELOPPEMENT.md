# Feuille de route — Boissy-UJ

Les modifications sont réalisées sur une branche dédiée et font l'objet de contrôles avant une éventuelle fusion vers main.

| Étape | Objet | Critère de sortie |
|---|---|---|
| 1 | Audit dépôt, Supabase et fichiers | Ressources identifiées, limitations documentées |
| 2 | Socle visuel du site public | Accueil 8 chapitres, navigation responsive, premiers tests |
| 3 | Comptes et autorisations Supabase | Auth, rôles et RLS testées |
| 4 | Sport et Match Center | Équipes et saison, saisie manuelle fiable ; FFF uniquement autorisée |
| 5 | Actualités et communauté | Publication des éducateurs, médias et abonnements visibles |
| 6 | Stripe TEST et billetterie | Vérification webhooks et aucun encaissement réel |
| 7 | Control Center complet | Éditeur, audit, rappels, reporting et sécurité |
| 8 | Recette à 85 % pondérés et livraison | Aucun blocage critique, validation explicite avant main |

## Décisions confirmées

- Association loi 1901 ; données juridiques détaillées à compléter.
- Premium mensuel : 10 € / mois, sans engagement.
- Premium annuel : 100 € / 12 mois, **sans renouvellement automatique**.
- Stripe comme seule solution de paiements, sous réserve de configuration et conformité ; pas de LIVE à ce stade.
- Cinq équipes : Seniors A D3, B D4, C amicaux, Vétérans D3 et Senior D2.
- Accueil en huit chapitres plein écran, contrôlable par le visiteur ; navigation mobile hybride.
- Les éducateurs publient directement les contenus et statistiques autorisés de leur équipe.
- Ni commentaires ni messagerie ; uniquement réactions.
- FFF : integration seulement autorisée et confirmée, sinon saisie manuelle.
- Dons ponctuels et mensuels ; fonds général et campagnes par projet.
- Événements gratuits ou payants, avantages premium configurables.

## Exigence ajoutée : double / triple rôle

- Un compte peut cumuler `player`, `coach`, `admin` (toutes les paires et le triple rôle).
- Un nouvel ajout de rôle exige l'approbation d'un administrateur autre que le bénéficiaire, avec MFA AAL2 ; une demande en attente n'accorde aucun droit.
- L'ajout d'un rôle ne retire pas les autres ; toute affectation entraîneur à une équipe est validée séparément.
- Développement restant : demande / approbation / rejet / révocation auditée, contrôle des affectations et tests de permissions multi-identités avant ouverture de Mon espace.
- Exigences détaillées : [Cahier des charges V1.1](CAHIER_DES_CHARGES.md).

## Suivi P1 — Espaces Joueur / Entraîneur (2026-10-22)

La priorité P1 de l'audit est **développée côté application et fonctions Supabase** sur les étapes 31 (contextes et réponses), 32 (convocations d'équipe), 33 (affiliations joueurs) et 34 (affectations entraîneurs). Les gardes d'authentification, de périmètre d'équipe et de MFA sont testés automatiquement. **Reste la recette avec plusieurs comptes habilités** avant homologation complète. Voir [plan de recette P1](P1_ESPACES_SPORTIFS_RECETTE.md).

## Suivi P2 — Gestion des membres

L'étape 35 ajoute la correction du **nom d'affichage** d'un membre par un autre administrateur MFA AAL2, avec audit privé. Les modifications de l'identité de connexion, la création/suppression de comptes et la réinitialisation du mot de passe exigent toujours des workflows distincts ; elles ne sont pas actives. [Documentation](ETAPE_35_P2_PROFILS_MEMBRES.md).

## Suivi des tests navigateur et RGPD (étape 36)

La CI teste désormais sur Chromium les pages et la navigation à plusieurs largeurs et conserve les captures, sans manipuler les comptes réels. Un inventaire automatisé des ressources externes et du stockage navigateur complète les contrôles P1. Ce progrès technique ne remplace pas les essais sur appareils physiques, les décisions juridiques de l'association ni les tests de sauvegarde/restauration. [Documentation](ETAPE_36_RECETTE_NAVIGATEUR_RGPD.md).

## Priorité P1 — Identité, accueil, navigation et qualité (2026-10-22)

L'interface publique dispose de liens légaux accessibles, d'une présentation technique des traitements, d'un parcours clavier amélioré, de cibles mobiles adaptées et d'un export préproduction plus fiable avec audit automatique GitHub Actions. **Restent avant homologation :** coordonnées et mentions validées de l'association, bases légales/durées RGPD, tests iPhone/Android et lecteurs d'écran, mesures de performance et preuve de restauration Supabase. L'indexation reste volontairement désactivée pendant cette phase. [Checklist détaillée](P1_IDENTITE_RGPD_DEPLOIEMENT.md).

## Complément P1 — contrôle Pages en lecture seule

Le protocole [P1 navigateur et RGPD](P1_BROWSER_RGPD_INVENTAIRE.md) distingue désormais l'export local testé dans Chromium du site Pages en ligne. Après publication de `main`, lancer manuellement le workflow « Vérifier manuellement GitHub Pages Boissy-UJ » pour vérifier la disponibilité HTTP des fichiers publics sans accéder aux données des comptes.

## Vérifications à mener plus tard

Statuts juridiques détaillés, conformité fiscale, reçus fiscaux, durée de priorité événements, compte Stripe, connexion éventuelle FFF, droit à l'image.
