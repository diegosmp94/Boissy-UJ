# Publication opérationnelle du site public — lot prioritaire

**23 octobre 2026.** Cette livraison porte sur le **site public** et sur ses contrôles de disponibilité, pas sur un nouveau projet Supabase ni sur un service de paiement.

## Audit avant modification

La base Supabase de production contient actuellement :
- cinq équipes enregistrées ;
- zéro match dans la table matches ;
- zéro actualité publique autorisée et publiée ;
- zéro événement public publié ;
- zéro catégorie Awards publiée.

Il est donc **impossible** de présenter ces quatre catalogues comme alimentés par le club sans publications officielles. Le calendrier de référence déjà présent dans le code est conservé avec sa distinction de source non confirmée, sans inventer de score. Les visiteurs peuvent consulter la navigation, les équipes et les informations existantes même si aucun contenu n'est encore publié.

## Nouveau pipeline de publication depuis main

Le workflow GitHub Actions **.github/workflows/pages-public.yml** s'exécute à chaque push sur main, ou par déclenchement manuel. Il :
1. Vérifie le JavaScript, exécute tous les tests, les contrôles du bundle public, l'inventaire des fournisseurs et les tests de navigation Chromium.
2. Prépare exclusivement le dossier **dist**, qui ne contient **ni SQL, ni documents internes, ni tests, ni secrets serveur**.
3. Inscrit dans **dist/release.json** l'empreinte complète du commit main réellement déployé. Ce fichier public ne contient que la révision et le nom de la branche.
4. Publie par le mécanisme officiel GitHub Pages, à partir d'un artefact examiné.
5. Contrôle la vraie adresse HTTPS du site, ses ressources essentielles et la concordance de la révision publique avec main. En cas de non-concordance, l'étape de vérification **échoue au lieu de déclarer le site opérationnel**.

**Configuration nécessaire si GitHub Pages ne publie pas encore avec Actions :** dans le dépôt GitHub, aller dans **Settings → Pages → Build and deployment → Source**, choisir **GitHub Actions**. Le workflow ne peut pas forcer ce réglage depuis une intégration disposant seulement du droit d'édition des fichiers GitHub.

Le site cible : https://diegosmp94.github.io/Boissy-UJ/ . La disponibilité réelle doit être confirmée par l'étape de vérification post-déploiement, et ne découle pas du seul succès de la CI sur les PR.

## Résilience du catalogue public

Les chargements publics des pages **Matchs, Actualités, Événements et Awards** disposent d'un délai réseau fini de **12 secondes**. Si le serveur ne répond pas, ils quittent le chargement et affichent leur état indisponible explicite. Un changement de route interrompt toujours l'ancienne requête, évitant de dessiner du contenu sur la mauvaise page.

Les données manquantes ne sont ni remplacées par des résultats fictifs ni par des achats simulés. Les paiements Stripe réels et les votes Premium restent désactivés.

## Ce qui empêche encore une homologation complète

- Le nouvel état de déploiement **GitHub Pages** doit être réellement contrôlé. Les tests de PR prouvent le code seulement ; GitHub Pages dépend également des paramètres du dépôt et de la réussite des jobs de déploiement.
- Les cinq équipes sont disponibles, mais les matchs, classements, articles, événements et Awards nécessitent des données officielles et la validation des droits par le club.
- Les mentions légales et la politique de confidentialité ne sont pas encore approuvées : le réglage **noindex, nofollow** est volontairement maintenu. Ne pas lancer de collecte ni de paiement non validé.
- Une recette réelle du parcours d'inscription/connexion et des droits administrateurs avec comptes de test reste nécessaire avant de prétendre à un service membre totalement certifié.

**Bilan du lot : automatisation de publication + retours d'erreur pour le public. La mise en ligne effective, les données éditoriales, les tests des utilisateurs et la conformité restent à confirmer séparément.**
