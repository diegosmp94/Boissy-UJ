# Étape 56 — Historique et restauration des actualités

**23 octobre 2026 : code développé, non déployé sur Supabase production.**

Le nouveau module **Historique des actualités** du Control Center permet à un administrateur MFA AAL2 de choisir un article, consulter les 40 dernières versions enregistrées et restaurer un ancien texte en brouillon. Il utilise le journal d'audit privé déjà existant.

## Contrôles de sécurité

- La lecture des versions et la restauration sont exécutées par deux RPC serveur distinctes réservées aux administrateurs AAL2.
- Aucune version brute de l'audit contenant des identifiants internes n'est renvoyée au navigateur.
- La restauration exige une version de cet article et de la même équipe ; le verrou SQL empêche de restaurer au-dessus d'une modification plus récente (optimistic lock).
- Toute restauration force le statut brouillon, annule la publication et remet à zéro la validation des droits : la publication doit être explicitement revue et réapprouvée.
- Le journal conserve une action restore_draft avec état précédent et nouveau.
- Le menu d'administration masque automatiquement le module si la nouvelle RPC de capacité n'est pas installée.
- L'interface demande une confirmation explicite et utilise des nœuds texte, sans injecter les versions comme HTML.

## Fichiers

- supabase/migrations/202610230005_news_revision_restore.sql — migration préparée pour staging, pas exécutée ici.
- admin-news-revisions.mjs — lecteur/aperçu/retour arrière.
- admin-center.mjs, admin-navigation.mjs et admin-console.css — navigation filtrée et mise en page.
- tests/admin-news-revisions.test.mjs — tests de contrat de sécurité, navigation et rétablissement en brouillon.

## Recette obligatoire

Sur Supabase de staging isolé, confirmer les refus pour utilisateurs anonymes, membres, coachs et administrateurs AAL1 ; consulter avec un admin AAL2 ; vérifier la restauration d'un article de test, le refus d'une version d'une autre équipe ou d'un autre article, la protection contre l'écrasement concurrent et la suppression de l'ancien consentement.

La recette de lecture et d'isolation des rôles est maintenant scriptée dans [l'étape 57](ETAPE_57_RECETTE_NEWS_STAGING.md). Elle reste à exécuter avec un vrai projet de préproduction et ne couvre pas de restauration positive.

**Statut : développement prêt à recetter, migration non appliquée à la production. Aucune actualité réelle n'a été restaurée.**
