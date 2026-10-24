# P1 — Identité, accueil, navigation, qualité et confidentialité

## Contenu livré sur la branche P1
- Les huit chapitres cinématiques, la direction artistique bleu nuit/doré, l'écusson et les liens vers le football à 11 et le futsal restent inchangés.
- Le nom **Senior** apparaît désormais dans les menus desktop et mobile sous la catégorie **Futsal**, avec sa route historique conservée.
- Les introductions peuvent être sautées et la navigation au clavier est rétablie sur le contenu principal après un changement de page. La fermeture du menu mobile par Échap restaure le focus.
- Les menus mobiles longs deviennent déroulants, les cibles interactives font au moins 44 px et la réduction des animations tient compte de la préférence système.
- Pages publiques `#/confidentialite` et `#/mentions-legales`, disponibles sans compte ; lien de premier niveau vers la vie privée depuis Mon espace et pied de page commun.
- Les pages indiquent franchement les prestataires effectivement présents (GitHub Pages, Supabase et jsDelivr (Google Fonts retiré à l’étape 63)), le traitement technique des comptes et le stockage local de session ; pas d'adresse, de numéro RNA ou de durée de conservation inventés.
- Métadonnées sociales minimales, référent absent (no-referrer) et politique de sécurité CSP et préchargement du logo sans ajouter de traceur tiers.
- Préproduction : correction de `scripts/build-preview.mjs` afin de copier les modules ESM / styles racine nécessaires, la totalité des assets publics, et **jamais** les dossiers docs/tests/migrations/scripts.
- `scripts/audit-preview.mjs` contrôle chaque import relatif et les assets HTML du `dist/`, l'absence de dossiers internes/éléments privés, et le maintien explicite du `noindex`. Il est exécuté par les deux workflows GitHub Actions.

## RGPD : mesures techniques versus obligations du responsable

La CNIL demande une information compréhensible sur les **finalités, fondements juridiques, destinataires, durées, transferts et droits**, au moment de la collecte. Référence : https://www.cnil.fr/fr/passer-laction/rgpd-les-premieres-etapes

Les traceurs soumis à consentement ne doivent pas être activés avant le choix explicite du visiteur. Le code actuel ne charge pas d'outil publicitaire ni d'analyse marketing, mais utilise des dépendances externes et la session d'authentification : un inventaire réel des cookies/prestataires reste nécessaire. Références : https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles ; https://www.cnil.fr/fr/cookies-solutions-pour-les-outils-de-mesure-daudience

**Champs à faire valider par le club avant l'homologation RGPD** :
- identité juridique exacte de l'association, siège, identifiants administratifs applicables, directeur de la publication et adresse de contact officielle ;
- responsable de traitement, bases légales par finalité, prestataires, pays de traitement et garanties de transfert ;
- calendrier de conservation et d'effacement par catégorie, procédure d'accès/rectification/suppression, traitement des demandes des parents ou représentants légaux ;
- conformité des publications de photos et vidéos (droits à l'image, consentement selon situation, mineurs) ;
- registre et contrats de sous-traitance, contrôle des paramètres Supabase Auth, procédure de violation de données.

Aucune adresse e-mail, durée ni coordonnées non vérifiées n'ont été inscrites dans l'application. Aucun faux bouton de demande RGPD n'a été publié.

## Complément — contrôle du site publié et inventaire

L'[inventaire RGPD technique et la recette navigateur](P1_BROWSER_RGPD_INVENTAIRE.md) sont automatisés dans la CI. Un test HTTP **manuel** lit la vraie version GitHub Pages publiée sans modifier les données de membres. Ce contrôle ne prouve ni la conformité RGPD ni le fonctionnement sur iPhone Safari physique.

## Déploiement et validation

Le déploiement est techniquement contrôlé par `npm run release:check`. Les fichiers clients nécessaires se retrouvent dans `dist/`, pas les fichiers internes. **La configuration actuelle conserve `noindex, nofollow` et un robots.txt bloquant** : ce choix évite l'indexation d'un site dont les mentions légales ne sont pas validées. La suppression du blocage SEO doit être une décision distincte après la publication des vraies mentions légales.

### Recette indispensable avant "15/15" et "4/4" homologués
- [ ] Vérification visuelle sur iPhone Safari réel, Android Chrome, tablette et ordinateur (petit écran à 320 px, navigation sticky et formulaires).
- [ ] Parcours clavier complet : introduction, menus, liens légaux, authentification et sortie Échap ; lecteur d'écran et contraste.
- [ ] Mesure réelle des performances (LCP/CLS/INP) sur GitHub Pages et réseau mobile, optimisation des images et polices si nécessaire.
- [ ] Politique de confidentialité et mentions légales complétées **et validées par le club**.
- [ ] Vérification des traces et cookies réels de tous les services tiers, et base légale par finalité.
- [ ] Contrôle de l'export/restauration Supabase dans un environnement de test, avec preuve de récupération sans altération de production.
- [ ] Homologation juridique, validation de la gestion des droits des personnes et données des mineurs.
- [ ] Lever `noindex` et définir les métadonnées de lancement seulement après homologation publique.

**État honnête : le code et les contrôles CI P1 sont améliorés, mais les domaines ne sont pas encore homologuables à 15/15 et 4/4 sans ces vérifications et ces informations du responsable.** Aucun score d'avancement global nouveau ne doit être présenté comme officiellement certifié sur la seule base des tests CI.
