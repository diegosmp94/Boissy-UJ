# Étape 78 — Galerie protégée, approbation et retrait des droits

**26 octobre 2026.** Développement technique du flux photo/vidéo ; aucun média fictif, aucune nouvelle identité, aucune approbation éditoriale présumée.

## Audit de production préalable

L'ancien chantier photo/vidéo a **déjà été déployé** : la table `public.news_media_assets`, le bucket privé `boissy-uj-approved`, les fonctions `admin_list_news_media`, `admin_check_news_media_file` et `admin_save_news_media` et leurs règles RLS sont présents. Les contrôles SQL confirment un bucket non public, une limite de **50 Mo**, des MIME photo JPEG/PNG/WebP/AVIF et vidéo MP4/WebM, ainsi qu'un contrôle des droits d'image, des descriptions alternatives et une limite de **12 médias par article**.

La galerie et le formulaire administrateur sont déjà fonctionnellement raccordés : l'admin MFA AAL2 **associe un objet Storage déjà déposé**, vérifie sa présence/type/taille et double-confirme la visibilité ; les visiteurs ne consultent qu'un article publié et approuvé, et obtiennent un lien signé (TTL **600 secondes**), jamais une URL publique brute. Aucun upload de fichier n'est réalisé par cette interface (traité au chantier suivant).

Au précontrôle : **0 article, 0 média en base, 0 objet dans le bucket approuvé et 0 audit de média**. Aucun contenu ni acteur réel n'est modifié par le déploiement du patch.

### Lacunes traitées

1. **Retrait des autorisations :** dépublier un article masquait momentanément ses médias par RLS, mais les drapeaux `visible=true` et `rights_reviewed=true` pouvaient persister, autorisant leur réapparition automatique lors d'une republication.
2. **Opérations Storage :** l'ancienne politique `SELECT` autorisait les objets approuvés sans distinguer l'opération de signature des tentatives de liste de contenu.
3. **Expiration des signatures :** la galerie demandait un lien signé uniquement lors du premier chargement ; après dix minutes, les lecteurs photo/vidéo pouvaient expirer sur une page encore ouverte.

## Correctifs

- `supabase/migrations/202610260014_media_post_demotion_revoke.sql` ajoute `app_private.news_media_revocation_audit`, table privée avec RLS, et le trigger `news_media_post_demotion_guard`. Lorsqu'un article **déjà public et éligible** cesse d'être publié, devient privé, perd son consentement ou est reprogrammé, ses médias sont **masqués et leurs droits de publication réinitialisés en base** dans la même transaction. Chaque média touché est journalisé, sans écriture dans `storage.objects`.
- La politique Storage `boissy_approved_media_sign_read` est remplacée par une politique **limitée aux opérations `object.sign` et `object.sign_many`**, avec examen des droits de l'article et du média. Les requêtes de liste (`object.list`) ne sont pas permises par cette politique. L'accès direct et les permissions d'upload/suppression ne sont pas ouverts aux visiteurs.
- `media-center.mjs` renouvelle les liens temporaires toutes les **8 minutes** sur une page active et au retour d'un onglet ancien. Un échec de signature ne rend pas une ancienne URL valide. L'intervalle et l'écouteur de visibilité sont supprimés à la fermeture de la rubrique.
- `tests/step78-approved-media-revocation.test.mjs` vérifie le contrôle préalable MFA/Storage, le masquage des droits, l'audit, les restrictions de signature, l'expiration et le nettoyage des timers.

## Limites importantes

Les **URL signées déjà distribuées continuent de fonctionner jusqu'à leur échéance d'origine**, même après retrait des métadonnées ou des autorisations RLS. Pour un retrait urgent (droit à l'image, erreur, mineur), le responsable doit aussi supprimer le **fichier via Supabase Storage API/Dashboard**, purger les liens/CDN selon les fonctionnalités disponibles et vérifier la disparition des copies externes : aucune révocation magique de signature déjà émise n'est promise. La migration ne supprime ni ne téléverse aucun objet Storage.

La validation « droits à l'image vérifiés » reste une **attestation explicite de l'administrateur** ; le code ne peut pas vérifier juridiquement un formulaire d'autorisation ni détecter tous les contenus dangereux. Les métadonnées MIME/tailles n'équivalent pas à une analyse antivirus ou à une inspection visuelle. Les essais humains réels, les autorisations et la modération restent séparés du pourcentage de développement.

**Étape 79** : intégrer, après audit, un dépôt de fichiers contrôlé (flux d'upload, prévention des doublons et quotas), sans rendre les fichiers non approuvés publics.
