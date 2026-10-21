# Étape 8 — Ateliers éducateurs et rédaction

> **Mise à jour du 21 octobre 2026 : les migrations Supabase correspondantes sont maintenant APPLIQUÉES.** Les mentions ci-dessous indiquant « non appliquée » ou « en attente d’autorisation » sont l’historique des étapes précédentes, et non l’état actuel. Voir [État Supabase vérifié](ETAT_SUPABASE_20261021.md). Les écritures réelles et l’authentification publique restent désactivées jusqu’aux essais fonctionnels.


**État : développements de prévisualisation GitHub uniquement ; aucune écriture Supabase, aucun droit administratif réel.**

## Disponible dans le Control Center
- « Équipes & effectifs » : sélection entre Seniors A (D3), Seniors B (D4), Seniors C (amicaux) et Vétérans (D3).
- Préparation d'une fiche de match : adversaire, date/heure, domicile/extérieur, contrôle des champs et aperçu.
- Aperçus des futurs sous-modules effectifs, convocations, Match Center et passage de saison.
- « Actualités & médias » : atelier de rédaction avec équipe, titre, résumé et texte, contrôle de longueur, déclaration de vérification des droits et aperçu.
- **Tous les écrans sont des simulations en mémoire de l'onglet.** Aucun contenu n'est enregistré, aucune publication effectuée, aucune donnée privée n'est lue.
- Avertissement explicite : ne pas saisir de coordonnées personnelles, de données de joueurs ni de mineurs.
- Visuels bleu nuit, bleu royal et doré, avec mise en page adaptée au mobile et navigation clavier.

## Architecture SQL préparée (non appliquée)
Migration : `supabase/migrations/202610210006_staff_content_workflows.sql`.

Dépendances : les migrations d'authentification (appliquées), les équipes et les articles (non appliquées à ce jour).

- `staff_team_assignments` : portée de l'éducateur par équipe, active ou révoquée, lisible par le titulaire et l'admin MFA, modification interdite via le client.
- `staff_news_audit` : versions avant/après chaque création, modification, publication ou retrait, privé, sans permission client ; protection contre les modifications ordinaires. Une gestion des archives et des restaurations reste à développer.
- `staff_save_news_article(...)` : fonction serveur SQL exigeant une session ; accepte un **éducateur avec rôle coach ET affectation active à l'équipe**, ou un **administrateur avec rôle et MFA AAL2**. Aucun joueur ou supporter ne peut publier.
- L'éducateur ne peut pas transférer un article vers une autre équipe. L'administrateur habilité peut modérer les articles du club.
- Seul le **texte public** est pris en charge dans ce premier RPC. Médias/photos, contenus Premium et publications programmées nécessitent des mécanismes distincts.
- Publication directe des contenus d'équipe prévue pour les éducateurs habilités, avec déclaration de revue des droits et audit ; les règles légales/consentements effectifs devront être vérifiées en conditions réelles.

## À NE PAS FAIRE SANS NOUVELLE AUTORISATION
- Ne pas appliquer la migration sur Supabase dans ce lot. L'autorisation a été refusée précédemment.
- Ne pas ouvrir les inscriptions ni attribuer automatiquement le rôle `admin` ou `coach`.
- Ne pas activer d'API d'écriture publique ni de paiements LIVE.
- Ne pas présenter les aperçus comme de véritables modifications enregistrées.

## Tests de sortie
1. Lint/syntaxe et suite GitHub Actions.
2. Vérification structurelle du modèle de rôle et du contrôle du périmètre équipe dans les SQL préparés.
3. Validation des formulaires/affichages sur téléphone et clavier à effectuer lors de la recette globale.
4. Lors de la future application autorisée : tests dynamiques RLS/RPC avec comptes supporteur, joueur, coach assigné, coach non assigné, admin sans MFA et admin AAL2 ; vérification des journaux, des accès illégitimes et des publications.
5. Une fonctionnalité d'édition réelle ne sera déclarée terminée qu'après validation de tous les contrôles ci-dessus.

## Étape suivante
Après autorisation explicite et sécurisation des droits : installer les migrations nécessaires dans l'ordre, développer la vraie gestion des équipes et le vrai formulaire de publication, puis le système de suivi de versions/restauration.
