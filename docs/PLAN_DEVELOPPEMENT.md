# Feuille de route — Boissy-UJ

Point d'étape : **23 octobre 2026**. Les changements du site sont développés sur une branche dédiée, contrôlés, puis fusionnés dans `main` après validation CI. Les étapes 45–46 couvrent le prochain match d'accueil et la mise à jour des rencontres passées ; le suivi de la provenance des dates a été renforcé depuis.

## Chantiers actifs uniquement

**Les fonctionnalités déjà développées et vérifiées ont été retirées du tableau des chantiers.** Leurs étapes historiques ci-dessous restent conservées pour assurer la traçabilité. La réussite des tests CI ne clôt pas une homologation juridique ou une recette utilisateur réelle.

| Priorité | Chantier restant | Prochaine action / blocage |
|---|---|---|
| P1 | Recette multi-comptes (7 rôles et AAL1/AAL2) | Préparer un staging distinct avec comptes/convocations autorisés ; exécuter les tests réels |
| P1 | Sauvegarde et restauration isolée | Effectuer restauration, inventaires et contrôle d'intégrité ; comparer avec le nouvel outil hors ligne |
| P1 | iPhone Safari / Android / accessibilité | Vérifier VoiceOver, TalkBack, clavier et formulaires sur matériels physiques |
| P1 | RGPD et droits à l'image, dont les mineurs | Valider les documents et procédures avec le responsable de l'association |
| P1 | Matchs et résultats du club | Approuver les données sourcées et les publier sans scores inventés |
| P1 | Premières actualités du club | Validation éditoriale et droits avant publication |
| P2 | Réactions aux articles | Recette à deux comptes, RGPD et déploiement contrôlé de la migration |
| P2 | Photos et vidéos | Vérifier droits, fichiers et RLS en staging ; déployer uniquement après validation |
| P2 | Éditeur global et administration avancée | Développer versionnage, workflow de publication et journal unifié |
| P2 | Finances, Premium, dons et Stripe TEST | Tester en staging les fonctions Checkout et webhook préparées ; traiter remboursements et conformité avant activation |
| P2 | Événements payants et billetterie QR | Contrôles d'accès, jauges, annulations et paiements TEST |
| P2 | Awards et communauté Premium | Recetter et activer migration privée préparée après webhook Stripe TEST signé, règles et staging |
| P3 | Synchronisation FFF | Obtenir les autorisations officielles |
| P3 | Ouverture SEO | Homologation finale et accord du club |

[Détail, prérequis, chantiers encore ouverts](CHANTIERS_OUVERTS.md). Le Control Center affiche également seulement les chantiers non terminés, classés P1/P2/P3 ; le diagnostic technique historique reste consultable séparément.

## Étape 53 — Finition des parcours front-end publics (code intégré)

Les pages **Communauté/Premium, Événements/Billetterie et Soutenir** ont une présentation responsive plus complète, un comparateur mensuel/annuel interactif sans prélèvement, un parcours d'information et des FAQ accessibles. Le lien **Awards** est directement visible sur le menu mobile. Les tests de navigation publique Chromium passent de 10 à 16 scénarios, incluant le basculement de période. **Reste hors de cette clôture UI** : tests sur appareils physiques, interactions Stripe/QR/votes avec back-end homologué, contenus sous droits et décisions RGPD. Le front est avancé, mais une homologation à 100 % serait prématurée. [Détails de l'étape 53](ETAPE_53_FINITIONS_FRONTEND.md).

## Étape 59 — Administration éditoriale, réactions et médias (UI intégrée)

Création d'un module MFA AAL2 de suivi des publications, des brouillons et de la disponibilité des réactions/médias ; lecture des publications indépendante des chargements optionnels et agrandissement des photos autorisées en fenêtre accessible sur le site. **La production ne contient toujours pas les tables réactions et médias** : leurs migrations et recettes RLS/Storage restent nécessaires ; aucun contenu fictif ajouté. [Étape 59](ETAPE_59_ADMIN_MEDIA_REACTIONS.md).

## Priorité site public — Déploiement fiable et pages non bloquantes

Nouvelle chaîne de publication GitHub Pages depuis la branche principale : tests Node, contrôle des fichiers distribuables, navigation Chromium, publication et vérification HTTP du commit réellement en ligne. Délai réseau de 12 secondes sur les quatre catalogues publics, conservant les messages d'indisponibilité et aucun score fictif. **Ce travail n'atteste ni l'activation de GitHub Pages ni la disponibilité de vrais contenus** : Pages doit être configuré côté dépôt et la réussite du déploiement vérifiée, et les données éditoriales approuvées restent à saisir. [Détails](LOT_PRIORITAIRE_SITE_PUBLIC_OPERATIONNEL.md).

## Étape 58 B — Staging hébergé bloqué, alternative locale préparée

La création gratuite du projet Boissy-UJ Staging a été refusée par Supabase à cause du quota global des deux projets Free actifs sur le compte. Aucun projet supplémentaire ni frais créés. Préflight local Docker/Supabase CLI et configuration PostgreSQL 17 préparés ; restent les tests réels de migrations, des sept comptes et de restauration. [Détails](ETAPE_58B_STAGING_LOCAL.md).

## Étape 58 — Préproduction isolée et récupération (partie A réalisée)

Audit du projet Supabase Free, sans staging accessible ; nouveau préflight ciblé vers un second projet, refus de la production et des clés privilégiées, contrôle public/Auth/admin anonymement refusé. Inventaire SQL hors ligne des cinq migrations préparées, trié et empreintes SHA-256. **La création du staging, la recette de sept comptes et une restauration réelle restent ouvertes**, car elles exigent une instance distincte et une décision habilitée. [Détails de l'étape 58](ETAPE_58_STAGING_ET_RESTAURATION.md).

## Étape 57 — Recette de préproduction des permissions de l'historique (code préparé)

Script sans modification de données pour valider un staging distinct, deux identités Supabase réelles avec rôles vérifiés, refus anonyme/Supporter/admin AAL1, défi TOTP administrateur AAL2 et historique assaini. Les tests simulés sont intégrés à la CI. Ce **n'est pas une homologation réelle** tant qu'un projet de staging isolé n'est pas disponible. [Étape 57](ETAPE_57_RECETTE_NEWS_STAGING.md).

## Étape 56 — Historique et restauration en brouillon des articles (code préparé)

Les snapshots d'audit d'articles existants sont consultables via une RPC AAL2, et une autre RPC restaure une version antérieure exclusivement en brouillon, en exigeant une nouvelle validation des droits et l'absence de modification concurrente. Module du Control Center masqué tant que la migration manque ; aucun changement appliqué à Supabase production. [Détail étape 56](ETAPE_56_HISTORIQUE_ACTUALITES.md).

## Étape 55 — Stripe TEST signé, rapprochement des factures (code préparé)

Checkout TEST en préproduction avec Auth Supabase vérifiée, formules serveur 10 €/mois et 100 € / 12 mois non renouvelables, signature officielle Stripe des webhooks, liaison privée Checkout/membre, SQL idempotent et extinction des droits. Le code **n'est pas déployé** sur Supabase, et aucune transaction n'a été ouverte. Le prochain travail est la recette réelle en staging puis les compléments de remboursement/fiscalité avant toute homologation. [Détails étape 55](ETAPE_55_STRIPE_TEST_WEBHOOK.md).

## Étape 54 — Vote Awards Premium contrôlé (backend préparé)

Migration Supabase préparée dans `app_private` pour des bulletins privés et **un seul vote actif par compte et catégorie**, avec vérification serveur d'un Premium attesté, contrôle de la période de vote et des nominés consentis. RPC d'ajout, de lecture de son propre bulletin et de retrait ; aucune écriture directe client sur les tables privées. Un smoke de staging avec comptes distincts est fourni. **Aucune migration de vote exécutée en production, aucun droit Premium attribué, aucun vote activé côté public, car le webhook signé de facturation et le staging restent à valider.** [Étape 54](ETAPE_54_VOTES_AWARDS_PREMIUM.md).

## Étape 47 — Réactions aux actualités (code préparé)

Le Media Center dispose désormais du code de réaction « J’aime / Retirer » et d'une migration RLS indépendante. **La collecte des réactions reste conditionnée à l'application contrôlée de la migration, à la revue RGPD et à une recette croisée de deux comptes.** En l'absence de table disponible, le Media Center reste consultable. [Détails et sécurité](ETAPE_47_REACTIONS_ACTUALITES.md).

## Étape 48 — Photos et vidéos sous droits vérifiés (code préparé)

L'interface de galeries et le lecteur vidéo natif sont maintenant connectés au Media Center. Le Control Center propose un éditeur de références de fichiers déjà approuvés, exclusivement aux administrateurs MFA AAL2, après existence de la RPC. La migration de médias est **préparée mais non appliquée** : aucune image de mineur, vidéo ni contenu fictif n'est importé. [Détail et conditions d'activation](ETAPE_48_GALERIES_VIDEOS.md).

## Étape 49 — Validation des fichiers médias avant publication (code préparé)

Le backend média préparé est renforcé : **un média visible doit exister réellement** dans le bucket approuvé et être conforme au type MIME et à la limite de taille. Le Control Center propose une prévalidation MFA AAL2 ; le serveur refuse indépendamment toute publication d'un objet absent ou incorrect. La suppression de visibilité n'efface pas le stockage public : les demandes de retrait nécessitent une purge effective. La migration de média reste non appliquée et la recette des droits à l'image reste bloquante. [Protocole](ETAPE_49_CONTROLE_FICHIERS_MEDIAS.md).

## Étape 50 — Diagnostic de mise en service (lecture seule)

Le Control Center intègre un module **État de mise en service**, réservé à l'administrateur après MFA AAL2, avec neuf contrôles de disponibilité des modules réellement installés et un suivi des validations humaines encore bloquantes. Aucune table ni donnée privée n'est modifiée. En complément, l'audit SQL de production du 23/10 confirme la présence des 5 équipes, RLS activée sur les tables publiques et l'absence d'accès anonyme direct aux fonctions privilégiées `SECURITY DEFINER` examinées ; les réactions et médias n'existent pas encore en production. Ces contrôles ne valent **ni homologation multi-comptes ni score pondéré**. [Preuves, limites et recette](ETAPE_50_DIAGNOSTIC_MISE_EN_SERVICE.md).

## Étape 51 — Recette staging de l'isolation entre comptes (outillage prêt)

Le script de recette réel nécessite désormais **sept comptes Auth distincts**, deux convocations exclusives et un projet Supabase de staging séparé ; une identité dupliquée ou une preuve manquante fait échouer la procédure. Des lectures PostgREST directes contrôlent qu'aucun compte AAL1 ne voit le profil, les rôles, les demandes de rôle ou les affectations d'un autre membre. L'administrateur ne peut consulter les rôles d'autrui qu'après MFA AAL2. **Le code de test est développé ; la recette réelle reste non exécutée faute de comptes de staging autorisés.** [Protocole complet](ETAPE_51_RECETTE_RLS_MULTICOMPTES.md).

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
