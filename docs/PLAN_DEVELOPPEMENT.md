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

## Vérifications à mener plus tard

Statuts juridiques détaillés, conformité fiscale, reçus fiscaux, durée de priorité événements, compte Stripe, connexion éventuelle FFF, droit à l'image.
