# Étape 48 — Galeries photo et lecteur vidéo approuvés

## Livré dans le code

- Le Media Center affiche les photos et vidéos associées à une actualité réellement publiée : grille adaptative, textes alternatifs, légendes et lecteur vidéo natif sans lecture automatique, sans iframe ni lien tiers imposé aux supporters.
- Les filtres Articles / Galeries / Vidéos reconnaissent aussi les médias rattachés à un article, avec douze médias au maximum par actualité.
- L'administrateur MFA AAL2 pourra associer à une actualité un chemin de fichier déjà présent dans le bucket Supabase approuvé, ordonner les médias et retirer leur visibilité, sous double confirmation.
- Les politiques RLS limitent l'affichage à des médias validés rattachés à un article public et publié, après contrôle des droits. Une RPC administrateur AAL2 valide les données, verrouille les ajouts et journalise les changements en schéma privé.
- Le Media Center reste consultable lorsque la migration n'est pas déployée ; le module admin est masqué si sa RPC manque.

## Import et consentement

Aucun téléversement depuis le navigateur public ni depuis le formulaire du club : seuls les fichiers examinés par le club, puis déposés par un responsable habilité dans le bucket **boissy-uj-approved**, peuvent être associés à une actualité.

Attention : le bucket est PUBLIC pour les fichiers approuvés. Toute image qui y est déposée peut être vue par une personne connaissant l'URL, même avant publication dans le Media Center. Ne jamais y déposer de photo de mineur sans droits vérifiés, de média non consenti, de contenu privé ou de brouillon confidentiel.

Vérifier provenance, droit à l'image, autorisation des représentants légaux lorsque nécessaire, droit musical, métadonnées sensibles, durée de conservation et procédures de retrait. Une case cochée n'est pas une preuve juridique suffisante.

## Mise en service contrôlée

1. Valider le circuit de consentement et les informations RGPD avec le club.
2. Tester la migration **supabase/migrations/202610230002_verified_news_media_assets.sql** en base de test : grants, RLS, refus anonyme, admin AAL1 refusé, AAL2 autorisé et aucun média masqué divulgué.
3. Vérifier les politiques de stockage : aucun visiteur ni compte ordinaire ne doit pouvoir déposer des fichiers dans le bucket approuvé.
4. Effectuer sauvegarde et application contrôlée de la migration, puis tester les médias avec un contenu non personnel autorisé.
5. N'autoriser les publications réelles qu'après signature du responsable du club et contrôle des droits.

La migration n'est pas appliquée à la production lors de la création de cette étape. Les tests GitHub valident le code mais ne remplacent pas une recette multi-comptes ou RGPD.

## À poursuivre

Upload privé avec circuit de modération, purge des fichiers du stockage en cas de retrait, statistiques publiques agrégées, fonctionnalités Premium (non activées) et homologation sur Safari/Android réels.
