# Feuille de route — Boissy-UJ

Point d'étape : **23 octobre 2026**. Les changements du site sont développés sur une branche dédiée, contrôlés, puis fusionnés dans `main` après validation CI. Les étapes 45–46 couvrent le prochain match d'accueil et la mise à jour des rencontres passées ; le suivi de la provenance des dates a été renforcé depuis.

| Étape | Objet | État au 23/10/2026 | Prochaine preuve / action |
|---|---|---|---|
| 1 | Audit dépôt, Supabase et fichiers | Réalisé ; schéma, migrations et limites consignés | Revalider l'état hébergé avant chaque activation sensible |
| 2 | Socle visuel du site public | Développé ; accueil en huit chapitres, navigation responsive et contrôles CI | Recette iPhone/Android, clavier et lecteur d'écran sur appareils réels |
| 3 | Comptes et autorisations Supabase | Auth standard et protections de rôles/RLS développées | Parcours e-mail, récupération et MFA avec comptes de test autorisés |
| 4 | Sport et Match Center | Équipes, archives sourcées, calendrier et fonctions administratives développés ; FFF reste manuelle | Recette croisée des permissions et validation du club des résultats/dates |
| 5 | Actualités et communauté | Catalogue public et flux de publication sécurisés ; fonctions de médias et consentement encore partielles | Valider droits à l'image, données des mineurs et parcourir les modules avec comptes habilités |
| 6 | Stripe TEST et billetterie | Non homologué ; aucune vente ou réservation payante ouverte | Revue juridique et compte Stripe de test autorisé, puis tests signés des webhooks |
| 7 | Control Center complet | Panel AAL2 et plusieurs outils réels développés ; finance et éditeur global restent incomplets | Vérifier les migrations/RPC puis réaliser la recette multi-comptes |
| 8 | Recette à 85 % pondérés et livraison | Non déclarée : les critères non testés ne reçoivent aucun point | Compléter les preuves, revue juridique, restauration isolée et décision formelle du club |

## Prochaines actions concrètes

Le travail autonome sur le code et le site public est avancé. La prochaine tranche de la roadmap est une **recette probante**, pas l'activation spéculative de services sensibles :

1. Effectuer les parcours de connexion, MFA, demandes de rôles, convocations et cloisonnement d'équipe avec des comptes de test autorisés.
2. Vérifier sur iPhone Safari et Android Chrome l'accueil, les pages sportives, les formulaires et la navigation clavier/assistive.
3. Compléter les coordonnées officielles, bases légales, durées de conservation, droits et règles relatives aux mineurs avec le responsable du club.
4. Exécuter une sauvegarde/restauration en environnement local isolé et conserver une preuve sans données personnelles dans GitHub.
5. Reprendre la matrice pondérée seulement avec ces résultats ; aucune homologation globale ou note de 85 % n'est déduite des tests unitaires seuls.

Les données de match externes restent des références, pas des résultats publiés par le club. Le mode FFF automatique, les paiements LIVE et l'indexation SEO restent fermés jusqu'aux accords et validations prévus.

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
- Développé : demandes, approbations, refus et révocations auditées, affectations Joueur/Entraîneur par équipe, espaces connectés et contrôles serveur. **Reste :** recette de permissions multi-identités et procédures de récupération administrative avant homologation.
- Exigences détaillées : [Cahier des charges V1.5](CAHIER_DES_CHARGES.md).

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
