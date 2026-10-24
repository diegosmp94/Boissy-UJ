# Fiche joueur publique — aperçu fonctionnel et profils autorisés

**24 octobre 2026 — Développement frontend, sans modification des données de production.**

## URL de démonstration

`https://diegosmp94.github.io/Boissy-UJ/#/joueurs/apercu`

Accessible depuis chaque fiche d'équipe et le bloc « Effectif ». Cette route ne demande aucune authentification et ne contient aucune identité réelle ni photographie fictive.

## Présentation

- En-tête bleu nuit et doré avec **emplacement pour portrait**, nom public approuvé, poste, numéro de maillot, équipe et niveau.
- Six informations : âge, poste, équipe, discipline, numéro et saison.
- Quatre blocs de statistiques individuelles : matchs joués, buts, passes décisives et minutes jouées.
- Biographie/présentation et navigation interne vers les équipes.
- Design responsive, repères `role=img`, `role=status`, affichage DOM via `textContent` pour les données venues de Supabase.

### Important : champs réellement disponibles

L'unique catalogue public approuvé `public.team_public_people` fournit actuellement `id`, `team_id`, `display_name`, `person_kind`, `role_label`, `shirt_number`, `biography`, `published` et `consent_confirmed`.

| Champ | État |
|---|---|
| Nom, poste, numéro, bio et équipe | Affichés seulement depuis une ligne **joueur, publiée, autorisée** |
| Portrait/photo | Placeholder neutre ; **aucune photo actuellement disponible dans le schéma** |
| Âge | « Non publié » ; **aucune date de naissance collectée pour cette page** |
| Matchs, buts, passes et minutes | Tiret « — » ; **aucune statistique individuelle approuvée** |
| Statistiques collectives | Conservées sur les pages d'équipes, distinctes des données individuelles |

Les zéros seraient trompeurs quand aucune statistique n'a été fournie : une valeur inconnue reste donc `—`.

## Sécurité et droits

- Les fiches individuelles réelles utilisent `#/joueurs/<uuid>`. L'UUID est validé avant toute lecture réseau.
- Les seules requêtes sont deux GET publics à `team_public_people` (joueur + `published=true` + `consent_confirmed=true`) et `club_teams` (UUID de l'équipe lié à l'une des cinq catégories connues). Le contrôle RLS côté serveur s'applique également.
- Une fiche retirée, un joueur non validé, un mauvais identifiant, une panne réseau ou une équipe incohérente n'exposent **aucune information individuelle**.
- Timeout 12 secondes, annulation au changement de page et absence de nouvelles écritures SQL.
- Les photos, âges et nouvelles statistiques ne doivent être ajoutés qu'avec un modèle de données et un workflow d'autorisation **approuvés par le club**. Pour les mineurs, vérifier le cadre de publication, la durée de conservation et les autorisations parentales nécessaires. **Ne pas collecter de date de naissance complète pour afficher simplement un âge.**

## Ce qui n'est PAS terminé

Aucun joueur de production n'est renseigné dans le catalogue `team_public_people` à la date de contrôle. Le template est fonctionnel et visible, mais l'enrichissement réel dépend des contenus du club et de leurs droits de publication.

Avant d'activer portrait, âge et statistiques :
1. Définir les champs strictement nécessaires et leur durée de conservation ; ajouter les contrôles SQL et d'accès selon les règles déjà existantes.
2. Prévoir la saisie via un espace administratif MFA AAL2, avec brouillon, preuve d'autorisation, retrait et journal d'audit.
3. Recetter deux sessions (admin AAL2 et visiteur anonyme) puis vérifier le retrait de publication et les images sur iOS/Android.

## Tests

`tests/player-profile-page.test.mjs` vérifie les gardes UUID, refus des brouillons, consentement, discipline, GET uniquement, absence de données fictives et rendu responsive.
`scripts/browser-smoke.mjs` ouvre l'aperçu à largeur mobile et contrôle la présence du portrait, des informations, des statistiques et du bandeau de démonstration.
