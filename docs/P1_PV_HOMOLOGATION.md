# Boissy UJ — Procès-verbal de recette et d'homologation

> **Modèle à compléter par une personne habilitée du club.** Ce document ne constitue **ni une certification RGPD**, ni une validation sportive, ni une autorisation d'ouverture automatique.

**Projet :** site Boissy UJ — dépôt `diegosmp94/Boissy-UJ`  
**Version / commit exact :** à renseigner lors de la validation  
**Date de recette :** à renseigner  
**Responsable désigné par le club :** à renseigner  
**Périmètre de traitement (mineurs, sportifs, administrateurs) :** à renseigner

## 1. Préconditions d'ouverture

| Contrôle | Statut à attribuer | Preuve / référence |
| --- | --- | --- |
| Tests CI `main`, audit préproduction et recette Chromium | À vérifier sur le commit choisi | URL du workflow |
| Vérification du site HTTPS publié et de ses dépendances | Non homologué sans mesure du site réellement livré | Rapport HTTP |
| Inscription, connexion, vérification e-mail, récupération du compte et déconnexion | À réaliser avec des comptes autorisés | PV de test expurgé |
| Supporter, joueur, entraîneur, admin AAL1/AAL2 et doubles/triples rôles | À réaliser avec plusieurs identités autorisées distinctes | Matrice + captures anonymisées |
| Accès interéquipes, convocations, refus d'auto-approbation et journal d'audit | À réaliser sans données sportives fictives en production | Résultats des cas négatifs |
| Safari iPhone + VoiceOver, Android + TalkBack, navigation clavier bureau | À effectuer sur appareils physiques | Grille par appareil |
| Exports de base, restauration **sur base isolée**, vérification d'intégrité et test métier | À exécuter en conditions maîtrisées | Rapport comparatif + SHA-256 |
| Information juridique exacte de l'association, contacts, hébergeur, bases légales et conservations | À valider par le responsable du club | Mentions signées |
| Droit à l'image et consentement applicable, notamment pour les mineurs | À valider pour chaque publication | Registre interne sous accès restreint |
| Prestataires, cookies, traceurs, droits RGPD et demandes des représentants légaux | À examiner et approuver par le club | Registre des traitements |
| Sécurité des mots de passe compromis (fonction Pro non disponible sur plan Free) | Risque à accepter/traiter par le responsable | Décision formalisée |
| Mise en visibilité publique / retrait de `noindex` | **Interdit avant autorisation expresse** | Approbation écrite |

## 2. Fiche de test d'un compte (à recopier)

- Identifiant pseudonymisé du scénario, **sans e-mail, nom, token ou capture de donnée personnelle :** …
- Navigateur/appareil et version : …
- Rôle(s) effectivement attribué(s) et équipe de rattachement : …
- Niveau MFA (AAL1 / AAL2) : …
- Action tentée et droit attendu (autoriser/refuser) : …
- Résultat constaté / problème / identifiant du ticket : …
- Validation par un autre administrateur sur demande de cumul : …

Ne pas réutiliser un même compte pour tester la séparation entre deux personnes ni simuler les privilèges uniquement en modifiant l'interface.

## 3. Décision de sortie

- [ ] **Homologué** : preuves complètes, limites acceptées et autorisation signée.
- [ ] **Homologué sous réserves** : conditions, durée, restrictions de traitements et mesures compensatoires **explicitement consignées**.
- [ ] **Refusé / en attente** : tests, documents, contrôles ou autorisations manquants.

**Décision motivée et réserves :** à renseigner.  
**Personne responsable / qualité / date / signature :** à renseigner.  
**Revue des traitements de mineurs et publications de photos :** à renseigner.

À ce jour, **aucune case de décision n'est cochée automatiquement** et le site demeure une prévisualisation en `noindex`. Les tests automatiques ne remplacent ni la validation juridique, ni les essais d'authentification multi-identités, ni la restauration d'une véritable sauvegarde.

## Références internes

- [Phase 2 — autorisations et accessibilité](P1_HOMOLOGATION_PHASE2.md)
- [Phase 3 — restrictions de profils et reprise](P1_HOMOLOGATION_PHASE3.md)
- [Procédure de reprise Supabase](P1_RECOVERY_PLAYBOOK.md)
- [Matrice de recette](MATRICE_RECETTE.md)
