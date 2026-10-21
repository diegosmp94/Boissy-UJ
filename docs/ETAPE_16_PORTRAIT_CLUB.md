# Étape 16 — Présentation officielle du club Boissy-UJ

## Objectif
Développer une véritable rubrique publique **« Le club »**, distincte de `#/presentation` qui reste une démonstration interactive des fonctionnalités.

## Site
- Nouvelle route `#/le-club` reliée à l'accueil, au menu mobile et au pied des pages.
- Introduction visuelle bleu nuit et doré avec écusson, puis quatre équipes déjà validées : Seniors A (D3), Seniors B (D4), Seniors C (amicaux) et Vétérans (D3).
- Présentation institutionnelle structurée en histoire, identité, valeurs, organisation et projets. Chaque thème et chaque texte est affiché uniquement si le club l'a **vérifié puis publié**.
- Recherche sans accents et filtre par thème. Les textes externes sont rendus en DOM avec `textContent`.
- Chronologie des événements passés : date de précision année/mois/jour et publication après vérification uniquement. Aucune date de création, dirigeant ou réussite n'est inventée.
- Pages associées : équipes, Match Center, Actualités, Rejoindre, Infos pratiques et Soutenir.
- Messages explicites si un contenu n'a pas encore été fourni, ainsi qu'une introduction toujours utilisable avec les quatre équipes confirmées.
- Grilles adaptatives iOS/Android, focus visible, préférences de réduction du mouvement et annulation des requêtes au changement de route.

## Supabase
Migration : `supabase/migrations/202610210016_public_club_story.sql`.
- `public.club_story_sections` : textes institutionnels par thématique, ordre d'affichage, visibilité et horodatage de vérification.
- `public.club_story_milestones` : chronologie factuelle avec date, précision et horodatage de vérification.
- Deux tables sous RLS. Visiteurs anonymes et comptes connectés : **SELECT sur les lignes `published=true` avec `reviewed_at` renseigné uniquement** ; aucun INSERT, UPDATE ou DELETE client.
- Aucun événement, date de fondation, nom de dirigeant ou texte officiel fictif ajouté par la migration.
- Aucune fonction SQL d'élévation de privilège ou de paiement.
- La rédaction et la publication institutionnelle seront à raccorder ultérieurement à un véritable éditeur sécurisé et audité après homologation de l'authentification administrative.

## Critères de tests
1. Les équipes sont visibles depuis la version actuelle vérifiée du projet.
2. Les sections en brouillon ou non vérifiées restent invisibles.
3. La chronologie est correctement triée, avec précision année/mois/jour.
4. Les requêtes Supabase utilisent GET et la clé publique uniquement.
5. Navigation SPA depuis accueil, mobile et footer, et annulation des requêtes périmées.
6. Aucune donnée inventée si Supabase est vide.
7. Tests CI et déploiement GitHub Pages au dernier commit fusionné.

Les informations historiques, le règlement intérieur, la composition du bureau, les autorisations pour portraits individuels et les éléments juridiques devront être communiqués ou validés par Boissy-UJ avant publication réelle. Authentification publique, MFA, candidatures nominatives et paiements restent désactivés.
