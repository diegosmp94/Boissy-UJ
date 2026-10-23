# Étape 59 — Administration éditoriale, réactions et médias

**23 octobre 2026 — Lot front-end / administration.** Priorité actuelle : disposer d'un site public utilisable sans fausses publications, tout en préparant l'accès aux fonctions éditoriales à validation de droits.

## Diagnostic de la production avant intervention

La table des actualités et son audit existent en production. **Les tables news_reactions et news_media_assets n'y existent pas encore** : les migrations d'ajout sont écrites dans le dépôt mais elles n'ont pas été appliquées sur Supabase production. Les nouveaux composants sont donc conçus pour ne pas forcer ces fonctions ni modifier la base.

## Livré dans cette étape

### 1. Suivi administratif des publications

Le centre de gestion contient un nouveau module **« Suivi des publications »**, accessible seulement après les mêmes contrôles admin et MFA AAL2 que les autres outils. Il effectue des **lectures**, jamais de modifications :
- Dossiers d'actualités retournés par le RPC protégé, dont publiés avec consentement et brouillons/à valider.
- Médias listés par le RPC protégé, séparés entre visibles avec droits vérifiés et éléments encore à revoir.
- Disponibilité du service de réactions par une lecture limitée au compte connecté ; aucune réaction d'autrui, aucun compteur nominatif.
- Explication spécifique si les migrations média/réactions manquent ou si leur lecture est refusée.
- Raccourci vers le véritable éditeur d'actualités ; raccourci médias uniquement si le RPC de médias fonctionne et que la navigation centrale l'autorise.

Les chiffres sont issus des seules réponses de l'administrateur et **ne constituent pas un inventaire exhaustif** lorsqu'une limite de 200 articles / 500 médias est atteinte. Le panneau ne présente ni texte de publication privée, ni auteur, ni nom de membre, ni chemin Storage dans les KPI. Son contenu est remplacé à chaque actualisation et ne se duplique pas.

### 2. Actualités non bloquées par les services complémentaires

Le chargement de la liste publique d'articles se termine **avant** de charger les compléments : galeries et réactions se résolvent séparément. Si la connexion Auth, l'API de médias ou un module externe ralentit ou échoue, les articles déjà publics restent visibles. Les réponses tardives après changement de route sont ignorées.

Les migrations manquantes ne sont jamais interprétées comme des publications disponibles ou comme une réussite de la recette RLS.

### 3. Photos grand format dans le site

Toute photo visible et autorisée venant du bucket Storage approuvé peut être agrandie **sur le site**, via un élément dialog natif accessible au clavier, fermeture Escape/bouton, description et légende conservées, puis restauration du focus sur l'image ouverte. Les vidéos restent lues avec le lecteur navigateur, ses contrôles explicites et **sans lecture automatique**. Aucun site tiers ni lecteur iframe ajouté.

### 4. Tests

Scénarios Node simulant le catalogue admin AAL2, les RPC absents, les comptages réellement autorisés, la résolution indépendante des médias/réactions, les réponses tardives et la présence d'une modale de photo sécurisée. Les routes Chromium et audits de distribution sont conservés.

## Dépendances conservées — pas de déclaration de faux 100 %

- Exécuter des tests réels sur un environnement Supabase isolé, puis déployer les migrations des réactions et des médias avec autorisation, contrôle RLS à deux comptes et vérification Storage.
- Faire confirmer les droits à l'image, notamment pour les personnes mineures, et prévoir retrait/effacement du fichier lui-même dans Storage.
- Importer uniquement des photos et vidéos réellement autorisées par le club, puis publier un article réel via l'éditeur.
- Le système de paiement reste désactivé. Aucune table/migration Supabase de production n'a été modifiée par cette étape.

**Statut : interfaces et tests préparés ; activation effective des réactions/galeries suspendue aux migrations et à la recette de sécurité.**
