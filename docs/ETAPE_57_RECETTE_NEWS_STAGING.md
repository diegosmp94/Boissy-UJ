# Étape 57 — Recette réelle de préproduction pour l'historique des actualités

**23 octobre 2026.** Ce lot ajoute une recette de sécurité **en lecture seule** pour les permissions administrateur/Supporter. **Une seule instance Supabase est connectée (production)** : aucun test réel sur staging n'a encore été exécuté. Les tests CI simulent le protocole et ne constituent pas une homologation.

## Développement réalisé

Le script scripts/real-news-revisions-smoke.mjs, lancé par npm run smoke:news-revisions :

- Refuse par défaut l'exécution et exige un accord explicite, un projet Supabase staging **différent de la production**, son URL HTTPS exacte et seulement une clé publique de staging.
- Exige deux comptes d'essai distincts, avec email vérifié, puis vérifie **leurs rôles réels** sur la table user_roles : administrateur et Supporter.
- Vérifie que la RPC d'historique refuse la lecture anonyme, le Supporter et l'administrateur en AAL1.
- Vérifie que l'indicateur de disponibilité de l'administration reste faux en AAL1.
- Effectue un défi TOTP réel sur le compte administrateur pour obtenir AAL2, puis vérifie le passage à vrai de l'indicateur.
- Exige un article de test existant avec un historique non vide ; contrôle 1 à 40 versions, tri décroissant et **aucune donnée personnelle supplémentaire** dans la réponse RPC.
- Contrôle le refus d'une restauration non autorisée côté Supporter et d'une requête invalide côté administrateur, **sans jamais passer un ID d'article réel à la RPC d'écriture**.
- Ferme les sessions de test y compris en cas d'échec. Ne journalise ni jeton, email, secret TOTP, identifiant de membre ou contenu d'article.

Les tests Node tests/real-news-revisions-smoke.test.mjs couvrent les validations de cible, les clés interdites, l'isolation, le MFA, les champs renvoyés et les scénarios où un serveur serait trop permissif.

## Prérequis obligatoires

1. Préparer un projet Supabase staging isolé et y appliquer **sous autorisation** les migrations requises, dont l'étape 56. Ne jamais utiliser la production comme cible.
2. Préparer deux comptes de test *sans données de personnes réelles*, avec email confirmé ; l'admin doit avoir son TOTP validé.
3. Préparer un article texte de test déjà enregistré, avec au moins une entrée du journal d'audit.
4. Configurer sur le poste d'essai les variables d'environnement suivantes, sans les envoyer dans le chat ni les enregistrer dans GitHub.

| Variable | Attendu |
|---|---|
| BOISSY_NEWS_TEST_ACK | YES_READ_ONLY_NEWS_REVISIONS_ON_ISOLATED_STAGING |
| BOISSY_NEWS_TEST_PROJECT_REF | Référence Supabase staging, différente de la production |
| BOISSY_NEWS_TEST_URL | URL HTTPS exacte du staging, terminée par / |
| BOISSY_NEWS_TEST_PUBLIC_KEY | Clé publishable ou anon **du staging** |
| BOISSY_NEWS_TEST_PERSONAS_JSON | Objet avec admin et supporter, chacun avec email/password de test ; admin avec totpSecret et éventuellement factorId |
| BOISSY_NEWS_TEST_FIXTURES_JSON | Objet avec articleId, UUID de l'article de test non sensible |

Lancer localement : **npm run smoke:news-revisions**. Les secrets et mots de passe ne doivent jamais être affichés ni écrits dans les logs du test.

## Limites explicites

Cette recette **n'exécute pas une restauration réelle**. Elle ne teste pas non plus l'éditeur sur de vrais téléphones. Une recette positive de restauration nécessite des données fictives, un staging isolé, une sauvegarde, une vérification du journal de restauration et une validation administrative. Les droits à l'image, les RGPD et la publication finale restent des validations humaines.

**Statut : recette de préproduction préparée dans le code, pas exécutée sur un projet Supabase réel.**
