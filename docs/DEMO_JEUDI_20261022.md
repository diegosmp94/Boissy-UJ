# Démonstration Boissy-UJ — jeudi 22 octobre 2026

**Objectif :** permettre une présentation honnête et réellement interactive dès jeudi, sans rouvrir dans l'urgence les risques liés aux comptes, au MFA, aux données personnelles ou aux paiements.

## Lien public à présenter

**https://diegosmp94.github.io/Boissy-UJ/#/presentation**

Cette nouvelle page doit être livrée après vérifications GitHub Actions et déploiement GitHub Pages. Elle est également accessible depuis l'accueil et le menu mobile.

## Scénario de présentation (5 à 8 minutes)

1. **0:00 – Accueil** : montrer l'écusson, l'identité cinématique et la navigation entre les huit chapitres.
2. **1:00 – Page Démonstration** : ouvrir la liste des modules publics et cliquer vers « Équipes » / « Match Center ».
3. **2:00 – Supabase en direct** : « Vérifier à nouveau » sur six catalogues publics. Si le compteur est 0, cela signifie **catalogue accessible mais aucun contenu publié** ; si le réseau empêche l'accès, le module l'indique.
4. **3:00 – Fiche de match locale** : saisir un adversaire imaginaire, une date et un résultat, puis utiliser « Prévisualiser ». Montrer que les champs sont validés mais qu'aucun faux résultat n'est publié.
5. **4:00 – Atelier article** : préparer un titre, un résumé et un texte, puis afficher l'aperçu, sans enregistrement ni photo de joueur.
6. **5:00 – Convocations** : simuler « Présent / Absent / Incertain » sans identité et sans invitation réelle.
7. **6:00 – Saisons** : montrer le contrôle des dates et les saisons réellement disponibles en lecture seule.
8. **7:00 – Pages publiques** : parcourir « Awards », « Nous rejoindre » et « Infos pratiques ». Si aucun contenu officiel n'est saisi, les écrans affichent des messages d'attente explicites.

## Ce qui fonctionne et peut être montré

| Fonction | Démonstration jeudi |
|---|---|
| Site statique hébergé / navigation | Fonctionnement réel depuis GitHub Pages |
| Équipes et pages publiques | Fonctionnement réel en consultation |
| Flux d'actualités, événements, Awards, recrutement | Consultation réelle des lignes publiées ; éventuellement vides |
| Vérification des catalogues Supabase | GET en lecture seule, compteur exact seulement s'il est fourni par le serveur |
| Formulaire local de match | Validation des champs + aperçu sans écriture |
| Formulaire local d'article | Validation + aperçu sans écriture |
| Simulation des convocations | Choix d'équipe et statut sans membre réel |
| Saisons | Lecture Supabase + planificateur local sans écriture |

## Ce qui ne doit PAS être présenté comme opérationnel

- Création de comptes, connexion réelle, MFA, attribution de rôle réel.
- Publication de matchs/articles via une session d'éducateur autorisée.
- Convocations et réponse par de vrais joueurs.
- Nominations, votes Premium, inscription, billetterie, abonnements Stripe.
- Résultats, horaires, contacts et catégories officiellement non renseignés.
- Test navigateur réel iOS/Android complet : la CI est un contrôle de code, pas un parcours E2E garanti.

**Aucune donnée fictive n'est insérée dans Supabase.** Les exemples saisis dans les ateliers restent locaux, non enregistrés.

## Recette de la veille

- [ ] Suite Node et vérifications GitHub Actions vertes.
- [ ] Fusion dans `main` et déploiement GitHub Pages réussi.
- [ ] Routes `#/presentation`, `#/matchs`, `#/awards`, `#/rejoindre`, `#/infos-pratiques` vérifiées dans le dépôt.
- [ ] S'assurer que `auth-config.mjs` conserve `enabled: false`.
- [ ] Vérifier qu'aucune requête de modification ou clé privilégiée ne figure dans le module.
- [ ] Ouvrir l'URL sur l'iPhone de présentation et actualiser l'onglet si une ancienne version est en cache.

## Plan B sans connexion Supabase

Si le réseau mobile bloque les requêtes Supabase, le site reste consultable. Les quatre ateliers **en mémoire** fonctionnent sans base distante (sauf la liste des saisons, qui affichera son état d'indisponibilité), tandis que les vérifications indiquent explicitement les catalogues non joignables. Ne jamais transformer cet échec de connexion en fausse donnée.

## Suite après la présentation

Authentification, MFA et opérations réelles du Control Center resteront les prochaines étapes de production, avec tests multi-rôles. Les pourcentages d'achèvement du site ne doivent pas être artificiellement augmentés à cause de cette page : il s'agit d'une **amélioration de démontrabilité**, pas d'une homologation de toutes les fonctions.
