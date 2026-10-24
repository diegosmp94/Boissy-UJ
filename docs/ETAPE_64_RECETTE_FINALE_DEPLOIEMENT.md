# Étape 64 — Recette finale du site et preuve de publication

**24 octobre 2026 — Livraison technique en cours.** Cette étape est la recette de publication et la consolidation de l'homologation, **pas une autorisation implicite de démarrer tous les services**.

## État à l'ouverture de l'étape

- Dernier commit `main` vérifié avant cette étape : `4b82eee9c93f53425f05c3a6e2f41ff1c5e11d24` (étape 63 / PR #89).
- GitHub indique que la fonctionnalité Pages est activée dans le dépôt, mais les outils de lecture disponibles ne permettent pas de confirmer la dernière version du site par son URL ni de récupérer les exécutions du workflow Pages.
- Les 16 parcours anonymes Chromium et les 554 tests Node de l'étape 63 étaient verts **sur l'export testé**, pas sur les appareils des membres.
- `docs/CHANTIERS_OUVERTS.md` répertorie toujours **14 chantiers ouverts (6 P1 / 6 P2 / 2 P3)** ; les fonctionnalités avec paiement, les réservations QR et les votes Premium n'ont pas été homologués. Le cahier des charges distingue les tests techniques de la recette métier à signer.

## Corrections de l'étape 64

### 1. Certifier la version publique exacte (HTTP seulement)

`npm run smoke:live` ne se contente plus de découvrir une page HTML répondant `200`. La commande cible **l'adresse canonique** `https://diegosmp94.github.io/Boissy-UJ/`, ou un serveur de test **strictement local** et sans donnée personnelle. Elle refuse les domaines malveillants et les chemins d'un autre projet.

Elle vérifie les fichiers de la page principale, des styles, de l'authentification, des matchs, des équipes, des actualités et du prochain match, ainsi que :
- les types MIME corrects, pour détecter une page d'erreur HTML servie à la place de JavaScript ou de CSS ;
- l'absence de redirection vers un autre site ou vers le mauvais chemin ;
- les balises `noindex`, `no-referrer` et CSP présentes dans l'index ;
- `robots.txt` conservant `Disallow: /` ;
- **`release.json` obligatoire, JSON strict `{commit,source:"main"}`**, avec une empreinte SHA Git complète ; lorsque l'environnement fournit `BOISSY_EXPECTED_COMMIT`, cette empreinte **doit correspondre exactement** au commit de référence.

La commande enregistre `smoke-artifacts/live-public-report.json` avec les noms des ressources et un booléen réussite/échec, sans nom de membre, identifiant de session, cookie, secret, chemin de Storage ou corps des réponses HTTP.

Une vérification manuelle utilise également `BOISSY_EXPECTED_COMMIT: github.sha`. Un `release.json` valide **sans commit attendu** ne prouve pas que la version correspond au dernier `main`.

### 2. Parcours mobile sans rechargement

En plus des **16 contrôles de pages existants**, le test Chromium suit les liens sur une seule session anonyme entre :
- **Mon espace → Confidentialité** ;
- **Confidentialité → Mentions légales** ;
- **Mentions légales → Match Center**.

À chaque étape, le test exige la **nouvelle route**, le contenu attendu, la restitution du focus au `main` et l'absence de débordement horizontal. Il n'ouvre aucun compte et n'utilise aucune donnée membre réelle.

### 3. Séparer les preuves HTTP des validations humaines

`npm run release:acceptance` produit `smoke-artifacts/production-readiness.json`. La commande consolide seulement une preuve `live-public-report.json` valide, et la liste des chantiers en attente. Même si le site public sert les bons fichiers, elle ne peut **jamais signer ou certifier automatiquement** les aspects suivants :
- droits RLS/MFA des sept comptes de test ;
- sauvegarde et restauration réellement prouvées ;
- tests VoiceOver sur iPhone/Safari et TalkBack sur Android ;
- RGPD, mentions légales et autorisations de médias pour les mineurs ;
- premiers résultats, calendriers et actualités approuvés ;
- paiements et remboursements, billets et Awards réellement testés.

Le rapport reste **NO-GO pour le produit complet** tant que les chantiers sont ouverts. Le déploiement du site vitrine et l'homologation de ses modules payants ou réservés aux membres sont deux décisions **distinctes**.

Les workflows Pages principal et manuel conservent les deux rapports dans les artefacts GitHub, et n'utilisent ni des comptes ni des secrets d'administration pour vérifier le site.

## Comment confirmer la véritable publication

1. Dans `GitHub → Boissy-UJ → Settings → Pages`, vérifier que **Build and deployment → Source = GitHub Actions**, sans changer les paramètres d'autres dépôts.
2. Dans **Actions → Publier le site public Boissy-UJ**, contrôler que les jobs `build`, `deploy` et `verify` du commit `main` recherché ont réussi.
3. Ouvrir l'artefact **boissy-pages-verification** puis `live-public-report.json` : `mainRevisionVerified=true`, `passed=true` et le commit attendu doivent être présents. **Vérifier aussi que le SHA correspond bien au dernier `main`.**
4. Ouvrir réellement le site sur iPhone et Android et refaire les essais affichage/navigation. Ne pas inclure de capture contenant un compte connecté dans des artefacts publics.
5. Lire `production-readiness.json` : les validations juridiques, administratives et les usages réels restent à consigner dans un PV signé par le responsable autorisé.

Le workflow peut demander un ajustement des autorisations Pages pour le dépôt. Il ne faut pas déclarer le site publié tant que sa preuve HTTP n'existe pas.

## Conclusion provisoire

Le **socle vitrine** peut être préparé et vérifié techniquement ; cela **ne prouve pas** la mise en ligne ou l'aptitude du site entier à traiter toutes les données des membres. La matrice pondérée ne doit pas être ramenée artificiellement à 100 %.

**À ne pas lever :** `noindex`, les protections de production Supabase, les garde-fous de paiements/dons et les fonctionnalités billets/votes non homologuées.
