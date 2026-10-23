# Boissy-UJ — préversion du site officiel

Le dépôt contient le prototype visuel de Boissy-UJ en cours de développement. La branche `main` recevra les versions stabilisées, tandis que les prochaines améliorations pourront être réalisées sur des branches dédiées.

## Back-end Awards Premium — étape 54 (23 octobre 2026)

Migration préparée pour un vote par compte et catégorie avec vérification serveur d'un droit Premium issu d'une facturation authentifiée, nomination publique avec consentement, dates du scrutin et retrait du vote. Audit SQL en lecture seule et recette écrivable **uniquement en staging** disponibles (`npm run smoke:awards-voting`). **La fonction n'est pas activée en production** : aucun webhook signé homologué, aucun staging disponible et aucun vote réel. [Protocole étape 54](docs/ETAPE_54_VOTES_AWARDS_PREMIUM.md).

## Finitions du front-end public — étape 53 (23 octobre 2026)

Les pages Communauté/Premium, Événements et Soutenir disposent d'une présentation responsive enrichie, d'une comparaison mensuelle/annuelle interactive accessible, de FAQ et d'informations de disponibilité claires. Les boutons de paiement, réservation et vote restent absents tant que les services serveurs et les décisions de l'association ne sont pas validés. Le menu mobile propose maintenant un accès direct aux Awards. [Détail des finitions et des limites](docs/ETAPE_53_FINITIONS_FRONTEND.md).

## Chantiers restants uniquement — étape 52 (23 octobre 2026)

Le tableau de suivi actif ne répète plus les fonctionnalités déjà développées. Les blocages réels sont classés en P1/P2/P3, avec prérequis et prochaines actions ; les preuves des étapes précédentes restent archivées. Le Control Center affiche les chantiers encore ouverts et replie les diagnostics techniques déjà passés. Un nouvel outil compare **hors ligne** les métadonnées d'une sauvegarde et d'une restauration isolée, sans prétendre les avoir exécutées. [Chantiers ouverts](docs/CHANTIERS_OUVERTS.md) · [Guide de reprise](docs/P1_RECOVERY_PLAYBOOK.md).



Un message de félicitations aux **joueurs et staffs** apparaît automatiquement pour toute victoire **terminée et publiée** des Seniors A, Seniors B, Vétérans ou Senior futsal (Seniors C exclus), dans le Match Center et la fiche de l'équipe. Un message collectif apparaît sur l'accueil si les quatre équipes gagnent lors d'une même semaine récente. Les résultats tiers non confirmés ne déclenchent jamais ces messages. [Fonctionnement et tests](docs/ETAPE_40_FELICITATIONS_VICTOIRES.md).

## Calendrier mensuel et résultats anciens (22 octobre 2026)

L'Agenda possède désormais une **vue mensuelle dynamique** (mois passés et futurs), avec affichage des matchs joués et scores sourcés de la saison 2026-2027. Les rencontres publiées par le club restent distinguées des résultats externes qui ne sont **pas homologués officiellement**. Dans le Control Center, l'administrateur peut préparer une fiche à partir d'une source et la valider manuellement via le flux MFA existant. [Détails et sources](docs/ETAPE_38_CALENDRIER_DYNAMIQUE_ARCHIVES.md).

## Calendrier : affichage de dates sourcées même sans matchs publiés (22 octobre 2026)

Le calendrier Club et le Match Center avaient **0 match disponible dans Supabase**. Lorsqu'aucun match du club n'est publié, ils affichent maintenant des rencontres de sources externes datées, attribuées et explicitement **non confirmées par le club**. L'export `.ics` reste limité aux dates validées. Voir [correctif et provenance](docs/CORRECTIF_CALENDRIER_VISIBLE_20261022.md).

## Calendrier exportable et préparation FFF (22 octobre 2026)

La page Agenda propose un export `.ics` des rencontres et événements publics validés par le club, respectant les filtres affichés. Le Control Center propose une prévisualisation **sans écriture** d'un format de flux FFF partenaire futur pour le club d'affiliation **548423**. Aucune API FFF non documentée n'est appelée et **la synchronisation FFF n'est pas activée sans autorisation officielle**. [Détails, tests et prérequis d'accès](docs/ETAPE_37_CALENDRIER_FFF.md).

## Homologation P1 — Phase 3 (22 octobre 2026)

Droits Supabase des profils restreints aux colonnes `id` et `display_name` à la création, puis à `display_name` uniquement lors d'une modification, avec vérification de production. Les noms d’affichage sont validés côté serveur (2–80 caractères, sans caractères de contrôle) et le formulaire d’inscription suit les mêmes limites. Audit SQL de reprise et procédure sécurisée de restauration préparés ; **aucune restauration n'a encore été exécutée**. Plan Supabase Free confirmé ; la protection contre les mots de passe compromis de l'offre Pro n'est pas activée. [Bilan phase 3](docs/P1_HOMOLOGATION_PHASE3.md) · [Guide de reprise](docs/P1_RECOVERY_PLAYBOOK.md). [Procès-verbal d'homologation à compléter](docs/P1_PV_HOMOLOGATION.md).

## Homologation P1 — Phase 2 (22 octobre 2026)

Correction du lien d'évitement clavier pour le routeur `#/...` (la navigation reste sur la page consultée) ; nouveaux contrôles Chromium sur Mon espace public, libellés visibles, animations réduites et inventaire des domaines réseau, sans accès aux données personnelles. Un audit SQL de sécurité reproductible, en lecture seule, contrôle RLS et les privilèges des RPC. **L'homologation complète n'est pas atteinte :** comptes multi-identités, Safari/VoiceOver et Android réels, restauration sur base isolée, données légales et réglages Auth restent à valider. [Protocole de recette Phase 2](docs/P1_HOMOLOGATION_PHASE2.md).

## P1 — Contrôle HTTP manuel de GitHub Pages

En complément de la recette Chromium locale, la commande `npm run smoke:live` vérifie en **lecture seule** les fichiers réellement servis par GitHub Pages. Le workflow GitHub Actions « Vérifier manuellement GitHub Pages Boissy-UJ » est déclenché à la demande, indépendamment des tests des PR, pour éviter les faux échecs liés au délai de publication. Les captures des scénarios navigateur et l'inventaire RGPD demeurent disponibles dans les artefacts de la CI. [Protocole et limites](docs/P1_BROWSER_RGPD_INVENTAIRE.md).

## Étape 36 · Vérifications réelles dans Chromium et inventaire RGPD

La CI teste désormais les pages Accueil, Confidentialité, Mentions légales et Senior/Futsal dans Chrome headless, à 320, 390, 768 et 1366 pixels, et vérifie l'absence de débordement horizontal ainsi que l'accès au menu mobile et au clavier. Des captures PNG et un rapport sont fournis dans les artefacts GitHub Actions. Un inventaire des domaines externes et du stockage navigateur facilite l'audit technique RGPD. **La validation juridique et les essais physiques iPhone/Android restent à faire.** [Étape 36](docs/ETAPE_36_RECETTE_NAVIGATEUR_RGPD.md).

## P1 · Identité, navigation, confidentialité et préproduction sécurisée

L'accueil conserve ses huit chapitres et l'univers bleu nuit/doré ; les menus affichent désormais correctement **Senior** sous **Futsal**, y compris sur mobile. Deux pages de transparence sont disponibles via le pied de page et Mon espace, sans inventer les données légales du club. Le focus clavier, le mode animations réduites et l'export client pour GitHub Pages ont été renforcés. `npm run release:check` vérifie l'intégrité du bundle, les imports et l'absence de fichiers internes. **La validation juridique, l'audit navigateur multi-appareils et la preuve de restauration restent nécessaires avant la pleine recette.** [État et critères de sortie P1](docs/P1_IDENTITE_RGPD_DEPLOIEMENT.md).

## Étape 35 · P2 — Modification sécurisée des profils membres

Le Centre de gestion permet de corriger le nom d'affichage d'un autre compte membre, sous double confirmation et MFA AAL2 côté Supabase, avec historique privé et sans modifier le compte Auth, les rôles ou les affectations. Fonctionnalité inactive tant que la migration sécurisée n'est pas disponible. [Documentation P2](docs/ETAPE_35_P2_PROFILS_MEMBRES.md).

## Étape 34 · P1 — Affectations entraîneurs et gestion complète des rôles sportifs

Le Centre de gestion inclut désormais l'affectation MFA AAL2 des entraîneurs validés à une ou plusieurs équipes, avec retrait d'affectation et audit privé sans modification du rôle. Avec les espaces Joueur/Entraîneur, les convocations et la gestion des affiliations joueurs, le développement P1 est couvert ; il reste la recette multi-comptes. [Plan P1](docs/P1_ESPACES_SPORTIFS_RECETTE.md).

## Étape 33 · Affectations joueurs administrateur

Nouvelle rubrique administrateur pour rattacher les comptes possédant un rôle Joueur validé à des équipes, et pour retirer ces affiliations sous MFA AAL2 avec double confirmation et audit privé. Aucun compte ou rôle n'est créé. Ce rattachement permet au système de convocations entraîneur d'identifier uniquement les joueurs de son équipe. [Documentation](docs/ETAPE_33_AFFECTATIONS_JOUEURS.md).

## Étape 32 · Convocations privées côté entraîneur

Un éducateur officiellement affecté peut consulter les rencontres actives de son équipe, ses joueurs habilités et leurs statuts de réponse, puis inviter ou annuler une convocation après double confirmation. Les lectures privées sont assurées par deux RPC Supabase additionnelles limitées à ses équipes ; tant que la migration n'est pas appliquée, les commandes restent verrouillées. [Documentation](docs/ETAPE_32_CONVOCATIONS_ENTRAINEURS.md).

## Étape 31 · Espaces Joueur et Entraîneur réels

Le tableau de bord connecté affiche les contextes Joueur et Entraîneur uniquement si les rôles sont validés. Un joueur peut consulter ses propres convocations et répondre via RPC privée. Un entraîneur voit ses affectations et les rencontres publiées de ses équipes et peut enregistrer une nouvelle rencontre **en brouillon** via le serveur sécurisé. Aucune sélection nominative d'effectif n'est ouverte avant finalisation de sa protection. [Documentation](docs/ETAPE_31_ESPACES_JOUEUR_ENTRAINEUR.md).

## Étape 30 · Navigation administrateur accélérée

Le back-office réel propose une recherche de modules (sans tenir compte des accents), un menu classé par familles et des raccourcis depuis la vue générale vers les modules opérationnels. La mise en page téléphone est condensée ; tous les changements de rubrique repassent par la vérification MFA AAL2. [Étape 30](docs/ETAPE_30_NAVIGATION_ADMIN.md).

## Étape 28 · Récupération de configuration MFA inachevée

Le compte administrateur peut reprendre une activation TOTP abandonnée sans créer un facteur au nom déjà utilisé. Un redémarrage explicite remplace uniquement le facteur non vérifié, sans toucher au compte ni aux protections AAL2. [Guide de reprise MFA](docs/ETAPE_27_ADMINISTRATION_REELLE.md#correctif-mfa--facteur-non-vérifié--erreur-de-doublon-étape-28).

## Étape 27 · Administration réelle MFA AAL2

Le Control Center public de simulation est remplacé par le vrai back-office. Le compte administrateur doit activer sa double authentification TOTP dans Mon espace, puis rejoindre le panneau protégé. Modules actifs : membres et rôles, validations, effectifs publiables, saisons, matchs, actualités et identité du club. Aucune fonction non opérationnelle n’est simulée. [Documentation étape 27](docs/ETAPE_27_ADMINISTRATION_REELLE.md).

## Étape 26 · Confirmation e-mail et renvoi du message

Un bouton « Renvoyer l'e-mail de confirmation » est ajouté aux formulaires de connexion et d'inscription. Il utilise l'URL officielle GitHub Pages pour demander un nouveau lien via Supabase Auth. Le renvoi depuis localhost exige également le paramétrage de **Site URL** et de **Redirect URLs** dans le tableau de bord Supabase. [Guide de configuration](docs/ETAPE_25_SESSIONS_AUTH.md#correctif-étape-26--confirmation-e-mail-redirigée-vers-localhost).

## Étape 25 · Sessions et liens de connexion fiabilisés

Gestion des retours de confirmation et de récupération Supabase, suppression des paramètres PKCE temporaires de l'URL après leur traitement, garde contre les affichages concurrents, messages de succès persistants, et version Supabase JS épinglée. Administration toujours désactivée. [Étape 25](docs/ETAPE_25_SESSIONS_AUTH.md).

## Étape 24 · Connexion et inscription supporters

Le parcours « Mon espace » est rouvert pour les comptes supporters : inscription e-mail, connexion, déconnexion et récupération du mot de passe. Le retour PKCE des e-mails est pris en charge sur GitHub Pages. Les outils privilégiés restent désactivés (`adminEnabled:false`). **La configuration des URL Supabase Auth, la délivrabilité e-mail et les tests navigateur restent à confirmer.** [Étape 24](docs/ETAPE_24_CONNEXION_SUPABASE.md).

## Étape 23 · Répertoire des effectifs en administration

Un nouveau répertoire privé filtre les fiches d'effectifs/encadrement par équipe, brouillon ou publication, nom et rôle. Il propose actualisation, sélection directe et dépublication préparée avec confirmation. La gestion réelle reste fermée jusqu'à la recette Auth + MFA. Voir [étape 23](docs/ETAPE_23_GESTION_EFFECTIFS.md).

## Étape 22 · Liens directs entre équipes, matchs et actualités

Les liens depuis chaque fiche présélectionnent son équipe dans le Match Center et dans les actualités, grâce à des URL partageables et validées. Les cartes des rencontres et des actualités ramènent à la fiche de l'équipe. [Documentation étape 22](docs/ETAPE_22_LIENS_EQUIPES_MATCHS_ACTUALITES.md).

## Étape 21 · Fiches Équipes enrichies

Les cinq pages d'équipes affichent désormais les sections Effectif, Encadrement, Bilan sportif et Actualités, à partir de données autorisées publiquement. Les identités ne sont pas importées des comptes et ne deviennent publiques qu'après consentement vérifié et validation administrateur MFA AAL2. Voir [Étape 21](docs/ETAPE_21_FICHES_EQUIPES.md).

## Contenu disponible
- Accueil immersif avec huit chapitres et véritable écusson.
- Navigation ordinateur et mobile.
- Présentation des équipes, des matchs, des actualités, des événements, de la communauté et des dons.
- **Awards publics** des Seniors A, B et C : nouveau catalogue consultable avec filtres, nominations contrôlées et résultats publiés uniquement après vérification. Aucun vote actif. Voir [étape 14](docs/ETAPE_14_AWARDS_PUBLICS.md).
- **Nous rejoindre et Infos pratiques** : parcours interactifs joueurs, éducateurs, bénévoles et partenaires ; annonces publiées, FAQ, lieux/horaires et contacts officiels seulement lorsqu'ils sont vérifiés. Aucun formulaire de collecte des données personnelles. Voir [étape 15](docs/ETAPE_15_REJOINDRE_INFOS.md).
- **Notre club** : page publique des cinq équipes et rubriques éditoriales approuvées (histoire, valeurs, organisation, projets) avec recherche et filtre. [Étape 16](docs/ETAPE_16_NOTRE_CLUB.md).
- **Football & futsal** : cinq équipes, réparties en football à 11 (Seniors A, B, C, Vétérans) et futsal (Senior en Départemental 2), avec fiches distinctes, Match Center filtrable et formulaires préparés. [Étape 19](docs/ETAPE_19_FOOTBALL_FUTSAL.md).
- **Sous-pages Équipes** : menu à deux niveaux (Football à 11 / Futsal), pages catégorie, fiche pour chacune des cinq équipes, prochaines rencontres et résultats publiés sans données personnelles, navigation desktop/mobile accessible. [Étape 20](docs/ETAPE_20_MENU_EQUIPES.md).
- **Agenda du club** : page publique `#/agenda` réunissant les matchs programmés et les événements autorisés avec dates vérifiées, recherche, filtres et version mobile. Aucun rendez-vous fictif. [Étape 17](docs/ETAPE_17_AGENDA_UNIFIE.md).
- **CMS Histoire & identité** : atelier de prévisualisation du Control Center et futur éditeur d'administration protégé par MFA AAL2, workflow brouillon/publication/retrait et journal d'audit. L'authentification publique reste fermée. [Étape 18](docs/ETAPE_18_CMS_CLUB.md).
- « Mon espace » : formulaires d'inscription/connexion, traitement des retours e-mail et espaces Joueur/Entraîneur reliés à Supabase ; les tests réels e-mails, rôles et MFA sur plusieurs comptes sont encore nécessaires à l'homologation.
- Premium : 10 € mensuels ou 100 € pour douze mois, sans renouvellement automatique annuel ; aucune transaction réelle.
- Matrice de recette pondérée, seuil des 85 % pour lancer la recette finale.

## Présentation du jeudi 22 octobre

**Démonstration interactive accessible sur** [Boissy-UJ — Le site en action](https://diegosmp94.github.io/Boissy-UJ/#/presentation) : liens vers les véritables pages, contrôle de l'accès aux catalogues publics Supabase, ateliers locaux interactifs (matchs, actualités, convocations et saisons) sans données fictives publiées. Voir [scénario de démonstration et limites](docs/DEMO_JEUDI_20261022.md).

## Cahier des charges et droits des membres

[Cahier des charges fonctionnel V1.5](docs/CAHIER_DES_CHARGES.md) : règles de cumul joueur / entraîneur / administrateur (doubles et triples rôles), approbation administrative obligatoire pour chaque nouveau rôle, équipe éducateur distincte et MFA AAL2 sur les opérations administratives. Le schéma de base prend en charge les rôles cumulés, et les fonctions SQL d'approbation existent, mais **leur recette avec comptes distincts et MFA reste à mener avant ouverture**.

## État réel de Supabase

Les migrations de comptes, cinq équipes, matchs, actualités, événements, affectations sportives, contrôle des rôles cumulés, audit et sécurité sont présentes sur le projet Supabase. Les données réelles sont limitées : pas de matchs publiés, de billet ni de paiement réel ajouté par ces étapes. Les parcours de connexion et d'administration doivent encore être homologués avec des comptes autorisés. Voir [État Supabase vérifié](docs/ETAT_SUPABASE_20261021.md).

## Tests
Exécuter `npm test`. Les tests GitHub Actions sont lancés sur les branches de développement, les pull requests et `main`.

## Publication
Le projet est statique et peut être visualisé via GitHub Pages depuis la branche `main`, dossier `/(root)`, une fois Pages activé dans les paramètres GitHub.

**Attention : version de prévisualisation uniquement.** Les modules métier, les tests d'authentification en conditions réelles, la configuration légale et les paiements restent à homologuer. Les statistiques FFF ne sont pas simulées. Ne saisir aucune donnée personnelle réelle dans les fonctionnalités non validées.
