# Étape 92 — Demandes RGPD, conservation, consentements et effacement coordonné

**27 octobre 2026 · sécurité par défaut, aucun effacement automatique de compte ou de média.**

## État initial et architecture réutilisée

Boissy-UJ possédait déjà :
- une gestion des profils membres, rôles et licences validée par Supabase Auth/RLS ;
- une fiche sportive individuelle nécessitant un consentement dédié (étape 81) ;
- un mécanisme de suppression **en deux phases** pour médias Storage privés (étape 80) : dépublication, tombstone de purge, effacement de l’objet par l'API Storage, puis confirmation finale en base ;
- les registres financiers TEST (non activés en production), les bulletins privés Awards (verrou OFF) et plusieurs journaux d’audit.

La présente étape ajoute un workflow **de coordination** et ne remplace **aucun** de ces contrôles. L’app ne peut pas effacer arbitrairement les comptes Auth, les paiements, les votes publiés ou les fichiers personnels d’autrui.

## Interface du membre : « Mes droits sur mes données »

Le titulaire d’un compte email confirmé, vérifié avec `auth.getUser()`, peut déposer une demande d’accès, rectification, effacement, limitation, portabilité, opposition ou retrait de consentement. La RPC `member_submit_privacy_request()` obtient l’identité via `auth.uid()`, jamais depuis un champ `user_id` fourni par le navigateur. L’API bloque les comptes anonymes, les types invalides, les textes de plus de 600 caractères et limite les demandes simultanément actives.

Le titulaire ne lit que son propre historique via `member_my_privacy_requests()`. La fiche récapitule la réception, l’état, l’échéance indicative et la réponse du club après clôture. Aucune demande n’est réputée acceptée ou effacée sur simple clic.

Les demandes **au nom d’un enfant** ne sont pas déléguées automatiquement à un compte tiers. L’interface informe les représentants légaux qu’une vérification de leur qualité doit être faite directement avec le responsable de traitement, sans envoi de pièce d’identité ni de dossier médical depuis cette page. Les données présentes ne comportent pas de date de naissance vérifiée : le code ne présume **jamais** qu’un joueur est majeur ni que son consentement sportif suffit à publier sa fiche.

## Interface MFA AAL2 : Control Center « Demandes RGPD »

Le module apparaît uniquement si la sonde RPC administrative répond. Les procédures SQL exigent `app_private.is_admin()` **sur chaque appel**, en plus du contrôle d’identité/MFA AAL2 côté navigateur.

- Consultation sécurisée des demandes, de leur échéance et des justifications. Aucune liste publique ni accès brut du navigateur aux tables privées.
- Transitions `submitted → in_review / awaiting_action → completed / rejected` sécurisées avec verrou `FOR UPDATE`, vérification `updated_at` et justification obligatoire pour toute décision finale. L’administration ne peut ni rouvrir ni modifier un dossier déjà clôturé.
- Échéance initiale de **1 mois civil**. Si une demande exige une prolongation justifiée, un seul ajustement manuel peut la porter à **3 mois depuis la réception**, **uniquement durant le premier mois**, avec motif conservé. L’interface seule ne constitue pas une notification automatique : le club doit notifier la personne et organiser le traitement dans les délais applicables.
- Pour l’effacement : création de **8 postes de revue** (Auth, profil, rôles/licences, fiches sportives publiques, médias privés, bulletins, paiements et prestataires). Chacun nécessite une référence interne et un contrôle MFA. `auth_account` ne peut être « non applicable » ; il n’est considéré vérifié **que si le compte Auth est réellement absent**. La clôture de l’effacement est refusée si le compte existe encore, si une preuve manque ou si la checklist est incomplète.
- Les références de suivi et les journaux ne doivent jamais contenir de documents d’identité, données médicales, mots de passe ou copies de fichiers. Pour les autres postes, la réalité de l’effacement doit être contrôlée **hors du formulaire** avec l’API et les outils d’administration appropriés, puis enregistrée.
- Les vérifications ont un audit privé (décisions, prolongations, validation des postes) sans bulletin de vote ni secret de paiement.

## Registre de conservation et consentements

La migration `202610270011_step92_privacy_rights_workflow.sql` crée `app_private.privacy_retention_register` avec **8 catégories de données**, mais **aucune période de conservation ou base légale inventée**. Le responsable du traitement doit renseigner et valider chaque règle ; le bouton administrateur exige une double confirmation, une règle détaillée, sa base légale, un contrôle optimiste et écrit dans un journal privé.

La synthèse compte les fiches sportives publiées dont le consentement n’est pas cohérent, les fiches individuelles non approuvées et les purges Storage encore ouvertes. Elle ne cherche pas à rattacher des noms sportifs publics à des comptes Auth sur la simple ressemblance de nom.

**Les règles de conservation approuvées ne lancent pas de purge automatique**. Une suppression réelle nécessite l’analyse de la base juridique, des contrats et obligations de conservation, des fichiers diffusés et sauvegardes, des données des mineurs, ainsi que du périmètre des sous-traitants. Ce fonctionnement est volontairement conservateur.

## Sécurité, conformité et limites

- Toutes les nouvelles tables sont dans `app_private`, avec RLS, sans permission directe aux rôles `anon` et `authenticated` ; seuls des RPC vérifiant l’identité ouvrent les données nécessaires.
- Les demandes d’effacement subsistent lorsqu’un compte Supabase Auth est supprimé, afin de conserver la preuve du traitement, mais l'identifiant du demandeur est annulé lors de la clôture effective de son dossier. **La minimisation et la purge ultérieure des historiques** sont à définir selon le registre de conservation approuvé.
- Supprimer un compte Supabase Auth n’invalide pas immédiatement les JWT déjà émis ; la procédure d’effacement doit prévoir la révocation des accès et la vérification des objets Storage éventuellement possédés par cet utilisateur.
- Une demande d’accès/portabilité est **enregistrée et prise en charge**, mais le dossier d’export complet sécurisé nécessite l’identification de toutes les données, l’accord juridique, puis une transmission protégée : **le site ne prétend pas avoir généré un export complet**.
- La clôture des demandes n’équivaut ni à une attestation juridique ni à une suppression technique automatique. Aucun compte, message, image, paiement, licence, bulletin, catégorie Awards ou profil joueur n'est modifié par cette migration.

## Recette à effectuer avec le club

1. Comptes fictifs A et B : une demande de A ne doit jamais être visible dans l’espace de B ; refus d’un accès anonyme ; limitation des doublons.
2. Administrateur sans MFA AAL2 refusé ; administrateur MFA autorisé ; conflit de version et prolongation hors premier mois refusés.
3. Demande d’effacement fictive : les huit postes sont initialement en attente. Le bouton « terminer » doit échouer tant que l'Auth user existe ou qu'une preuve manque ; le traitement complet nécessite une procédure Auth/Storage/roles/finance dédiée.
4. Fiche sportive ou média de mineur : vérifier l’accord de la personne compétente et la non-publication avant approbation ; tester une purge Storage interrompue puis reprise.
5. Rédaction réelle du registre par le responsable de traitement, validation des fondements et délais, circuits de notification et inventaire des sauvegardes ou sous-traitants.

## Références externes

- CNIL, droits d’accès/rectification/effacement et réponse initiale sous un mois : https://www.cnil.fr/fr/comprendre-mes-droits/
- Service Public, protection des données : https://www.service-public.gouv.fr/particuliers/vosdroits/F2024
- Supabase, suppression de comptes Auth et Storage : https://supabase.com/docs/guides/auth/managing-user-data

La mise en service des **demandes** peut être réalisée sans lancer de suppression, tandis que l’effacement physique, les durées légales et les modalités de preuve/notifications nécessitent une homologation du responsable du club.
