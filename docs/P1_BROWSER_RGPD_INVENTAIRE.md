# P1 — Recette automatisée navigateur et inventaire RGPD technique

## Objectif
Renforcer le domaine **Identité, accueil et navigation** et le domaine **Qualité, RGPD et déploiement** de la matrice, sans prétendre réaliser une validation juridique complète ni lancer les fonctionnalités commerciales.

## Preuve automatique sur une vraie instance Chromium
L'étape de CI `npm run smoke:browser` démarre un serveur HTTP **local** uniquement sur l'export statique `dist/` et un navigateur Chromium sans session connectée. Quatre vues sont vérifiées et capturées :
1. Accueil mobile à **320 × 760**, huit chapitres, menu mobile, fermeture Échap, retour du focus et absence de débordement horizontal.
2. Confidentialité sur mobile à **390 × 844**.
3. Mentions légales sur tablette à **768 × 980**.
4. Équipe **Senior** de la catégorie **Futsal** à **1366 × 850**, avec son ancienne route stable.

En cas de succès comme d'échec, GitHub Actions conserve temporairement les captures publiques et le rapport dans l'artefact `boissy-uj-navigateur-p1`. Les captures n'incluent **aucun utilisateur connecté** : l'exécution utilise un profil navigateur jetable, sans identifiants ou appels privilégiés.

**Important** : l'outil Chromium vérifie le rendu fonctionnel d'un export local. Il ne remplace pas une session Safari sur iPhone ni une homologation sur la plateforme Pages.

## Inventaire RGPD et cookies côté code
La commande `npm run audit:privacy` examine les fichiers clients statiques (.html/.css/.js/.mjs) et produit `smoke-artifacts/privacy-inventory.json` : domaines externes présents dans le code, fichiers qui utilisent `localStorage`, `sessionStorage`, cookies ou IndexedDB, et empreintes de traceurs marketing fréquents.

Il s'agit d'un **inventaire statique** : un domaine mentionné peut être une référence dans du contenu, et certains accès peuvent être créés par des librairies tierces au chargement. Ce rapport ne prouve donc **ni l'absence totale de cookies ni la conformité RGPD**. Le club doit confirmer les sous-traitants, garanties, durées, bases juridiques, la gestion des données des mineurs et les coordonnées du responsable.

## Vérification manuelle du site GitHub Pages publié
`npm run smoke:live` contacte en HTTPS la version publique `https://diegosmp94.github.io/Boissy-UJ/` et contrôle : accueil, fichier JavaScript principal, feuilles de style et référentiel d'équipes. Le script vérifie les routes de confidentialité, le blocage de l'indexation tant que le juridique n'est pas validé et le libellé Senior en futsal.

Il est **séparé de la CI des pull requests**, car le site déjà publié peut être différent d'une branche non fusionnée. Un administrateur du dépôt peut lancer `Vérifier manuellement GitHub Pages Boissy-UJ` via l'onglet Actions GitHub après la publication du `main` de son choix. Un rapport positif signifie seulement que les fichiers de base sont accessibles par HTTP.

## Sorties et limites
La revue technique peut être considérée **réalisée côté automatisation** lorsque les deux workflows, les captures et l'inventaire sont verts. **Ne pas attribuer automatiquement 15/15 ou 4/4 points de recette.** Les critères bloquants qui subsistent sont :
- validation juridique des mentions et de la confidentialité par le club ;
- tests sur vrais appareils iPhone/Safari et Android, lecteurs d'écran, contraste et performances de production ;
- contrôle réseau en navigateur des traceurs, cookies et ressources tierces ;
- sauvegarde et **restauration Supabase** réellement réalisées et documentées dans un environnement séparé, jamais par altération des données de production ;
- traitement des demandes de droits et conformité des photos/données des mineurs.

Le site reste provisoirement en `noindex` conformément au choix conservateur de lancement.
