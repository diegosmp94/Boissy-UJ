# Étape 23 — Répertoire administrateur des effectifs publics

## Périmètre livré
Le futur écran réel du compte administrateur dispose d'un répertoire de profils sportifs, indexé sur les cinq équipes : Seniors A, B, C, Vétérans (football) et Boissy-UJ Futsal. L'interface bleu nuit et doré permet :
- de retrouver une fiche existante par **équipe**, **état de publication** (brouillon / publiée) et **nom / fonction**, avec recherche insensible aux accents ;
- de consulter les compteurs **réels des données chargées** (aucune identité inventée) ;
- de choisir une fiche depuis une liste lisible, de charger son formulaire et de la modifier ;
- d'actualiser les données avant édition, notamment si des changements ont été enregistrés par une autre personne ;
- de préparer la **dépublication** d'une fiche auparavant publique sans la supprimer des données de gestion du club.

Le bouton « Préparer la dépublication » ne soumet **aucune écriture** : il décoche la publication et exige que l'administrateur confirme ensuite l'enregistrement via le parcours en **deux étapes** déjà en place. Toute sauvegarde revalide le rôle admin, MFA AAL2 et la version `updated_at` sur la RPC Supabase. Le serveur conserve la traçabilité.

## Confidentialité
- La liste privée est montée exclusivement dans `#/mon-espace`, lorsque le compte vérifié est administrateur et possède MFA AAL2. La session et les droits sont revérifiés avant toute sauvegarde.
- Le Control Center public reste une **prévisualisation locale non persistante**. Le nouvel index ne récupère aucun membre privé dans cette page.
- L'annuaire public n'affiche que `published=true AND consent_confirmed=true`, sans importer d'informations depuis `auth.users`, `profiles` ou les appartenances sportives.
- Les données relatives à des mineurs exigent, lorsqu'applicable, les autorisations des représentants légaux et le respect des droits à l'image.
- Aucune clé de service secrète n'est diffusée, aucun paiement n'est activé.

## État opérationnel vérifié
Le 21 octobre 2026, la table `team_public_people` contient **0 fiche** et le journal d'audit dédié 0 entrée. Ces valeurs n'étant pas des exemples, elles peuvent évoluer après un futur lancement de la gestion réelle.

La configuration `auth-config.mjs` demeure `enabled:false`. L'écran d'édition sécurisé ne peut donc **pas encore être utilisé sur le site public** ; il sera ouvert seulement après recette de l'authentification, des e-mails, du MFA, des autorisations et des scénarios d'administration.

## Vérifications
Les tests automatisés couvrent l'isolation entre équipes, la distinction brouillon / publié, la recherche accent-insensible, les cas d'équipe inconnue, le maintien de l'éditeur hors de la préversion publique, la double confirmation et le contrôle de version. Les workflows GitHub doivent être verts avant la fusion en `main`.

Cette étape ne change **aucun schéma Supabase** : la migration 21 et les fonctions existantes sont réutilisées, avec leurs RLS / contrôles d'accès inchangés.

## Recette restante avant accès réel
1. Validation des parcours inscription / connexion / renouvellement des sessions, MFA obligatoire AAL2, révocation des rôles.
2. Test de bout en bout avec comptes de test administrateur et utilisateur standard, puis rejeu des refus d'accès (aucune fuite des brouillons ni des journaux).
3. Revue juridique / protection des données, retrait des autorisations, politique de conservation, journaux.
4. Vérification graphique PC, iPhone / Android, lecteurs d'écran, clavier, réseaux lents.
