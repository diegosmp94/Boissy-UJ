# Boissy-UJ — préversion du site officiel

Le dépôt contient le prototype visuel de Boissy-UJ en cours de développement. La branche `main` recevra les versions stabilisées, tandis que les prochaines améliorations pourront être réalisées sur des branches dédiées.

## Contenu disponible
- Accueil immersif avec huit chapitres et véritable écusson.
- Navigation ordinateur et mobile.
- Présentation des équipes, des matchs, des actualités, des événements, de la communauté et des dons.
- **Awards publics** des Seniors A, B et C : nouveau catalogue consultable avec filtres, nominations contrôlées et résultats publiés uniquement après vérification. Aucun vote actif. Voir [étape 14](docs/ETAPE_14_AWARDS_PUBLICS.md).
- **Nous rejoindre et Infos pratiques** : parcours interactifs joueurs, éducateurs, bénévoles et partenaires ; annonces publiées, FAQ, lieux/horaires et contacts officiels seulement lorsqu'ils sont vérifiés. Aucun formulaire de collecte des données personnelles. Voir [étape 15](docs/ETAPE_15_REJOINDRE_INFOS.md).
- **Notre club** : page publique des quatre équipes et rubriques éditoriales approuvées (histoire, valeurs, organisation, projets) avec recherche et filtre. [Étape 16](docs/ETAPE_16_NOTRE_CLUB.md).
- **Agenda du club** : page publique `#/agenda` réunissant les matchs programmés et les événements autorisés avec dates vérifiées, recherche, filtres et version mobile. Aucun rendez-vous fictif. [Étape 17](docs/ETAPE_17_AGENDA_UNIFIE.md).
- Interface « Mon espace » implémentée et reliée à Supabase, mais **inscription et connexion désactivées dans cette préversion publique** en attendant la recette réelle (RGPD, e-mails et sécurité).
- Premium : 10 € mensuels ou 100 € pour douze mois, sans renouvellement automatique annuel ; aucune transaction réelle.
- Matrice de recette pondérée, seuil des 85 % pour lancer la recette finale.

## Présentation du jeudi 22 octobre

**Démonstration interactive accessible sur** [Boissy-UJ — Le site en action](https://diegosmp94.github.io/Boissy-UJ/#/presentation) : liens vers les véritables pages, contrôle de l'accès aux catalogues publics Supabase, ateliers locaux interactifs (matchs, actualités, convocations et saisons) sans données fictives publiées. Voir [scénario de démonstration et limites](docs/DEMO_JEUDI_20261022.md).

## Cahier des charges et droits des membres

[Cahier des charges fonctionnel V1.1](docs/CAHIER_DES_CHARGES.md) : règles de cumul joueur / entraîneur / administrateur (doubles et triples rôles), approbation administrative obligatoire pour chaque nouveau rôle, équipe éducateur distincte et MFA AAL2 sur les opérations administratives. Le schéma de base prend en charge les rôles cumulés, mais **le flux d'approbation réel est encore à développer**.

## État réel de Supabase

Les migrations de comptes, équipes, matchs, actualités, événements, affectations éducateurs, audit et sécurité ont été **appliquées au projet Boissy-UJ**. Les tables métier sont vides, à l’exception des quatre équipes déclarées ; aucun compte, billet ni paiement réel créé. La connexion publique demeure désactivée dans cette préversion. Voir [État Supabase vérifié](docs/ETAT_SUPABASE_20261021.md).

## Tests
Exécuter `npm test`. Les tests GitHub Actions sont lancés sur les branches de développement, les pull requests et `main`.

## Publication
Le projet est statique et peut être visualisé via GitHub Pages depuis la branche `main`, dossier `/(root)`, une fois Pages activé dans les paramètres GitHub.

**Attention : version de prévisualisation uniquement.** Les modules métier, les tests d'authentification en conditions réelles, la configuration légale et les paiements restent à homologuer. Les statistiques FFF ne sont pas simulées. Ne saisir aucune donnée personnelle réelle dans les fonctionnalités non validées.
