# Étape 28 — Gestion éditoriale et sportive : productivité

## Livré
- **Actualité générale du club** : une actualité peut désormais concerner tout Boissy-UJ, sans affectation artificielle à Seniors A/B/C, Vétérans ou Futsal. L'interface transmet `p_team_id:null` à la RPC existante `staff_save_news_article`. Cette possibilité est réservée au centre administrateur contrôlé avec MFA AAL2.
- **Actualités d'équipe** : une équipe précise peut toujours être sélectionnée. La validation des droits reste obligatoire pour publier, et un brouillon peut être conservé sans publication.
- **Saisons** : contrôles avant enregistrement des libellés, années et dates, cohérents avec `admin_save_season`.
- **Matchs** : contrôle des équipes, saisons, adversaires, dates, statuts et scores avant appel à `staff_save_match`. Aucun score n'est accepté pour un match non joué.
- **Brouillons / dossiers** : ajout d'un bouton **Actualiser les dossiers** conservant la sélection quand elle existe.
- **Erreurs de gestion** : messages précis pour refus MFA, conflit de doublon, modification concurrente et champs invalides ; aucune erreur SQL détaillée n'est affichée aux visiteurs.

## Sécurité
- Aucune modification des permissions Supabase, migrations, clés ou rôles.
- Les contrôles côté navigateur améliorent l'ergonomie ; les RPC côté serveur restent seules responsables des droits et des validations.
- Aucune publication fictive ni suppression de compte.
- Les actualités générales utilisent la colonne `news_posts.team_id` déjà facultative et sont visibles dans le flux général, pas dans les fiches propres à une équipe.

## Validation
Six tests automatisés complémentaires et tests GitHub Actions de non-régression. Les scénarios de publication réelle nécessitent toujours une vérification depuis un compte administrateur avec MFA.
