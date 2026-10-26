# Étape 78 — Infrastructure médias privée et autorisations de diffusion

**26 octobre 2026.** Développement des garde-fous photos/vidéos et de leur diffusion. Aucun objet Storage, album, vidéo, identité ni autorisation légale fictive n'a été créé.

## Écart de sécurité corrigé

La migration `supabase/migrations/202610230002_verified_news_media_assets.sql` préexistait dans GitHub mais n'avait pas été exécutée dans Supabase. Elle proposait un bucket `boissy-uj-approved` **public**, tout en cachant les métadonnées des médias non autorisés via RLS. Cette configuration n'était pas suffisante : toute personne connaissant le chemin d'un fichier du bucket public pouvait le charger directement, même si sa fiche média devenait invisible. Cela contredisait le critère de sécurité de l'étape 78.

L'audit de production a confirmé **zéro bucket et zéro fichier Storage**, et zéro actualité existante. La migration a donc été corrigée **avant sa première application**, sans déplacer ni exposer de fichier.

## Backend Supabase

1. Le bucket `boissy-uj-approved` est désormais **privé** (`public=false`). Limite **50 Mo** par fichier ; formats limités aux JPEG, PNG, WebP, AVIF, MP4 et WebM.
2. La politique RLS `boissy_approved_media_sign_read` sur `storage.objects` accorde uniquement la lecture des objets de ce bucket qui figurent dans `public.news_media_assets` avec `visible=true` et `rights_reviewed=true`, rattachés à un article lui-même public, publié, avec consentement éditorial et date de publication atteinte. Sans cette association, connaître le chemin ne suffit pas à signer ni télécharger le fichier.
3. **Aucune politique d'upload/suppression/remplacement navigateur** n'est créée : le processus initial reste un téléversement hors site par un responsable habilité avec vérification préalable du contenu, des droits et des consentements applicables. L'étape 79 devra mettre en place un parcours sécurisé plus complet.
4. La fonction `app_private.media_file_ready` contrôle désormais la présence de l'objet dans le bucket **privé**, son MIME et sa taille réelle. La RPC `admin_check_news_media_file` est réservée à l'administrateur MFA AAL2.
5. La RPC `admin_save_news_media` refuse de rendre visible un fichier absent, non conforme ou non approuvé ; contrôle le lien à l'article, l'alt text, l'ordre (0–11), les droits et la limite de 12 médias. Elle écrit une piste d'audit privée. Les métadonnées sont sous RLS, lisibles anonymement **seulement après validation et publication de l'article**.

## Interface publique et contrôle des accès

- Les URL permanentes `/storage/v1/object/public/` sont **supprimées** du lecteur. Les fichiers privés ne sont chargés qu'après émission par Supabase de **liens signés valables 600 secondes**.
- Les signatures sont émises en lots bornés de 50 chemins avec `createSignedUrls()` du SDK, sous les mêmes règles RLS. Chaque résultat est vérifié : **origine Supabase exacte**, chemin correspondant, signature `token` obligatoire. Les URL étrangères, sans jeton ou ne correspondant pas au chemin demandé sont refusées.
- Le service d'authentification nécessaire aux signatures est chargé paresseusement. Si le service ou la signature échoue, **la publication textuelle reste accessible**, sans image de remplacement non sécurisée ni clé privilégiée.
- Les médias non approuvés ne sont ni présentés, ni utilisés comme filtre « Galerie » ou « Vidéo ». Photos avec texte alternatif/légende et zoom en dialogue natif ; vidéos natives sans lecture automatique et sans intégration de plateforme tierce.
- L'interface administrateur explique désormais la protection du bucket privé et avertit de la durée de validité des signatures déjà émises.

## Limites explicites : révocation et confidentialité

Un **lien signé déjà émis** reste techniquement utilisable jusqu'à expiration, même après retrait de la visibilité ou des droits. Cette étape réduit sa validité à 10 minutes, mais n'annonce **pas une révocation instantanée**. Une demande d'effacement impose de supprimer l'objet du stockage ainsi que son référencement, avec vérification et audit : cette orchestration est l'objet de **l'étape 80**, et les garanties juridiques de l'étape 92.

La disponibilité effective de la lecture vidéo/image nécessite la présence d'objets approuvés ainsi qu'un essai public sur de vrais fichiers ; **aucun fichier n'est créé pour simuler cette validation**. Les tests automatisés valident les parcours, le schéma, le format des signatures et le principe de refus par défaut, pas des consentements ou droits à l'image.

## Livrables

- `supabase/migrations/202610230002_verified_news_media_assets.sql` — stockage privé, politiques de signature et contrôles média.
- `news-media-gallery.mjs` — liens temporaires, traitement par lots, refus d'afficher tout lien non signé.
- `admin-news-media.mjs` — avertissements de confidentialité et procédure de retrait.
- `tests/step78-private-approved-media.test.mjs`, `tests/news-media-gallery.test.mjs`, `tests/news-media-preflight.test.mjs` et `tests/step59-editorial-media.test.mjs` — tests.
- Prochaine étape **79** : téléversement et homologation encadrés, sans laisser d'objet non approuvé accessible publiquement.
