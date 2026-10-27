# Étape 96 — FFF : revue d'un export autorisé, rapprochement et retour à la saisie manuelle

**27 octobre 2026 — module de rapprochement opérationnel, connexion directe FFF non activée.**

## Audit de l'existant

Les étapes 37 et 62 avaient livré un adaptateur versionné `fff-provider.mjs`, la prévisualisation locale d'un JSON, une liste de matchs issus de références tierces non homologuées et l'éditeur du club. Celui-ci publie via `admin_save_classified_match` avec validation MFA AAL2, et les dossiers existants sont consultés via `admin_list_management_matches`.

L'association Boissy-UJ correspond au numéro d'affiliation FFF **548423** ; ne pas le confondre avec un autre club de Boissy ou avec le FC Invicta. Aucun accès à une API partenaire FFF ni droits de republication n'ont été fournis. Le fournisseur d'API ancien DOFA ne constitue pas un accès autorisé. **Aucune clé, route de contournement, token ni requête à un endpoint non documenté n'est ajoutée.**

## Développement

Le dossier `fff-import-reconciliation.mjs` transforme les rencontres d'un **export partenaire futur** uniquement après passage par le validateur existant `previewAuthorizedFffFeed()`. Le rapprochement avec les véritables tables de gestion du club se fait **en lecture seule** :

- Club d'affiliation exact et cinq codes d'équipes obligatoires : `a`, `b`, `c`, `veterans`, `futsal` (le site continue d'afficher **Senior** en futsal).
- Chaque équipe doit être rattachée sans ambiguïté à l'identifiant de la vraie équipe Supabase `club_teams` ; aucun identifiant d'engagement FFF n'est inventé.
- Les clés sont construites par équipe, date civile **Europe/Paris** et nom d'adversaire normalisé (accentuation et ponctuation). Les différences de domicile/extérieur, de statut, de score ou d'horaire de plus de 5 minutes sont marquées comme conflits.
- Un export présentant deux références pour la même équipe, le même jour et le même adversaire est marqué **ambigu**, même si les identifiants externes diffèrent. Un dossier déjà saisi est marqué « déjà enregistré », sans possibilité de pré-remplir un duplicata.
- Si un accès admin échoue, si les dossiers dépassent leur limite de lecture (250) ou si le rapprochement des équipes est incomplet, le module refuse de préparer un dossier : **aucun faux état « 0 match »** ne remplace un inventaire non disponible.

Dans le module existant « Matchs et résultats », le volet « Connecteur FFF — revue et saisie manuelle » fournit un champ JSON et une attestation explicite de vérification des droits de réutilisation. Cette attestation déclarative **ne remplace pas le contrat FFF**. Le contenu est analysé localement puis comparé avec les vrais dossiers via les RPC existantes ; aucun export n'est stocké.

Lorsque le statut est « à vérifier et préparer », l'administrateur MFA AAL2 peut choisir une rencontre et demander un **pré-remplissage manuel**. Le logiciel revérifie alors que le dossier n'a pas changé entre la comparaison et l'action ; il ouvre un **nouveau brouillon non enregistré** dans le formulaire du club, remplit uniquement équipe, adversaire, date, lieu, domicile/extérieur et statut. Il laisse impérativement :
- `published=false` ;
- compétition à classer manuellement (`unspecified`), label vide ;
- score à ressaisir après contrôle du club même si l'export indiquait un score joué ;
- `source_kind='manual'`, `source_reference=null` dans le dossier club jusqu'à la validation de provenance.
L'enregistrement et la publication restent exclusivement effectués par le formulaire existant et sa RPC serveur MFA AAL2, avec décision humaine.

En cas de refus ou d'indisponibilité de la source FFF, le module **n'affecte pas la saisie manuelle** ; la vie du site continue avec les dossiers publiés par le club et les calendriers déjà alimentés.

## Livraison vérifiée — 27 octobre 2026

- [PR #168](https://github.com/diegosmp94/Boissy-UJ/pull/168) fusionnée en squash sur `main`, commit `7e13b0490c8c5ceefb18558ce18fbba516047fee`.
- **957 tests Node réussis et 0 échec** ; workflows « Tests du socle Boissy-UJ » et « Vérifications du socle Boissy-UJ » en succès, contrôles mobiles Chromium compris.
- Le workflow GitHub Pages correspondant au commit fusionné est **en succès** pour la construction, le déploiement et la vérification de la version publique. Aucun appel à une API privée ou partenaire FFF n'a été ajouté.
- **Aucune migration Supabase** ni modification des matchs du club n'a été effectuée par cette PR. La saisie existante reste l'unique voie d'enregistrement et ne publie jamais par défaut le résultat d'un export FFF.
- Le flux partenaire reste indisponible tant que les conditions de droit d'accès et de réutilisation ne sont pas établies. Ceci ne prouve ni réception d'une autorisation FFF ni synchronisation active.

## Tests de sécurité

`tests/step96-fff-authorized-reconciliation.test.mjs` vérifie les données hors licence, les doublons, les conflits de score/domicile/horaire, la recherche d'équipe, les dates d'hiver Europe/Paris, le refus des brouillons conflictuels, le refus de copie des scores et l'absence de sauvegarde automatique.

Aucune migration ni Edge Function ni job CRON ne sont nécessaires, car le club n'a pas le contrat autorisant un connecteur réseau. Le code n'entre pas en contact avec la fédération et ne présume **aucune** disponibilité externe, il offre seulement un circuit d'entrée manuel prêt à recevoir un export légalement acquis.

## Activation future, une fois la FFF consultée

1. Faire valider par écrit le périmètre des données, l'accord de réutilisation, les identifiants des équipes/compétitions et les conditions d'attribution.
2. Intégrer **côté serveur** un connecteur aux seules URL/documentation effectivement approuvées, avec secrets privés et quotas.
3. Rejouer la comparaison et les contrôles de doublons en staging isolé, vérifier les scores reportés et les identifiants d'engagement puis former les administrateurs.
4. Éventuellement développer une file d'import horodatée et auditée, avec validation individuelle explicite et jamais d'écrasement automatique des résultats.

Le module est **terminé au niveau du code de rapprochement manuel**, mais il ne faut **pas le qualifier d'API FFF connectée ou de synchronisation active**.
