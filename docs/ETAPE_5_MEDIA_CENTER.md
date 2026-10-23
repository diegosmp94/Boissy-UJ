# Étape 5 — Media Center public Boissy-UJ

> **État actualisé :** les migrations des catalogues d'actualités et de médias sont appliquées selon l'[état Supabase vérifié](ETAT_SUPABASE_20261021.md). L'authentification standard est disponible ; les publications restent soumises aux droits, consentements et contrôles administrateur décrits dans les étapes récentes. Les mentions de préparation qui suivent décrivent le périmètre initial de cette étape.


**Livraison :** interface publique en lecture seule et schéma appliqué. Les contenus restent vides tant qu'ils ne sont pas publiés et autorisés par le club.

## Fonctionnalités du lot
- Rubrique Actualités reliée à la lecture d'articles publiés, avec filtres Articles/Galeries/Vidéos et recherche.
- Les documents sont présentés sous forme de cartes extensibles, avec dates et texte lisible sur smartphone.
- Les données reçues sont insérées dans le DOM par `textContent`, sans injection de HTML fourni par les éditeurs.
- Lecture publique limitée aux articles `published` et `public` avec autorisations revues et date de publication atteinte.
- Les contenus premium, brouillons, programmés, archivés et photos non autorisées ne sont jamais renvoyés par la politique RLS prévue.
- En l'absence de base ou en cas d'incident, l'interface reste disponible avec une explication et aucun article fictif.
- Aucune gestion de commentaire ou messagerie.

## Limites
**Note historique :** la migration `supabase/migrations/202610210004_news_public_v1.sql` a depuis été appliquée ; voir le rapport Supabase daté du 21 octobre. L'édition et la publication utilisent désormais les RPC protégées documentées à l'étape 27.

Pas encore d'éditeur d'articles sécurisé, de stockage de médias, de gestion des consentements, ni de contrôle côté serveur pour les contenus premium. Le choix des visuels et des consentements des mineurs doit être finalisé avant publication.

## Prochaine extension
- Backend de publication réservée aux éducateurs habilités pour leurs équipes et aux administrateurs, avec audit.
- Gestion sécurisée de l'upload (formats, tailles, droits à l'image, antivirus si approprié).
- Galerie photo et lecteur vidéo autorisés.
- Un véritable contrôle d'accès premium fondé sur les droits serveur vérifiés après paiement, pas sur le client.
- Tests des migrations, RLS et des sessions sur environnement de test avec autorisation.
