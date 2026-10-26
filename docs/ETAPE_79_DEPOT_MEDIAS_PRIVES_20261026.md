# Étape 79 — Dépôt privé de photos et vidéos

**26 octobre 2026 — Développement technique.** Aucun fichier, article, personne, photo ou vidéo réel n’est ajouté pendant le déploiement. Les droits à l’image, particulièrement pour les mineurs, nécessitent une validation humaine distincte.

## Situation de départ

L'étape 78 a réellement déployé le bucket privé `boissy-uj-approved`, le contrôle MIME/50 Mo, les fonctions administrateur, les règles RLS, la vérification d'un fichier Storage et la galerie publique à liens signés de 10 minutes. La procédure précédente nécessitait toutefois de téléverser les fichiers **manuellement dans Supabase Dashboard**, puis de référencer leur chemin dans le Control Center.

Avant l'étape 79, Supabase contenait **0 objet Storage, 0 média approuvé, 0 actualité**. Aucun média déjà publié n'est affecté.

## Fonctionnalité développée

Le Control Center (Galeries et vidéos) possède un nouveau formulaire « **Déposer une photo ou une vidéo** » pour les administrateurs **MFA AAL2**. Un dépôt est distinct de la publication :

1. L'admin choisit une actualité existante, un fichier photo/vidéo, rédige une description accessible de 4 à 200 caractères et atteste être autorisé à déposer le contenu. Le nombre de médias de l'article est vérifié ; **12 maximum**.
2. Le navigateur refuse les extensions ou MIME non admis (JPEG, PNG, WebP, AVIF, MP4, WebM), les fichiers vides, les images de plus de **12 Mo** et les vidéos de plus de **50 Mo**. Une lecture des premiers octets confirme la signature attendue du format déclaré ; ceci réduit les erreurs de fichiers renommés, mais **ne constitue ni antivirus ni contrôle juridique**.
3. Double confirmation et nouvelle vérification de la session administrateur MFA AAL2.
4. Une fiche média **non visible et non approuvée** est créée par la fonction `admin_save_news_media` de l'étape 78, avec chemin aléatoire `incoming/<uuid-v4>.<extension>` et écriture dans le journal privé déjà en place. Le serveur verrouille l'article et limite à 12 fiches.
5. Le navigateur exécute `storage.from('boissy-uj-approved').upload(..., {upsert:false, contentType})`. Aucun `UPDATE`, `DELETE` ou écrasement n'est autorisé ; une deuxième copie utilise un nouveau chemin aléatoire.
6. La RPC `admin_check_news_media_file` revalide la présence, le MIME et la taille en base. La fiche devient disponible dans le formulaire éditorial **sans être publiée**. L'administrateur devra vérifier le fichier, les droits, la description, puis confirmer séparément `visible=true` et `rights_reviewed=true`.

## Sécurité Storage

Migration : `supabase/migrations/202610260016_staged_private_media_upload.sql`.

- Une nouvelle politique `storage.objects FOR INSERT TO authenticated` vérifie `app_private.is_admin()` : compte administrateur + **MFA AAL2** obligatoires.
- L'écriture est autorisée **uniquement** dans le bucket privé, sous `incoming/`, avec un nom UUID v4 et une extension autorisée, si et seulement si une fiche `news_media_assets` déjà créée référence le même chemin **avec `visible=false` et `rights_reviewed=false`**.
- La lecture limitée des fiches par un administrateur AAL2 est ajoutée dans RLS, sans lui donner de droit direct d'écriture de métadonnées. Le RLS de la publication anonyme reste strictement inchangé.
- Les règles existantes de création de liens signés ne permettent de signer que les fichiers **réellement publiés et approuvés**. Aucun droit `storage.objects SELECT` de listage global, `UPDATE` ou `DELETE` n'est ajouté. Le bucket reste `public=false`.

## Défaillances, quotas et suites

Si le transfert échoue après création de la fiche, celle-ci reste une **réservation privée invisible**. L'interface indique de vérifier les fiches avant de réessayer ; elle ne peut pas affirmer qu'un transfert distant a échoué à coup sûr si le réseau s'interrompt après l'écriture. Le retrait et la purge vérifiée des fichiers et fiches orphelines seront traités à l'**étape 80**. Les limites 12/article, 12 Mo par photo, 50 Mo par vidéo et `upsert:false` empêchent les doublons involontaires, mais **ne constituent pas un quota mensuel global par administrateur**.

La détection MIME/signature et les métadonnées Storage sont des vérifications techniques : elles ne certifient pas l'absence de contenu malveillant, n'assurent pas la modération visuelle et ne remplacent pas les autorisations nécessaires pour diffuser l'image d'une personne, particulièrement mineure. Pas de scan antivirus automatisé ni de dépôt pour les personnes non autorisées.

Tests ciblés : `tests/step79-media-private-upload.test.mjs`. Aucun achat, stockage public ou activation premium n'est inclus.

**Étape 80 à suivre :** retrait et purge sécurisée des médias (Storage + fiches + erreurs de suppression), sans promettre l'invalidation des liens signés déjà distribués.
