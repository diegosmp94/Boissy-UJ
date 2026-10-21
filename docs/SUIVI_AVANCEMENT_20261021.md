# Boissy-UJ — Tableau d'avancement (21 octobre 2026)

> **Pourcentages indicatifs**, établis à partir des fichiers du dépôt, de l'état du projet Supabase et des validations existantes. **Ce ne sont ni des mesures instrumentées ni une recette validée à 85 %.** La disponibilité d'un schéma SQL ou d'une prévisualisation ne prouve pas qu'une fonction est prête pour les membres.

## Lecture synthétique
- **Socle technique conçu/développé : environ 65 %** (écrans, tables, règles de sécurité, fonctions serveur et tests statiques).
- **Site complet réellement exploitable : environ 40 %**. L'écart provient principalement des fonctions privées bloquées par l'authentification désactivée, de l'absence de contenu réel et des paiements non ouverts.
- **Objectif de livraison :** score pondéré de recette d'au moins **85 %**, sans anomalie critique ni écart de sécurité. Non atteint.

## Chantier par chantier — estimation qualitative

| Chantier | Avancement estimatif | Ce qui existe | Ce qui manque avant recette |
|---|---:|---|---|
| Accueil, identité et navigation | 85 % | Huit chapitres, écusson, design responsive, préversion mobile | Recette multi-navigateurs, accessibilité et contenus |
| Équipes, Match Center et saisons | 60 % | Quatre équipes réelles, lecture résultats, bilans collectifs, saisons, RPC protégées | Données sportives officielles vérifiées, gestion de saison et tests avec vrais comptes |
| Actualités, médias et événements | 45 % | Pages et catalogues de lecture, publication contrôlée préparée, cartes événements | Éditeurs opérationnels sécurisés, droit à l'image, stockage média, réservation |
| Connexion, rôles, espace membre | 35 % | Auth/RLS, rôles cumulables, demandes/approbations SQL, interfaces conditionnelles | Auth désactivée en public, MFA/accès et e-mails non homologués, comptes de test |
| Control Center et gestion éducateurs | 35 % | Aperçus de gestion équipes, articles, matchs, saisons, autorisations | Écritures raccordées et validées, rôles réels, audit consultable, permissions croisées |
| Premium, dons, billetterie | 15 % | Design et schémas de produits prévus | Paiements TEST, webhook, suivi abonnement, billetterie, conformité avant LIVE |
| Cybersécurité, conformité et recette | 45 % | Migrations, RLS, tests GitHub, SQL sans session, vérifications automatiques | Tests d'intrusion adaptés, E2E multi-identités et MFA, RGPD, documents légaux, mobile |

Les valeurs de chaque chantier expriment un **ordre de grandeur produit**, non des ratios de code ni des garanties de production. La synthèse 40 % est un jugement conservateur global, **pas la moyenne arithmétique directe de ces lignes**.

## Livré dans le lot « modération des rôles »
- Interface prévue dans **Mon espace uniquement lorsque la connexion est activée**, aucun panneau administratif exposé sur la prévisualisation publique.
- Avant de charger les demandes, vérification utilisateur via Supabase Auth, rôle `admin` approuvé et MFA AAL2.
- Liste des demandes par statut, lecture autorisée par la politique RLS SQL existante ; les membres ordinaires ne peuvent pas lire celles des autres.
- Refus d'auto-approbation et **confirmation explicite en deux clics** avant l'appel à `admin_decide_role_request`.
- Nouveau contrôle des droits et du niveau MFA immédiatement avant l'envoi ; Supabase effectue ses propres contrôles transactionnels indépendamment du navigateur.
- Aucun encaissement, création de compte ou promotion administrative réalisée par la mise à jour.

## Pour atteindre 85 % de recette
1. Finaliser la configuration Supabase Auth : e-mails, redirections, sessions, protections anti-abus, MFA administrateur et bootstrap sûr du premier admin.
2. Préparer des identités de test consenties et distinctes : supporter, joueur, coach d'équipe A, coach d'équipe B, admin sans MFA et admin MFA AAL2. Tester approbation, refus, révocation et cumuls.
3. Raccorder les formulaires d'administration réellement autorisés aux RPC, en contrôlant les données d'équipes, matchs, convocations et articles.
4. Développer le cycle éditorial brouillon → publication → restauration et la gestion des fichiers autorisés.
5. Terminer Premium et les réservations en Stripe TEST, vérifier webhooks/signatures et les cas d'échec ; aucune activation LIVE automatique.
6. Vérifier les traitements de données personnelles, le consentement parental quand nécessaire, la conservation, et les mentions obligatoires.
7. Effectuer les essais iOS/Android/ordinateur, accessibilité, performance, résilience, suppression/restauration puis recette pondérée finale.

**À ne pas confondre :** les tests Node et GitHub Actions vérifient essentiellement du code, des validations statiques et des fonctions isolées. Ils ne remplacent pas une session navigateur sécurisée ni des tests de vrais rôles et droits.
