# Étape 63 — Cybersécurité, confidentialité et accessibilité mobile

**24 octobre 2026 — Corrections techniques et tests automatisés.**
Aucun paiement, base Supabase, droit de membre, identité personnelle ou média n'a été modifié dans cette livraison. Les critères de validation juridique et sur appareils physiques restent ouverts.

## Audit préalable

- Le site GitHub Pages faisait une **requête automatique à Google Fonts** dès l'ouverture de l'accueil, avant tout acte du visiteur. Supabase et jsDelivr constituent par ailleurs des prestataires techniques toujours nécessaires à la connexion et aux données.
- La politique de référent était `strict-origin-when-cross-origin` : elle autorisait l'envoi de l'origine du site à un service externe.
- Il manquait une politique de sécurité du contenu explicite (CSP) dans l'export statique. GitHub Pages ne permet pas de configurer directement toutes les en-têtes HTTP de sécurité depuis ce dépôt.
- Le menu mobile possédait déjà une fermeture Échap, des raccourcis et un lien d'évitement, mais les contrôles automatiques des zones tactiles et des libellés de formulaires étaient partiels.
- Le site garde les pages juridiques **provisoires** et une politique `noindex` jusqu'à validation du club. Les tests utilisateurs réels MFA/RLS et les restaurations de données n'ont pas encore été homologués.

## Correctifs réalisés

### 1. Supprimer les appels automatiques aux polices Google

Les balises `preconnect` / `stylesheet` vers `fonts.googleapis.com` et `fonts.gstatic.com` sont supprimées. La typographie s'appuie désormais sur les polices du système de l'utilisateur (SF Pro sur iOS quand disponible, interfaces Android/Windows et équivalents), avec conservation du contraste, des poids et de l'identité bleu nuit/doré.

**Effet :** aucune requête Google Fonts liée à l'affichage d'une page Boissy-UJ. La police exacte varie suivant le système et doit encore être contrôlée visuellement sur vrais appareils.

### 2. Politique de sécurité et limitation des fuites de navigation

L'en-tête HTML incorpore une **CSP via `meta http-equiv`** comprenant :
- scripts `self` et `cdn.jsdelivr.net` uniquement ;
- connexions `self`, CDN nécessaire et **projet Supabase exact** (y compris canal WebSocket prévu) ;
- images et médias limités au site et à l'espace Supabase public approuvé ;
- `object-src 'none'`, `base-uri 'self'`, `frame-src 'none'`, `form-action 'self'`, `upgrade-insecure-requests` ;
- aucune évaluation JavaScript arbitraire ni `unsafe-inline` pour les scripts ;
- aucune police tierce en `font-src`.

`Referrer` est passé à **`no-referrer`**. Cela réduit l'exposition de l'adresse du site dans des requêtes vers des prestataires tiers.

**Limites :** la CSP `meta` n'équivaut pas à des en-têtes serveur complets (notamment `frame-ancestors` et le reporting CSP). `style-src 'unsafe-inline'` subsiste pour les styles dynamiques existants ; jsDelivr reste un fournisseur de dépendances actif pour Auth et devra faire l'objet d'une revue de chaîne d'approvisionnement (bundling local/SRI lorsque réalisable). Aucune « certification anti-XSS » n'est revendiquée.

### 3. Contrôle continu des domaines externes

Le parcours Chromium anonyme refuse maintenant **tout domaine de requête non répertorié**. Les origines autorisées à ce stade sont :
- `https://dahzewvbybujqhogumte.supabase.co` ;
- `https://cdn.jsdelivr.net`.

Les rapports conservent **des origines seulement**, jamais des URL complètes, identifiants, corps de requêtes ou cookies. L'export public échoue si la CSP, la politique de référent ou la suppression de Google Fonts régressent.

Une nouvelle origine n'est **pas automatiquement déclarée sûre** : elle doit être examinée, documentée, inscrite explicitement et soumise à l'actualisation des informations de confidentialité avant d'être autorisée.

### 4. Accessibilité et confort mobile

- Cadre de focus clavier renforcé pour champs, sélecteurs et contrôles `summary`, en plus des liens et boutons existants.
- Cibles tactiles de **44 × 44 CSS px au minimum** dans le menu principal mobile, contrôlées par Chromium sur les routes étroites.
- Styles adaptés à l'option système « réduire les animations » pour éviter les mouvements de transition et les animations répétées sur les pages.
- Respect des contrastes forcés dans les environnements qui exposent ce réglage ; simulation locale limitée.
- Formulaire de connexion vérifié automatiquement pour les étiquettes visibles.
- Zoom manuel du navigateur maintenu : pas de `user-scalable=no` ni `maximum-scale=1`.

### 5. Conditions de validation encore ouvertes

Ces contrôles automatisés ne vérifient **pas** VoiceOver, TalkBack, les performances du site public, la réinitialisation de mot de passe avec comptes réels ou les détails RGPD. Les validations suivantes restent nécessaires :

| Contrôle | Preuve attendue | État |
|---|---|---|
| iPhone Safari | Parcours accueil, huit chapitres, connexion et focus du menu ; clavier virtuel, VoiceOver, zoom texte | À tester sur appareil |
| Android Chrome | Parcours mêmes écrans, TalkBack, taille des boutons, clavier et absence de scroll horizontal | À tester sur appareil |
| Compte invité + membre | Navigation de toutes les routes, gestion des erreurs, rappel des droits sans fuite PII | Recette réelle à faire |
| Sept comptes et cumuls de rôles | RLS, MFA AAL1/AAL2, isolation convocations entre équipes | Staging séparé nécessaire |
| Confidentialité | Responsable, contact, finalités et bases légales, conservation, sous-traitants, données des mineurs | Validation écrite du club |
| Photos et vidéos | Consentements, suppression Storage et droit à l'image, notamment des mineurs | Validation écrite du club |
| Sauvegarde et restauration | Export autorisé, restauration isolée et contrôle d'intégrité | À faire sur environnement séparé |
| Déploiement Pages | Vérifier le commit `release.json` en ligne avec le workflow de publication | À confirmer indépendamment |

Ne pas publier de données nominatives ou screenshots de sessions personnelles dans les artefacts de la CI. Conserver les tests Chromium **anonymes** et les procès-verbaux réels dans un espace privé habilité.

### Résultat et suite

Le périmètre **code + tests automatiques** de cette étape est prêt à fusionner après CI. Le cahier des charges et la matrice pondérée restent inchangés sur les critères nécessitant homologation. Il est prématuré d'annoncer le site « 100 % RGPD » ou « validé Safari/Android » sans preuves indépendantes.

**Prochaine étape :** preuve de déploiement GitHub Pages, homologation fonctionnelle et juridique, publication des premiers contenus sportifs consentis, et fin des chantiers 58/60/61 qui nécessitent un staging.
