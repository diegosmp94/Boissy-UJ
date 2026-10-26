# Étape 77 — Réactions « J’aime » aux actualités

**26 octobre 2026 — Développement technique.** Aucune réaction, publication ni identité de membre réelle n'a été ajoutée pendant cette étape.

## Audit préalable

La page des actualités chargeait déjà le module `news-reactions.mjs`, avec invitation à se connecter, état personnel « J’aime / Retirer mon j’aime », retour accessible et sans commentaire. La migration `202610230001_member_news_reactions.sql` préparait la table `news_reactions` et ses politiques RLS, mais **n'était pas encore appliquée** en production. Le contrôleur pouvait inclure des photos et vidéos non assimilables à un article, et ne revérifiait pas la session au clic.

Production vérifiée avant application : table de réactions absente, **0 actualité** enregistrée ; aucune réaction existante à migrer.

## Schéma et sécurité

- `public.news_reactions(post_id,user_id,created_at)` : **clé primaire `(post_id,user_id)`**, une seule réaction possible par compte et publication ; références avec suppression en cascade lors de la suppression d'un compte ou de l'article.
- `RLS` active : seul le titulaire authentifié peut lire, ajouter et supprimer sa réaction. Aucun accès anonyme, aucun `UPDATE` et aucune lecture des réactions d'autres membres. Pas de compteur public ni de liste des personnes ayant réagi.
- L'insertion exige un **article texte** réellement publié, public, avec droits revus et date de publication atteinte. Les galeries/vidéos, brouillons, publications non autorisées, premium et programmées ne sont pas éligibles.
- Une fonction déclenchée à l'insertion verrouille le post `FOR SHARE` et revérifie propriétaire et publication active, ce qui bloque une insertion tardive après une dépublication concurrente.
- La dépublication d'un article (retour en brouillon, passage en archive/privé, révocation des droits ou changement de type) **supprime ses réactions dans la transaction**, pour éviter de conserver des données personnelles obsolètes ou de « ressusciter » une ancienne préférence après republication.
- Les fonctions de déclenchement sont en schéma privé `app_private`, avec `SECURITY DEFINER SET search_path=''`, sans droit d'exécution des rôles client. Les données membres restent sous RLS sur la nouvelle table exposée.

Ce périmètre prévient les doublons, les écritures pour autrui et les interactions avec des publications non éligibles. Il ne prétend pas constituer un dispositif général de détection automatisée du spam ou de modération comportementale.

## Interface

- Le contrôleur propose le bouton uniquement pour les **articles** identifiés par UUID ; les autres contenus du Media Center demeurent consultables mais sans réaction.
- Le clic vérifie à nouveau le compte courant via `auth.getUser()` : un changement de session rend l'action impossible plutôt que d'agir au nom de l'ancien compte.
- Deux réactions identiques concurrentes aboutissent à la contrainte SQL de clé primaire. En cas de doublon `23505`, le contrôleur relit uniquement la réaction du compte courant et corrige le bouton, sans annoncer une seconde création.
- Les clics multiples sont bloqués pendant la requête. Les réponses arrivant après suppression du bouton n'en modifient plus le DOM.
- Un visiteur non connecté conserve l'accès aux actualités et un lien interne vers « Mon espace ». L'échec du module Auth ou des réactions ne bloque jamais le flux public.

## Vérification et limites

Tests existants `tests/news-reactions.test.mjs` et nouveaux contrôles `tests/step77-news-reactions-rls.test.mjs` : exclusivité par compte, statut de publication, nettoyage sur dépublication, verrou anti-concurrence, sécurité des sessions et non-blocage du Media Center.

Aucune information nominative ni compteur d'engagement n'est rendu public. L'homologation de comptes réels et la vérification du consentement aux contenus restent hors de la validation technique. Le module de stockage de médias et les fonctionnalités premium ne sont pas activés.

**Étape 78 suivante :** sécurité et workflow des médias validés, à examiner indépendamment.
