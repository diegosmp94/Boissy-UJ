# Étape 5 — Media Center public Boissy-UJ

> **Mise à jour du 21 octobre 2026 : les migrations Supabase correspondantes sont maintenant APPLIQUÉES.** Les mentions ci-dessous indiquant « non appliquée » ou « en attente d’autorisation » sont l’historique des étapes précédentes, et non l’état actuel. Voir [État Supabase vérifié](ETAT_SUPABASE_20261021.md). Les écritures réelles et l’authentification publique restent désactivées jusqu’aux essais fonctionnels.


**Livraison : interface et schéma prêts dans GitHub. Aucune migration éditoriale appliquée.**

## Fonctionnalités du lot
- Rubrique Actualités reliée à la lecture d'articles publiés, avec filtres Articles/Galeries/Vidéos et recherche.
- Les documents sont présentés sous forme de cartes extensibles, avec dates et texte lisible sur smartphone.
- Les données reçues sont insérées dans le DOM par `textContent`, sans injection de HTML fourni par les éditeurs.
- Lecture publique limitée aux articles `published` et `public` avec autorisations revues et date de publication atteinte.
- Les contenus premium, brouillons, programmés, archivés et photos non autorisées ne sont jamais renvoyés par la politique RLS prévue.
- En l'absence de base ou en cas d'incident, l'interface reste disponible avec une explication et aucun article fictif.
- Aucune gestion de commentaire ou messagerie.

## Limites
La migration `supabase/migrations/202610210004_news_public_v1.sql` dépend de l'existence de `club_teams` et **n'est pas appliquée**. L'autorisation de mutation Supabase n'a pas été accordée lors du lot précédent ; nous n'effectuons pas de nouvelle tentative de mutation.

Pas encore d'éditeur d'articles sécurisé, de stockage de médias, de gestion des consentements, ni de contrôle côté serveur pour les contenus premium. Le choix des visuels et des consentements des mineurs doit être finalisé avant publication.

## Prochaine extension
- Backend de publication réservée aux éducateurs habilités pour leurs équipes et aux administrateurs, avec audit.
- Gestion sécurisée de l'upload (formats, tailles, droits à l'image, antivirus si approprié).
- Galerie photo et lecteur vidéo autorisés.
- Un véritable contrôle d'accès premium fondé sur les droits serveur vérifiés après paiement, pas sur le client.
- Tests des migrations, RLS et des sessions sur environnement de test avec autorisation.
