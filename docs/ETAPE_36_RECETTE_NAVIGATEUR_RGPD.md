# Étape 36 — Recette navigateur automatisée et inventaire RGPD technique

Ce lot prolonge le P1 sur **Identité, accueil et navigation (15 points)** et **Qualité, RGPD et déploiement (4 points)** sans déclarer les critères juridiques validés à tort.

## Vérification navigateur réelle

`npm run build:preview && npm run smoke:browser` démarre un serveur HTTP uniquement sur `127.0.0.1`, lance Chrome/Chromium headless et utilise les commandes de débogage officielles du navigateur (CDP) pour émuler :

| Scénario | Taille | Contrôle |
| --- | --- | --- |
| Accueil mobile | 320 × 760 | huit chapitres, liens légaux, menu mobile, Échap et retour du focus |
| Confidentialité mobile | 390 × 844 | informations RGPD, lien persistent et absence de débordement horizontal |
| Mentions légales tablette | 768 × 980 | page accessible, structure et navigation |
| Équipe Senior Futsal | 1366 × 850 | intitulé Senior, départemental 2, URL historique |

Les sorties `smoke-artifacts/browser-smoke.json` et les PNG de captures peuvent être récupérées comme artefacts de la workflow **Tests du socle Boissy-UJ**, retenus sept jours.

Les scénarios sont exécutés contre le paquet client `dist/`, sans vrai compte, sans nouveau joueur ni convocation et sans écriture Supabase. Ils **ne remplacent pas** une recette physique Safari/iPhone, Android, lecteur d'écran ou la mesure de performances sur le domaine public.

## Inventaire technique RGPD

`npm run audit:privacy` analyse les sources statiques pour recenser les domaines externes et l'emploi des API `localStorage`, `sessionStorage`, `document.cookie` ou `indexedDB`. Il enregistre `smoke-artifacts/privacy-inventory.json`, sans collecter de données d'utilisateurs, et fait échouer la CI en cas d'intégration explicite de fournisseurs connus de pistage publicitaire avant validation.

L'inventaire constitue une **base de vérification**, et non une certification RGPD. Il faut encore confronter cet inventaire au trafic réseau réel dans les navigateurs, vérifier les cookies déposés par les prestataires et faire approuver les documents par le responsable légal du club.

## Commandes et conditions de sortie

`npm run quality:release` exécute la suite de tests, l'audit des fichiers client, l'inventaire RGPD et les scénarios navigateur. Les deux pipelines GitHub vérifient l'inventaire ; la workflow de tests exécute Chromium et conserve les captures.

Critères d'acceptation non encore homologués : références légales complètes et confirmées, durée de conservation et fondements juridiques, parcours d'exercice des droits, restauration de sauvegarde, test sur iPhone Safari réel, Android réel, audit des contrastes/lecteurs d'écran et mesures LCP/INP/CLS sur site publié.

**Le 15/15 et le 4/4 ne peuvent pas encore être attribués.**
