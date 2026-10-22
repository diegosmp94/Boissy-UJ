# Boissy-UJ — préversion du site officiel

Le dépôt contient le prototype visuel de Boissy-UJ en cours de développement. La branche `main` recevra les versions stabilisées, tandis que les prochaines améliorations pourront être réalisées sur des branches dédiées.

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
- **Football & futsal** : cinq équipes, réparties en football à 11 (Seniors A, B, C, Vétérans) et futsal (Boissy-UJ Futsal en Départemental 2), avec fiches distinctes, Match Center filtrable et formulaires préparés. [Étape 19](docs/ETAPE_19_FOOTBALL_FUTSAL.md).
- **Sous-pages Équipes** : menu à deux niveaux (Football à 11 / Futsal), pages catégorie, fiche pour chacune des cinq équipes, prochaines rencontres et résultats publiés sans données personnelles, navigation desktop/mobile accessible. [Étape 20](docs/ETAPE_20_MENU_EQUIPES.md).
- **Agenda du club** : page publique `#/agenda` réunissant les matchs programmés et les événements autorisés avec dates vérifiées, recherche, filtres et version mobile. Aucun rendez-vous fictif. [Étape 17](docs/ETAPE_17_AGENDA_UNIFIE.md).
- **CMS Histoire & identité** : atelier de prévisualisation du Control Center et futur éditeur d'administration protégé par MFA AAL2, workflow brouillon/publication/retrait et journal d'audit. L'authentification publique reste fermée. [Étape 18](docs/ETAPE_18_CMS_CLUB.md).
- Interface « Mon espace » implémentée et reliée à Supabase, mais **inscription et connexion désactivées dans cette préversion publique** en attendant la recette réelle (RGPD, e-mails et sécurité).
- Premium : 10 € mensuels ou 100 € pour douze mois, sans renouvellement automatique annuel ; aucune transaction réelle.
- Matrice de recette pondérée, seuil des 85 % pour lancer la recette finale.

## Présentation du jeudi 22 octobre

**Démonstration interactive accessible sur** [Boissy-UJ — Le site en action](https://diegosmp94.github.io/Boissy-UJ/#/presentation) : liens vers les véritables pages, contrôle de l'accès aux catalogues publics Supabase, ateliers locaux interactifs (matchs, actualités, convocations et saisons) sans données fictives publiées. Voir [scénario de démonstration et limites](docs/DEMO_JEUDI_20261022.md).

## Cahier des charges et droits des membres

[Cahier des charges fonctionnel V1.1](docs/CAHIER_DES_CHARGES.md) : règles de cumul joueur / entraîneur / administrateur (doubles et triples rôles), approbation administrative obligatoire pour chaque nouveau rôle, équipe éducateur distincte et MFA AAL2 sur les opérations administratives. Le schéma de base prend en charge les rôles cumulés, et les fonctions SQL d'approbation existent, mais **leur recette avec comptes distincts et MFA reste à mener avant ouverture**.

## État réel de Supabase

Les migrations de comptes, équipes, matchs, actualités, événements, affectations éducateurs, audit et sécurité ont été **appliquées au projet Boissy-UJ**. Les tables métier sont vides, à l’exception des cinq équipes déclarées ; aucun compte, billet ni paiement réel créé. La connexion publique demeure désactivée dans cette préversion. Voir [État Supabase vérifié](docs/ETAT_SUPABASE_20261021.md).

## Tests
Exécuter `npm test`. Les tests GitHub Actions sont lancés sur les branches de développement, les pull requests et `main`.

## Publication
Le projet est statique et peut être visualisé via GitHub Pages depuis la branche `main`, dossier `/(root)`, une fois Pages activé dans les paramètres GitHub.

**Attention : version de prévisualisation uniquement.** Les modules métier, les tests d'authentification en conditions réelles, la configuration légale et les paiements restent à homologuer. Les statistiques FFF ne sont pas simulées. Ne saisir aucune donnée personnelle réelle dans les fonctionnalités non validées.
