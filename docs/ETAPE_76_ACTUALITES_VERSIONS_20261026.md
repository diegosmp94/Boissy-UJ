# Étape 76 — Actualités : versions, corrections éditoriales et restauration

**26 octobre 2026.** Développement de la gestion des actualités publiques. Aucune actualité, photographie, vidéo, identité ou publication fictive ajoutée.

## Audit de l'existant

- L'éditeur administrateur publie via la fonction **`staff_save_news_article`**, contrôlée et auditée, avec validations de titre (4–180 caractères), résumé (400 maximum), corps (1–20 000) et attestation des droits avant publication.
- Chaque modification stocke une copie **avant/après** dans `public.staff_news_audit`. La table est protégée par RLS et ses contenus bruts ne sont pas accessibles directement aux visiteurs.
- Le frontend `admin-news-revisions.mjs`, les tests, et la migration `202610230005_news_revision_restore.sql` existaient déjà, mais la migration était **préparée pour staging et non déployée**. Le module était donc masqué par la sonde `admin_news_revisions_ready()` absente.
- L'audit exigeait `team_id NOT NULL` alors que le formulaire accepte une « Actualité générale du club » sans équipe. Cette combinaison empêchait l'écriture de son journal et risquait d'invalider l'enregistrement.
- L'édition d'une actualité existante ne vérifiait pas `updated_at` du dossier chargé : un éditeur pouvait écraser le travail plus récent d'un autre. La restauration en brouillon préparée avait déjà un contrôle optimiste.
- Précontrôle production : **0 actualité** et **0 événement d'audit** ; aucune ligne existante ne doit être transformée ou supprimée.

## Correctifs

### Supabase

Dans **`supabase/migrations/202610230005_news_revision_restore.sql`**, fonctionnant sans aucun média ni module premium :

1. **Journal des actualités générales** : `staff_news_audit.team_id` devient nullable. `NULL` signifie « tout le club » ; la clé étrangère des dossiers liés à une équipe reste en place. Aucun UUID ni association d'équipe ne sont inventés.
2. **Historique privé :** `admin_list_news_revisions(p_post_id)` retourne les **40 dernières versions**, avec date, action, titre, résumé, texte et ancien état de publication. Jamais de JSON brut, d'identité du rédacteur, ni d'information de contact.
3. **Restitution sûre :** `admin_restore_news_revision(post,revision,expected_updated_at)` vérifie rôle administrateur, MFA AAL2, correspondance article/équipe (y compris équipe nulle), existence du snapshot, et verrouillage `FOR UPDATE` + version optimiste. Le retour se fait **uniquement en brouillon** : `status='draft'`, `consent_reviewed=false`, `published_at=null`, avec nouvelle entrée d'audit `restore_draft`.
4. **Édition avec anti-écrasement :** `admin_save_news_article_checked(...,p_expected_updated_at)` valide administrateur + MFA, verrouille le rôle actif et la ligne d'article, compare la version enregistrée à celle du formulaire, puis délègue à la fonction existante `staff_save_news_article`. Une édition concurrente retourne **`40001`**, sans publication ni audit de succès erroné.
5. **Activation contrôlée :** la sonde `admin_news_revisions_ready()` ne renvoie vrai que pour un administrateur AAL2 ; les nouvelles RPC n'accordent `EXECUTE` qu'à `authenticated` et effectuent les contrôles **dans la base**. Aucun droit SELECT direct sur `staff_news_audit` n'est ajouté.

### Interface

- L'éditeur « Articles et actualités » transmet la version `updated_at` du dossier sélectionné. Un conflit entraîne un message explicite demandant l'actualisation plutôt que de remplacer silencieusement le contenu.
- Le module « Historique des actualités » déjà développé devient accessible après vérification de la sonde. Il affiche les versions sous forme de **texte inerte**, demande une confirmation expresse avant restauration, puis recharge les dossiers.
- Pendant la restauration, le document, la version et la case de confirmation sont verrouillés côté interface pour empêcher un changement de cible pendant la nouvelle validation MFA. Le serveur reste l'autorité.
- Les fiches publiques n'affichent que les articles ayant l'état `published`, une date de publication valable et l'attestation des droits, au travers de la politique RLS déjà en place.

## Limites et sécurité

La migration n'active **ni** la galerie Storage, **ni** les réactions, **ni** les modules premium, les paiements ou d'autres migrations restées en attente. Elle ne crée, ne publie, ne modifie ni ne supprime aucun contenu utilisateur existant. Les rédacteurs entraîneurs gardent la RPC existante avec ses restrictions d'équipe ; l'éditeur optimiste de cette étape est réservé au Control Center administrateur.

Les tests contractuels sont dans `tests/step76-news-versioned-editor.test.mjs` et `tests/admin-news-revisions.test.mjs`. Les essais réels à plusieurs comptes, la validation des contenus et droits à l'image restent des opérations manuelles **hors de la feuille de route technique**.

**Étape suivante 77 :** réactions aux actualités, à sécuriser puis déployer séparément si les prérequis sont vérifiés.
