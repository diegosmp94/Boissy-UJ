# Étape 71 — Gestion unifiée des matchs et compétitions

**26 octobre 2026 · Développement technique ; aucune saisie ni homologation de résultat par le club.**

## Audit avant modification

- Le match était créé ou modifié par `staff_save_match`, tandis que le Championnat/la Coupe était assigné ensuite par `admin_set_match_competition` ; les deux modifications n'étaient pas atomiques.
- Les nouveaux matchs avaient par défaut `competition_kind='unspecified'`. Un administrateur pouvait publier un match sans type de compétition : un tel match ne s'affichait ni dans l'onglet Championnat ni dans l'onglet Coupe.
- Les statuts `scheduled`, `played`, `postponed` et `cancelled`, avec la contrainte de deux scores pour un match joué uniquement, étaient **déjà implémentés en base** : conservation du contrôle existant plutôt que duplication.
- Les équipes sont distinctes par code/discipline. La catégorie futsal conserve **l'équipe « Senior »** ; Seniors C conserve ses rencontres amicales et n'est pas automatiquement inscrit en coupe.
- Pré-vérification de la production : **zéro rencontre** enregistrée dans `public.matches` ; donc aucune rencontre publiée non classée à rectifier.

## Changements développés

1. **Enregistrement atomique :** nouvelle fonction `public.admin_save_classified_match` réservée à l'administrateur MFA AAL2. Elle appelle la RPC existante de sauvegarde de match (validation scores, saison, équipe et historique), puis enregistre dans **la même transaction SQL** le type `league`, `cup`, `friendly` ou `unspecified`, son intitulé et le journal `app_private.match_competition_audit`.
2. **Publication sûre :** un match en brouillon peut rester « À classifier ». Un match publié doit posséder un type réel ; pour Championnat/Coupe il doit aussi avoir un intitulé. Une *contrainte déclenchée et différée* vérifie l'état final de la ligne au COMMIT, même si une ancienne RPC tente de publier un match non classé. Les lignes sont contrôlées sans déclencher d'écriture de contenu.
3. **Formulaire unique :** dans « Matchs et résultats », l'administrateur saisit dorénavant rencontre, équipe, saison, statut, scores, Championnat/Coupe/Amical et nom exact avant de confirmer l'enregistrement. Le bouton de double confirmation existant est conservé.
4. **Statuts compatibles :** score autorisé uniquement pour une rencontre jouée ; scores effacés si l'on reprogramme, reporte ou annule la rencontre. Le serveur reste l'autorité pour les transitions, scores et protections d'archives de l'étape 70.
5. **Ancien reclassement conservé :** `admin_set_match_competition` reste disponible pour corriger la classification d'une rencontre existante sans toucher aux dates ou aux scores. Le journal privé de reclassement est conservé et une reclassification en « À classifier » n'est pas possible sur une publication.
6. **Affichage public :** les onglets Championnat et Coupe du Match Center utilisent déjà `competition_kind` enregistré. Seules les données réellement saisies puis publiées s'y affichent ; aucune rencontre de source externe non validée n'est créée.

## Contrats techniques et protections

La migration `supabase/migrations/202610260010_atomic_classified_matches.sql` crée une RPC et un déclencheur de vérification différé. Elle ne crée aucun compte, aucune équipe, aucun match ni score, et ne modifie pas les privilèges des fonctions existantes. La nouvelle RPC est `SECURITY DEFINER SET search_path=''`, `EXECUTE authenticated` uniquement, avec vérification serveur de l'administration MFA. Le déclencheur privé ne dispose d'aucun `EXECUTE` public.

Les tests `tests/step71-classified-match-atomic.test.mjs` vérifient l'atomicité, les contraintes de publication, les statuts et le raccordement des écrans. La recette avec vrais comptes et les informations sportives réelles restent à la charge du club.

**Prochaine étape 72 :** statuts, classements et statistiques calculés uniquement à partir des données officielles du club.
