# Étape 58 B — Préproduction locale et limite Supabase Free

**23 octobre 2026 — Solution préparée sans frais de nouveau projet Supabase.**

## Échec de création du staging cloud

Supabase annonce un coût de projet de 0 par mois pour l'organisation Boissy-UJ, mais la création de Boissy-UJ Staging a été refusée : le compte propriétaire atteint la limite de deux projets Free actifs toutes organisations comprises. Une nouvelle lecture confirme qu'aucun projet et aucune branche n'a été créé dans l'organisation Boissy-UJ. Le coût consulté pour les branches est de 0,01344 $/heure ; aucune branche facturable n'a été créée. Aucun projet existant n'a été modifié ni mis en pause.

## Solution gratuite pour les services Supabase : Docker local

Les fichiers du dépôt ont maintenant une identité de projet local indépendante : boissy-uj-local sous PostgreSQL 17, comme la production. Les répertoires temporaires du CLI sont ignorés par Git. Le script de garde-fou npm run local:preflight vérifie le projet local, l'absence de liaison cloud Supabase et la présence d'une CLI et d'un Docker actif. Il ne transmet aucune donnée au cloud et ne lance pas de migration.

Sur un ordinateur de développement **sécurisé**, avec Docker Desktop et la CLI Supabase installés :

1. Cloner le dépôt dans un nouveau répertoire indépendant.
2. Ouvrir un terminal dans le clone.
3. Exécuter : npm run local:preflight
4. Examiner les fichiers préparés : npm run staging:migration-plan
5. Vérifier la documentation de la CLI installée : supabase start --help
6. **Après audit des migrations historiques**, lancer manuellement : supabase start
7. Examiner les erreurs de migration et réaliser les essais sur des utilisateurs **fictifs locaux uniquement**.
8. Arrêter les services en fin de test : supabase stop

**Ne pas faire** : Supabase login, link, db push, db pull ni utiliser un identifiant, un secret, un export Auth ou un mot de passe de production pour effectuer cet essai. Le répertoire de travail local doit rester sans liaison avec tout projet distant.

La pile Docker locale n'est **pas durcie pour Internet** : ne pas exposer ses ports, mots de passe de démonstration ou interfaces en dehors de l'ordinateur et d'un réseau fiable. Les configurations locales peuvent aussi nécessiter des ports libres.

**Limites** : aucune instance Docker n'a été démarrée ici, et le dépôt contient des migrations qui doivent encore être testées et corrigées avant une application locale complète. Il reste à effectuer les tests Auth/RLS multi-comptes et une restauration isolée réelle. Ce remplacement local ne vaut pas recette d'un staging hébergé et ne permet pas d'affirmer l'étape 58 terminée.

Documentation officielle : https://supabase.com/docs/guides/local-development/cli/getting-started et https://supabase.com/docs/guides/local-development/cli-workflows
