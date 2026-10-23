# Étape 8 — Ateliers éducateurs et rédaction

> **État actualisé :** les workflows du personnel et les migrations de base sont consignés dans l'[état Supabase vérifié](ETAT_SUPABASE_20261021.md). L'authentification des comptes standards est disponible ; les mutations restent contrôlées par rôle, équipe, MFA et RPC serveur.


**Périmètre historique :** cette étape a introduit les premières maquettes et workflows. Le Control Center avec fonctions réelles protégées est décrit à l'[étape 27](ETAPE_27_ADMINISTRATION_REELLE.md) ; les espaces joueur/entraîneur le sont aux étapes 31 à 34.

## Disponible dans le Control Center
- « Équipes & effectifs » : sélection entre Seniors A (D3), Seniors B (D4), Seniors C (amicaux) et Vétérans (D3).
- Préparation d'une fiche de match : adversaire, date/heure, domicile/extérieur, contrôle des champs et aperçu.
- Aperçus des futurs sous-modules effectifs, convocations, Match Center et passage de saison.
- « Actualités & médias » : atelier de rédaction avec équipe, titre, résumé et texte, contrôle de longueur, déclaration de vérification des droits et aperçu.
- Les aperçus de cette étape sont uniquement visuels ; ils n'enregistrent pas de contenu et ne lisent pas de données privées.
- Avertissement explicite : ne pas saisir de coordonnées personnelles, de données de joueurs ni de mineurs.
- Visuels bleu nuit, bleu royal et doré, avec mise en page adaptée au mobile et navigation clavier.

## Architecture SQL
Migration : `supabase/migrations/202610210006_staff_content_workflows.sql`.

Dépendances : migrations d'authentification, équipes et actualités appliquées selon le rapport du 21 octobre 2026.

- `staff_team_assignments` : portée de l'éducateur par équipe, active ou révoquée, lisible par le titulaire et l'admin MFA, modification interdite via le client.
- `staff_news_audit` : versions avant/après chaque création, modification, publication ou retrait, privé, sans permission client ; protection contre les modifications ordinaires. Une gestion des archives et des restaurations reste à développer.
- `staff_save_news_article(...)` : fonction serveur SQL exigeant une session ; accepte un **éducateur avec rôle coach ET affectation active à l'équipe**, ou un **administrateur avec rôle et MFA AAL2**. Aucun joueur ou supporter ne peut publier.
- L'éducateur ne peut pas transférer un article vers une autre équipe. L'administrateur habilité peut modérer les articles du club.
- Seul le **texte public** est pris en charge dans ce premier RPC. Médias/photos, contenus Premium et publications programmées nécessitent des mécanismes distincts.
- Publication directe des contenus d'équipe prévue pour les éducateurs habilités, avec déclaration de revue des droits et audit ; les règles légales/consentements effectifs devront être vérifiées en conditions réelles.

## Garde-fous encore applicables
- L'authentification standard est disponible, mais aucun rôle `admin` ou `coach` n'est attribué automatiquement.
- Ne pas activer les paiements LIVE.
- Ne pas présenter les aperçus de maquette comme de véritables modifications enregistrées.

## Tests de sortie
1. Lint/syntaxe et suite GitHub Actions.
2. Vérification structurelle du modèle de rôle et du contrôle du périmètre équipe dans les SQL préparés.
3. Validation des formulaires/affichages sur téléphone et clavier à effectuer lors de la recette globale.
4. Lors de la future application autorisée : tests dynamiques RLS/RPC avec comptes supporteur, joueur, coach assigné, coach non assigné, admin sans MFA et admin AAL2 ; vérification des journaux, des accès illégitimes et des publications.
5. Une fonctionnalité d'édition réelle ne sera déclarée terminée qu'après validation de tous les contrôles ci-dessus.

## Étape suivante
Pour l'état actuel des écrans d'administration, des RPC et de la recette restante, consulter [l'étape 27](ETAPE_27_ADMINISTRATION_REELLE.md) et le [plan de développement](PLAN_DEVELOPPEMENT.md).
