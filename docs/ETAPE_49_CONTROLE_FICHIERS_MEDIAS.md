# Étape 49 — Contrôles avant publication des médias

## Anomalie corrigée dans le code

L'étape 48 validait le chemin et les droits déclarés d'un fichier, sans vérifier que le fichier existait réellement dans Supabase Storage. Une métadonnée d'article pouvait donc indiquer un média inexistant, une extension incompatible ou un type MIME erroné.

Le patch de l'étape 49 renforce la **migration non encore appliquée** `202610230002_verified_news_media_assets.sql` :
- Fonction privée `app_private.media_file_ready` : vérifie la présence de l'objet dans le bucket approuvé, le type MIME réel déclaré dans ses métadonnées Storage, la correspondance avec l'extension et une taille comprise entre 1 et 50 000 000 octets.
- La RPC `admin_save_news_media` refuse désormais côté PostgreSQL la publication d'un objet absent ou non conforme, même si un client contourne l'interface.
- Une RPC de contrôle en lecture seule `admin_check_news_media_file` n'est utilisable que par un administrateur MFA AAL2, sans exposer les fichiers ou les identités à un compte ordinaire.
- Dans le Control Center, le bouton « Vérifier le fichier approuvé » confirme la disponibilité avant l'enregistrement ; les modifications de chemin ou de type annulent cette vérification.
- Un chemin Storage ne peut pas être affecté à plusieurs lignes éditoriales distinctes.
- Le retrait d'un média de la galerie n'efface **pas** le fichier d'un bucket public. En cas de retrait de consentement, le responsable doit aussi supprimer le fichier de Storage et vérifier la propagation CDN.

## Sécurité et activation

Le contrôle des métadonnées MIME et de taille **ne constitue pas un antivirus**, une détection de contenu illicite, une vérification des droits ou une garantie d'accessibilité : ces étapes restent manuelles et doivent être démontrées.

Aucune migration ne doit être activée sur le projet réel avant les scénarios de recette en environnement isolé, l'inventaire des publications et la validation du responsable du club. Vérifier :
1. AAL1, visiteur et supporter refusés par la RPC ; administrateur AAL2 autorisé.
2. Un fichier absent, un mauvais type MIME, une taille nulle et un fichier trop volumineux sont refusés par la RPC et par l'enregistrement.
3. Une photo autorisée en base de test peut être validée, mais aucune identité réelle de joueur ou de mineur n'est nécessaire.
4. La révocation de visibilité supprime l'affichage sur le site ; **l'URL publique continue de fonctionner** tant que le fichier Storage n'est pas supprimé.
5. Les migrations des réactions (étape 47) et des médias (étapes 48–49) restent distinctes ; aucune ouverture des paiements, commentaires ou messagerie.

Document préparé à partir de l'audit du 23 octobre 2026. Ce lot n'apporte ni preuve de restauration ni homologation RGPD.
