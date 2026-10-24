# Étape 62 — Données sportives fiables et première publication éditoriale

**24 octobre 2026 — Livrable technique, sans écriture en production.**

## État des données réellement disponibles

Audit Supabase en lecture seule au début de l'étape :
- **5 équipes** déclarées (Seniors A, Seniors B, Seniors C amicaux, Vétérans, Senior dans la catégorie futsal).
- **0 match saisi**, **0 match publié**, **0 classement de poule publié**.
- **0 saison enregistrée** et **0 actualité publique approuvée**.

Le site public dispose toutefois déjà de relevés de rencontres 2026–2027 **de fournisseurs externes** (principalement SportCorico, complétés par des archives TheFootData), utilisés sur Match Center, Agenda, profils d'équipes et accueil. Ils ne sont ni une synchronisation FFF autorisée ni une saisie officielle du club. Les données de tiers n'ont pas été recopiées dans Supabase.

### Distinction indispensable Boissy UJ / Boissy FC

Les résultats web mélangent facilement deux clubs distincts à Boissy-Saint-Léger : **Boissy U.J.** et **Boissy FC**. Pour cette étape, seuls les relevés du club Boissy U.J. sont pris en compte. Un score ou un classement trouvé sous « Boissy FC » ne doit jamais être importé dans Boissy UJ.

La source publique de référence **non contractuelle** consultée est SportCorico, Boissy U.J. Seniors 1, saison 2026–2027. Elle évoque notamment la rencontre contre Nogent-sur-Marne prévue le 1er novembre 2026, mais **ce relevé ne prouve pas une homologation du calendrier par le club**. D'autres résultats peuvent être corrigés après reports, forfaits ou décisions du district.

## Corrections effectivement codées

### 1. Plus de fausse « confirmation par le club »

Dans `external-match-previews.mjs`, tous les événements venant des relevés externes exposent maintenant `date_confirmed_by_club=false`. L'accueil `home-next-match.mjs` transmet **`clubConfirmed:false`** à la carte pour toutes ces références. Le texte de l'accueil rappelle que la date/l'horaire nécessitent une confirmation du club.

Les rencontres réellement **publiées** dans Supabase par un opérateur habilité restent prioritaires et peuvent annuler/remplacer leur version externe, sans double affichage.

### 2. Nouveau module admin « Revue des sources sportives »

Le panneau est ajouté dans le Control Center sous **Sport**, derrière les mêmes protections administrateur et MFA AAL2 que les autres pages privées.

Trois lectures sont effectuées, **sans écriture** :
- liste des équipes et leur identifiant réel `club_teams` ;
- RPC admin des matchs `admin_list_management_matches` ;
- RPC admin des actualités `admin_list_management_news`.

`sport-source-review.mjs` rapproche les références du calendrier sourcé et les dossiers de match présents dans Supabase par **équipe + jour à Paris + adversaire normalisé**. Il signale :
- nouveau match externe sans dossier interne ;
- résultat relevé par un tiers, mais pas homologué ;
- date dépassée avec match toujours planifié et sans résultat ;
- contradiction de score avec un dossier du club, annulation, double relevé ou données invalides ;
- référence déjà saisie **dans un dossier** (ce qui ne vaut pas validation publique).

Le panneau affiche, par équipe, le nombre de références à examiner et des informations récentes sans envoyer le supporter sur un autre site. **Il n'a aucun bouton d'import ou de publication automatique.** Le raccourci « Gérer les matchs » ouvre l'éditeur administratif protégé déjà présent. Les chiffres de dossiers sont présentés comme **partiels** si les plafonds des RPC sont atteints. Aucune identité de joueur, pièce jointe ou liste de membres n'est utilisée.

### 3. Classements publics résilients

`league-standings.mjs` applique désormais un timeout public de **12 secondes** et l'annulation lors des changements de page. Quand le réseau Supabase est indisponible, le site ne conserve plus le chargement indéfiniment : il affiche que le classement officiel n'est pas confirmé, puis seulement les éléments de contexte externe explicitement étiquetés. Aucun rang officiel n'est inventé.

### 4. Actualités initiales : préparation, pas de publication fictive

Le panneau permet à l'administrateur de compter les actualités **publiées, publiques, consenties et effectivement datées**. Le module d'administration « Actualités », ses contrôles de consentement et le double clic de confirmation restent la voie officielle de publication.

**Aucune actualité n'a été créée ni publiée** : le club doit fournir un texte/visuel autorisé et confirmer les droits, notamment si des personnes mineures sont citées ou montrées. Ne pas inventer un entraîneur, un match, un lieu ou un communiqué institutionnel pour remplir la page.

## Procédure de première publication après approbation

1. Faire identifier par un dirigeant une source FFF/district autorisée ou un procès-verbal officiel. Vérifier les dates, opposants, scores, équipes et compétitions, sans confondre un forfait administratif avec un score joué.
2. Vérifier les droits de reprise : la simple disponibilité publique du fournisseur ne constitue pas une autorisation de syndication/bulk export.
3. Ouvrir **Control Center → Revue des sources sportives** et contrôler les écarts, puis **Matchs et résultats** pour enregistrer les informations avec le bon onglet Championnat/Coupe.
4. Publier uniquement les rencontres/événements validés par le club. Contrôler immédiatement l'accueil, l'Agenda, le Match Center et le classement.
5. Faire approuver un premier article sans identités ou photos non consenties, puis le publier via **Actualités**. Vérifier son affichage public sur mobile et ordinateur.
6. Recontrôler que les données externes restantes portent le libellé **non homologué** et que les pages n'inventent pas de score ni de rang.

Les confirmations club et les habilitations de publication doivent être vérifiées en recette réelle. Cette étape n'active ni synchronisation officielle FFF, ni scrapping automatique, ni paiement, ni nouveaux rôles.

## À faire pour clôturer l'étape 62

- Obtenir la validation officielle du calendrier, de ses scores et des classements, et les droits nécessaires à leur diffusion.
- Disposer d'au moins une saison, des matchs validés et d'une actualité officielle approuvée.
- Publier les premiers enregistrements par les RPC d'administration déjà sécurisés, avec contrôle MFA et traçabilité ; puis vérifier en public l'actualisation après la date du match.
- Valider la recette réelle sur le site déployé (Chrome/Safari/Android) et une revue de fraîcheur des sources.
- Dépendance juridique : accord sur les contenus éditoriaux et droits à l'image avant publication.

**État : vérification/qualification des références et fiabilité de l'interface codées ; première publication réelle et synchronisation FFF non effectuées.**
