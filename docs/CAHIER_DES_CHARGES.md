# Cahier des charges fonctionnel — Boissy-UJ

**Version : 1.5 — 21 octobre 2026**  
**Référence :** site public Boissy-UJ, espace membre et Control Center.  
**Statut :** administration réelle en cours d'ouverture derrière MFA AAL2 ; validation en navigateur encore requise.  
**Priorité :** les règles de rôles ci-dessous prévalent sur toute ancienne mention suggérant qu'un joueur, un éducateur ou un administrateur ne peut occuper qu'une seule fonction.

## 1. Objectifs et périmètre

Boissy-UJ est le site d'une association de football. Le projet couvre :
- Une vitrine publique immersive bleu nuit, bleu royal, blanc et doré, avec écusson officiel, accueil en huit chapitres et navigation responsive.
- Les **cinq équipes** validées par le club, désormais séparées par discipline : **football à 11** avec Seniors A (Départemental 3), Seniors B (Départemental 4), Seniors C (matchs amicaux, saisie manuelle), Vétérans (Départemental 3) ; **futsal** avec Senior (Départemental 2, source club manuelle tant que la référence officielle n'est pas fournie). Les équipes ont des identifiants, calendriers, affectations et statistiques distincts.
- Le Match Center, les saisons, les statistiques réellement publiées, les convocations privées et la préparation des articles.
- Le Control Center ne présente plus de modules de démonstration aux visiteurs. L'accès réel exige une session vérifiée, le rôle admin et MFA AAL2. Les écrans disposant d'une RPC serveur autorisée et traçable sont activés ; les paiements, réservations et fonctions sans backend fiable restent non disponibles. Le rôle Supporter ordinaire ne peut pas accéder à l'administration.
- La gestion des personnes publiques dispose d'un répertoire privé administrateur filtrable par équipe, publication et recherche, ainsi que d'une actualisation et d'une préparation explicite de dépublication sans écriture immédiate. Les vrais enregistrements sont bloqués jusqu'à la validation de l'authentification MFA AAL2. Le Control Center est désormais réservé aux administrateurs AAL2.
- Chaque fiche d’équipe est dotée de rubriques d’effectif public, d’encadrement public, de bilan des matchs terminés et d’actualités ciblées. Les noms publics sont distincts des comptes privés ; leur publication exige validation admin MFA AAL2, consentement et droits vérifiés (représentants légaux si nécessaire), audit et dépublication possible. Les données manquantes ne sont jamais inventées.
- Actualités, médias, événements, vie associative et espace supporters ; pas de messagerie privée ni de commentaires publics.
- Un **Control Center** administratif, traçable et protégé.
- L'offre Premium : **10 €/mois** ou **100 € pour 12 mois sans renouvellement automatique**, à activer uniquement après recette juridique et technique. Stripe est prévu en TEST avant toute autorisation LIVE.

Les résultats, classements et calendriers ne seront présentés comme officiels FFF que si la source et son droit d'utilisation sont confirmés. Aucune statistique, date ou identité ne doit être inventée.

## 2. Modèle des comptes et cumuls de rôles — NOUVELLE EXIGENCE PRIORITAIRE

### 2.1 Principe de cumul

**Un même compte peut posséder simultanément les rôles `player`, `coach` et `admin`.** Aucun de ces trois rôles ne s'exclut mutuellement.

Le rôle `supporter` est le rôle initial ordinaire du compte ; il ne compte pas dans le calcul des doubles ou triples fonctions sportives et administratives.

| Fonctions cumulées | Autorisation | Validation requise |
|---|---|---|
| Joueur seul | Oui | Attribution par le club selon les règles d'inscription et d'éligibilité |
| Entraîneur seul | Oui | Validation d'un administrateur pour l'attribution du rôle et des équipes |
| Administrateur seul | Oui | Validation par un administrateur habilité, sauf amorçage initial sécurisé |
| **Joueur + entraîneur** | **Oui** | **Approbation administrative obligatoire** pour le second rôle et ses équipes |
| **Joueur + administrateur** | **Oui** | **Approbation administrative obligatoire** pour le rôle supplémentaire |
| **Entraîneur + administrateur** | **Oui** | **Approbation administrative obligatoire** pour le rôle supplémentaire |
| **Joueur + entraîneur + administrateur** | **Oui** | **Approbation administrative obligatoire** pour chaque ajout de rôle |

**Règle impérative : aucun deuxième ou troisième rôle n'est actif avant la validation d'un administrateur.** Une attribution n'est pas implicite : l'obtention du rôle `admin` n'attribue pas automatiquement le rôle `coach`, et inversement. De même, un joueur promu éducateur conserve son rôle joueur.

### 2.2 Demandes, décisions et historique

1. L'utilisateur ou un administrateur propose l'ajout d'un rôle via une demande. Le rôle demandé reste inactif tant qu'il n'a pas été approuvé.
2. La demande porte sur **une fonction précise** (`player`, `coach` ou `admin`). Si elle concerne `coach`, les équipes concernées doivent être définies et autorisées séparément.
3. Un administrateur existant, connecté avec MFA **AAL2**, examine le rôle actuel, l'équipe, les permissions et les éventuels conflits d'intérêts.
4. L'administrateur peut **approuver** ou **refuser**. Le demandeur **ne peut jamais approuver sa propre demande**, même s'il possède déjà un rôle administrateur.
5. Chaque approbation produit une attribution de rôle identifiant le bénéficiaire, l'administrateur validateur et la date, ainsi qu'un événement dans un journal d'audit privé.
6. Chaque refus ou retrait est journalisé. La révocation d'une seule fonction laisse les autres intactes. La révocation `coach` désactive également ses affectations d'équipes.
7. Pour accorder **`admin`**, la validation d'un administrateur **distinct du bénéficiaire** est obligatoire avec MFA AAL2. Le premier administrateur doit être créé via une procédure initiale sécurisée et explicitement auditée, jamais par auto-promotion.
8. Une demande en attente n'ouvre **aucune permission**. Deux demandes identiques en attente doivent être regroupées ou rejetées pour éviter les doublons.
9. Il n'est jamais permis de contourner l'approbation au moyen de métadonnées client, d'un formulaire public, d'un paramètre d'URL ou d'un simple changement d'interface.

Aucune élévation n'est automatique selon l'ancienneté, l'adhésion Premium ou la possession d'un autre rôle.

### 2.3 Permissions effectives en cas de cumul

Les droits sont la combinaison des **rôles effectivement approuvés**, dans les limites de chaque opération :
- **Joueur :** voit **ses propres** convocations, réponses et données personnelles autorisées ; ne peut pas lire celles des coéquipiers.
- **Entraîneur :** prépare les matchs et gère les informations des **équipes explicitement affectées**, sans accès aux autres équipes. La publication et la consultation d'informations privées sont soumises aux règles prévues pour leur fonction.
- **Administrateur :** peut administrer les ressources autorisées du club après MFA **AAL2**, conformément au contrôle serveur et à l'audit ; tous les administrateurs habilités ont les mêmes droits d'administration.
- **Joueur + entraîneur :** possède ses droits personnels de joueur **et** ses droits d'éducateur sur les équipes autorisées.
- **Entraîneur + administrateur :** possède les droits éducateur et les droits administrateur ; **les opérations administratives requièrent toujours MFA AAL2**, même si l'utilisateur est aussi éducateur.
- **Triple rôle :** l'utilisateur peut accéder aux trois espaces fonctionnels ; l'application n'affiche que les données pertinentes pour l'espace courant, et chaque requête serveur vérifie son droit propre.

Le choix d'un onglet « Joueur », « Entraîneur » ou « Administration » améliore l'ergonomie mais **ne confère aucun droit**. Un éducateur également joueur ne peut pas se servir de sa fonction éducateur pour accéder à des données sans lien avec son équipe.

### 2.4 Écrans attendus

Dans **Mon espace**, après connexion sécurisée :
- Afficher tous les rôles réellement accordés, sans en masquer un lorsqu'un autre existe.
- Permettre de choisir un contexte de navigation : Joueur, Entraîneur, Administration (selon les rôles validés).
- Montrer les demandes supplémentaires **en attente / approuvées / refusées**, sans rendre les rôles en attente actifs.
- Proposer une demande de rôle supplémentaire et, pour l'entraînement, d'affectation à une équipe. Les demandes ne comportent aucune donnée sensible inutile.

Dans le **Control Center**, après connexion administrateur MFA AAL2 :
- Examiner les demandes de deuxième ou troisième rôle, l'utilisateur concerné et les équipes proposées.
- Approuver/refuser une demande avec date, identité du validateur et justification administrative minimale.
- Consulter et révoquer les rôles **indépendamment**, consulter l'historique, et suivre les affectations éducateur-équipe.
- Ne jamais proposer un bouton d'auto-approbation ; empêcher la suppression ou la révocation de l'ultime compte administrateur actif sans procédure de continuité sécurisée.

## 3. Données et architecture Supabase

**État existant vérifié au 21 octobre 2026 :**
- `public.user_roles` possède une clé primaire composée **(`user_id`, `role`)**, ce qui permet déjà plusieurs rôles pour le même utilisateur.
- Les rôles existants sont `supporter`, `player`, `coach` et `admin`. Aucun `UNIQUE (user_id)` ne limite le cumul.
- Les visiteurs et les comptes `authenticated` **n'ont aucun droit d'ajout, de modification ou de suppression** dans `user_roles` via l'API client.
- Le rôle `supporter` est seul ajouté automatiquement à l'inscription.
- `public.staff_team_assignments` représente l'affectation d'un entraîneur à une ou plusieurs équipes.
- `app_private.is_admin()` exige à la fois le rôle `admin` **et un JWT MFA de niveau AAL2**.
- Les fonctions serveur de publication vérifient déjà le rôle `coach` avec ses affectations, ou un administrateur MFA AAL2 selon l'opération.

**Travail à développer (NON encore activé) :**
- Table de demandes d'ajout de rôle, avec états contrôlés `pending`, `approved`, `rejected`, `cancelled` et traçabilité du validateur.
- API / fonction serveur d'approbation et de révocation : transactions atomiques, validation du rôle administrateur et MFA AAL2, refus de l'auto-approbation et journalisation.
- Séparer la **validation d'un rôle entraîneur** de la validation de **ses affectations par équipe** ; aucun accès transversal implicite.
- Fonctions de récupération des rôles et demandes du seul titulaire ou d'un administrateur habilité.
- Gestion des droits dans les interfaces après homologation de l'authentification et des parcours réels.
- Procédure d'amorçage du premier administrateur et de récupération administrative, hors libre-service.

La lecture du rôle dans le navigateur sert uniquement à l'affichage : **Supabase/PostgreSQL doit autoriser ou refuser chaque écriture**.

## 4. Sécurité, confidentialité et conformité

- Aucun rôle supplémentaire obtenu sans approbation administrateur explicitement enregistrée.
- Aucun formulaire public ne doit écrire directement `user_roles`, `staff_team_assignments` ou les journaux privés.
- MFA AAL2 obligatoire pour l'administration des permissions et les autres tâches d'administration.
- Journal d'audit non modifiable par les comptes ordinaires ; horodatage, rôle, cible et validateur conservés avec accès restreint.
- Protection renforcée des données des joueurs, particulièrement des mineurs ; données minimisées, droits d'accès limités, durée de conservation définie avant mise en service.
- Les comptes mixtes ne rendent **jamais** publiques des convocations, coordonnées ou informations sportives privées.
- Toutes les demandes et décisions doivent être testées contre les courses concurrentes, la modification du bénéficiaire et l'auto-approbation.
- `Premium` est un abonnement commercial distinct, **jamais un rôle administrativement auto-attribué**. Les paiements LIVE restent inactifs jusqu'à validation expresse.

## 5. Critères de recette obligatoires sur le cumul

- [ ] Un joueur existant demande `coach` : il reste joueur, et aucun droit coach n'apparaît avant approbation AAL2.
- [ ] Un administrateur habilité **distinct** approuve : l'utilisateur garde son rôle joueur et obtient coach uniquement sur ses équipes autorisées.
- [ ] Un éducateur demande `admin` : les permissions admin restent refusées en attendant la décision ; après approbation elles exigent encore MFA AAL2.
- [ ] Une personne peut posséder simultanément `player`, `coach` et `admin` sans perdre ses anciennes fonctions.
- [ ] Un joueur + admin est possible après approbation explicite.
- [ ] Un compte triple rôle peut consulter **ses** convocations et gérer **ses** équipes, mais pas celles d'un autre joueur ou d'une autre équipe sans autorisation.
- [ ] Un administrateur ne peut pas approuver sa propre demande, et un non-admin ne peut approuver aucune demande.
- [ ] Une demande rejetée ou en attente ne crée aucune ligne de rôle active.
- [ ] La révocation de `coach` conserve `player` et `admin`, mais retire les affectations coach concernées.
- [ ] L'attribution `admin` ne dispense jamais de MFA AAL2.
- [ ] Les événements de demande, validation, refus et retrait apparaissent dans le journal d'audit réservé aux administrateurs.

## 6. État d'avancement et limites de la préversion

Le schéma de rôles cumulables et les protections contre l'auto-attribution existent déjà dans Supabase. **Le système de demandes et d'approbations des doubles/triples rôles est un critère fonctionnel nouvellement ajouté : il doit encore être développé et validé.**

L'authentification publique est désactivée sur GitHub Pages. Le Control Center reste un **aperçu sans opération réelle**. Aucune promotion, rôle ou affiliation d'utilisateur n'est créée par le présent cahier des charges.

## 7. Gouvernance et validation

Les décisions fonctionnelles ci-dessus s'appliquent à toutes les étapes ultérieures : inscription, Control Center, convocations, médias, statistiques et publications. Les documents [Décisions produit](DECISIONS.md), [Plan de développement](PLAN_DEVELOPPEMENT.md), [Étape 3 Auth](ETAPE_3_AUTH.md) et [Étape 7 Control Center](ETAPE_7_CONTROL_CENTER.md) renvoient à cette version canonique.

La recette globale demeure soumise au seuil pondéré de 85 % **et** à l'absence de défaut critique de sécurité. La mise en ligne de l'interface de prévisualisation n'équivaut pas à l'activation des droits administratifs.
