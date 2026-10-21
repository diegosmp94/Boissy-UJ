# Étape 15 — Rejoindre Boissy-UJ et informations pratiques

## Objectif
Remplacer les pages « en préparation » par un parcours public riche sans collecter de données personnelles tant que l'authentification et les autorisations du club ne sont pas homologuées.

## Sur le site
- **Page Nous rejoindre** : sélection interactive Joueur, Éducateur, Bénévole, Partenaire.
- Parcours contextualisés : trois étapes par profil, fondées sur les fonctionnalités réelles du site ; aucune promesse de place ni ouverture fictive du recrutement.
- **Annonces du club** : catégorie, éventuelle équipe, recherche et filtre ; seules les annonces officiellement publiées apparaissent. Le statut `open` signifie seulement qu'une annonce a été publiée ouverte, pas qu'un formulaire d'inscription est opérationnel.
- **Contacts officiels** : affichés uniquement après publication par Boissy-UJ. Liens acceptés : e-mail `mailto:`, téléphone international `tel:`, site `https:` ; refus des liens dangereux et des coordonnées non vérifiées.
- FAQ accessible au clavier et consignes générales véridiques. Les informations spécifiques au club sont chargées uniquement depuis le catalogue publié.
- **Page Infos pratiques** `#/infos-pratiques` : recherche, filtre thématique (entraînements, jour de match, terrain, adhésion, vie associative, FAQ), contacts officiels, aucune adresse ou heure inventée.
- Navigation mobile et liens entre ces pages, mise en forme bleu nuit/doré cohérente et adaptations iPhone.
- Si Supabase est vide ou indisponible, un message explicite remplace toute donnée fictive.

## Base Supabase
Migration : `supabase/migrations/202610210015_join_public_information.sql`.

| Table | Contenu |
|---|---|
| `club_join_opportunities` | Annonces pour joueur, entraîneur, bénévole ou partenaire ; équipe éventuelle ; statut, visibilité |
| `club_public_notices` | Questions/réponses et consignes pratiques par thématique |
| `club_contact_channels` | Moyens de contact autorisés pour le public, par catégorie d'audience |

Toutes ces tables utilisent `published=false` par défaut. La RLS est active ; le navigateur dispose uniquement de **SELECT sur les lignes publiées**, sans INSERT/UPDATE/DELETE. Aucune ligne d'exemple, adresse, horaire ou contact personnel n'est inséré par la migration.

## Supabase — déploiement confirmé

La migration **`boissy_uj_join_public_information_20261021` est appliquée** sur le projet Boissy-UJ. Les trois tables ont RLS activée. Le rôle `anon` peut consulter les lignes publiées mais ne peut pas écrire, et `authenticated` ne peut pas modifier directement le catalogue. Un contrôle transactionnel sous rôle `anon` a réussi. Les tables contiennent **0 annonce, 0 information pratique et 0 contact officiel** ; aucune donnée fictive n'a été créée.

La liste globale Supabase comprend désormais **15 migrations**. Les avertissements préexistants relatifs aux fonctions privilégiées authentifiées restent distincts de ce catalogue, qui n'expose aucune nouvelle RPC.

## Sécurité / confidentialité
- Aucun formulaire public de candidature n'est ouvert ; aucun envoi d'identité, numéro de licence, pièce d'identité, données de mineurs ou dossier médical.
- Les données externes sont rendues avec `textContent`, sans insertion HTML depuis Supabase.
- URL de contact vérifiée avant création d'un lien, avec `noopener noreferrer` pour les sites externes.
- Requêtes GET publiques seules avec clé Supabase publishable ; aucun jeton sensible ni service_role en JavaScript.
- Requêtes annulées lors des changements de page et résultats périmés ignorés.
- La publication/modification réelle des annonces, horaires, terrains et contacts demandera un panneau éditorial authentifié plus tard. Aucune écriture n'est activée dans ce lot.

## Recette
- Tests Node du filtrage par audience/équipe/texte et des brouillons inaccessibles.
- Tests de validation des liens `https:`, `mailto:`, `tel:` et du masquage des moyens de contact non publiés.
- Tests des routes, rendu mobile et annulation des requêtes.
- Vérification Supabase : migration installée, RLS active, tables initialement vides et droits de lecture seule.
- Tests visuels complets Safari/Android/ordinateur à effectuer lors de la recette globale, comme convenu.

Cette étape n'active ni Supabase Auth, ni les paiements Stripe LIVE, ni une inscription de mineur ou de joueur.
