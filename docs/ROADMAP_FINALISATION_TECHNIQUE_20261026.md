# Boissy UJ — Feuille de route de finalisation technique

**Date de cadrage : 26 octobre 2026** · **Référence : cahier des charges V1.5** · **Point de départ : `main` au commit `e313b5f` (PR #124)**

## Périmètre et méthode

Cette feuille de route porte **uniquement sur les développements manquants** du front-end, du back-end, de Supabase, des interfaces et des intégrations, et sur leur raccordement effectif. Elle **n'inclut pas d'étapes de saisie de contenus par le club ou ses utilisateurs, ni de campagne de tests/homologation**.

Sont donc exclus du décompte : créer les saisons et les scores réels ; rédiger des actualités ; renseigner les effectifs, photos et événements ; produire les textes juridiques ; obtenir des consentements ou validations métier ; réaliser les essais multi-comptes/Safari/Android, les restaurations réelles et les homologations administratives ; obtenir les identifiants ou autorisations d'un partenaire FFF. Le développement des **outils qui permettront ces actions**, lui, reste inclus.

Les contrôles automatiques déjà configurés sur les PR demeurent des garde-fous de livraison, **pas des étapes autonomes** ni une homologation. Une migration risquée, la facturation ou le traitement de données privées n'est pas activé en production simplement parce que son code est terminé. Les fonctionnalités peuvent être déclarées **techniquement achevées et fermées par un drapeau** en attente de décisions du club.

### Déjà réalisé : ne pas refaire

Accueil en huit chapitres et identité bleu nuit/doré ; navigation responsive et fiches des cinq équipes (dont « Senior » en futsal) ; principaux écrans Match Center/Championnat/Coupe, agenda, prochain match et félicitations ; inscription/connexion et parcours de récupération ; rôles joueur, entraîneur, administrateur cumulables avec approbation MFA AAL2 ; affectations multi-équipes, convocations, éditeurs administratifs, tableaux de préparation ; outils de publication et CI/GitHub Pages. Réutiliser ces modules avant d'en ajouter de nouveaux.

## Réalisation en cours de la feuille de route

- **Étape 66 — livrée en code le 26 octobre 2026** : [inventaire de l'état du schéma de production et du code](ETAPE_66_INVENTAIRE_CAPACITES_20261026.md), outil `npm run audit:features`, instantané horodaté et absence d'activation des six modules avancés. L'inventaire atteste la présence des objets, **pas** l'homologation ni la validité des migrations préparées.
- **Étape 67 — développée et appliquée sur Supabase le 26 octobre 2026** : [revue détaillée des 30 RPC et deuxième migration de verrouillage](ETAPE_67_AUDIT_GLOBAL_RPC_20261026.md) ; premier lot [convocations](ETAPE_67_DURCISSEMENT_RPC_CONVOCATIONS_20261026.md). L'homologation des droits par plusieurs comptes réels reste distincte.
- **Étape 68 — développement réalisé et migration vérifiée le 26 octobre 2026** : [annulation atomique des demandes obsolètes, rôles préservés, revalidation des espaces privés](ETAPE_68_COHERENCE_ROLES_20261026.md). Les essais réels multi-comptes restent hors de ce décompte.
- **Étape 69 — développement livré et contrôles automatiques validés le 26 octobre 2026** : [Control Center résilient](ETAPE_69_CONTROL_CENTER_RESILIENCE_20261026.md), lecture MFA bornée, sondes de modules optionnels indépendantes, actualisation sécurisée et reprise accessible sur panne réseau. Aucune migration ni donnée du club ajoutée ; la recette humaine reste séparée.
- **Étape 70 — développée et migration Supabase appliquée le 26 octobre 2026** : [cycle des saisons, archivage et reconduction manuelle](ETAPE_70_CYCLE_SAISONS_20261026.md). Deux déclencheurs et deux RPC vérifiés en base ; aucune saison ni résultat réel créé. Les saisies et homologations du club restent séparées.
- **Étape 71 — développement réalisé et migration Supabase vérifiée le 26 octobre 2026** : [édition atomique des résultats et des compétitions](ETAPE_71_MATCHS_COMPETITIONS_20261026.md) ; nouvelle RPC MFA AAL2 et déclencheur différé confirmés dans le schéma réel, aucun match ou score inventé. Les tests utilisateurs restent séparés.
- **Étape 72 — développée et migration Supabase vérifiée le 26 octobre 2026** : [statistiques par saison et compétition issues uniquement des matchs publiés, classement de poule distinct et protégé](ETAPE_72_STATS_CLASSEMENTS_20261026.md). Vue `security_invoker`, contraintes de publication et RLS contrôlés, aucun match ou classement inventé. Recettes humaines distinctes.
- **Étape 73 — livrée sur `main`, migration vérifiée** : [affiliations multi-équipes et historique privé](ETAPE_73_EFFECTIFS_AFFECTATIONS_20261026.md). Aucun joueur ou numéro inventé.
- **Étape 74 — développée et migration Supabase vérifiée le 26 octobre 2026** : [feuilles de match privées, réponses des joueurs et contrôle des rencontres clôturées](ETAPE_74_CONVOCATIONS_FEUILLES_MATCH_20261026.md). Trois RPC contrôlées en production, zéro match ou convocation inventé. Homologation multi-comptes séparée.
- **Étape 75 — implémentée et CI validée le 26 octobre 2026** : [catalogue sportif public harmonisé entre accueil, Match Center, agenda et fiches équipes](ETAPE_75_SYNCHRO_SPORT_PUBLIC_20261026.md). Reports/annulations cohérents, rafraîchissement horaire et après reprise d'onglet ; aucun match ou score inventé. Recette utilisateurs et homologation sportive à part.
- **Étape 76 — code vérifié et migration Supabase appliquée le 26 octobre 2026** : [historique des articles, restauration en brouillon et sauvegarde éditoriale contrôlée par version](ETAPE_76_ACTUALITES_VERSIONS_20261026.md). Quatre RPC AAL2 vérifiées en production, journal des actualités générales corrigé, 20/20 tables publiques sous RLS ; aucun article ou média créé. Recette humaine exclue.
- **Étape 77 — code vérifié et migration Supabase appliquée le 26 octobre 2026** : [réactions « J’aime » privées par membre sur les articles publiés](ETAPE_77_REACTIONS_ACTUALITES_20261026.md), politiques RLS, verrous de publication et suppression à la dépublication vérifiés en production. 21/21 tables publiques sous RLS, aucun article ou J’aime réel créé ; recette humaine séparée.
- **Étape 78 — terminée, déployée et vérifiée le 26 octobre 2026** : [stockage privé, URL signées et validations](ETAPE_78_MEDIAS_PRIVES_20261026.md), puis [invalidation à la dépublication et signature limitée](ETAPE_78_MEDIAS_DROITS_20261026.md). Bucket privé, 22/22 tables publiques sous RLS, aucun objet créé.
- **Étape 79 — code testé et politique Supabase appliquée le 26 octobre 2026** : [dépôt privé par administrateur MFA AAL2, vérification MIME/signature, réservation invisible, limite de 12 médias/article et approbation éditoriale indépendante](ETAPE_79_DEPOT_MEDIAS_PRIVES_20261026.md). Bucket privé vérifié, 22/22 tables publiques sous RLS, aucun objet réel ajouté. Recette humaine séparée.

## Lot A — Sécuriser et consolider le socle existant (P0)

| Étape | Livraison de développement | Condition de clôture technique |
|---|---|---|
| **66** | **Inventaire fonctionnel exécutable et schéma réel** : cartographier modules, fonctions Supabase, migrations appliquées/non appliquées et drapeaux d'activation ; éviter les écrans promettant un service absent. | Matrice code↔DB↔interface raccordée ; états « disponible », « désactivé » et « dépendance absente » explicites. |
| **67** | **Autorisation serveur homogène** : réduire la surface des RPC `SECURITY DEFINER`, contrôler `EXECUTE`, `auth.uid()`, MFA AAL2, scopes d'équipes et opérations concurrentes sans casser les parcours existants. | Chacun des endpoints sensibles possède sa garde explicite et sa trace minimale ; aucune élévation par simple rôle client. |
| **68** | **Gestion des rôles et affectations sans rupture** : unifier approbation/refus, retrait indépendant, cumul joueur+coach+admin, invalidation d'écran après révocation, interdiction de l'auto-approbation. | Flux membre/admin cohérent et réutilisant les RPC existantes, avec maintien des autres rôles. |
| **69** | **Control Center fiable** : harmoniser les erreurs réseau, le contrôle de fraîcheur MFA, la navigation entre modules, le rafraîchissement et la consultation sécurisée des opérations d'administration. | Les modules existants se montent sans exposer d'anciennes données privées et proposent un état d'erreur exploitable. |

## Lot B — Terminer les outils sportifs (P1)

| Étape | Livraison de développement | Condition de clôture technique |
|---|---|---|
| **70** | **Cycle de vie des saisons** : création, modification, clôture, archivage, reconduction des paramètres d'équipes sans copier implicitement des données privées ou des résultats. | Éditeur de saisons complet et historiques conservés. |
| **71** | **Éditeur des rencontres unifié** : Championnat/Coupe/Amical par équipe, report, annulation, forfait, changement d'horaire, score et provenance distincte. | Aucun état de match ne nécessite une modification SQL manuelle pour être géré par un admin autorisé. |
| **72** | **Statistiques et classements fiables** : calculs à partir des seuls résultats publiés et contrôles d'intégrité pour les classements saisis ; séparation stricte des archives de tiers. | Le site ne présente jamais une donnée non validée comme officielle. |
| **73** | **Effectifs et affectations complètes** : postes, numéros de maillot, appartenance à plusieurs équipes autorisées, historique et gestion des conflits de poste/numéro. | Joueurs et entraîneurs ne peuvent éditer que leur propre périmètre sportif. |
| **74** | **Convocations privées de bout en bout** : sélection d'effectif, convocation/annulation, réponse joueur, état visible par le bon entraîneur, retrait de rôle pris en compte. | Aucun membre ne consulte les convocations d'autrui hors droit explicite. |

## Lot C — Terminer publication, réactions et médias (P1/P2)

| Étape | Livraison de développement | Condition de clôture technique |
|---|---|---|
| **75** | **Synchronisation des vues publiques sportives** : accueil, Match Center, agenda, fiches équipe, prochain match et onglets de compétition ; cohérence des mises à jour horaires et après fin d'un match. | Chaque publication sportive autorisée se répercute sans intervention sur plusieurs pages. |
| **76** | **Chaîne éditoriale** : finaliser brouillon, publication, retrait, recherche et historique/restauration en brouillon, en raccordant les RPC déjà préparées. | Flux éditeur complet ; une restauration ne republique pas automatiquement un article. |
| **77** | **Réactions « J'aime »** : intégrer la migration RLS préparée, l'état personnel, ajout/retrait et gestion des réponses concurrentes. | Un membre peut gérer uniquement sa propre réaction, sans accès aux identités d'autres membres. |
| **78** | **Infrastructure médias** : raccordement sûr du bucket Storage, des métadonnées et des états privé/publié, avec protection des fichiers non homologués. | Aucune image ou vidéo privée n'est exposée par simple connaissance d'un chemin. |
| **79** | **Outil d'ajout de photos et vidéos** : interface admin, validations MIME/taille, alternative textuelle, attestation des droits et association à l'article. | L'ajout est contrôlé côté serveur et ne publie pas automatiquement le fichier. |
| **80** | **Retrait et purge des médias** : synchroniser dépublication, révocation de droits, suppression Storage et affichage des galeries ; gérer les erreurs de suppression. | Un retrait de droit ne laisse pas volontairement un fichier dans un bucket public accessible. |
| **81** | **Fiches publiques des personnes** : lier effectifs/encadrement aux fiches joueur et informations publiables seulement après consentement explicite, sans exposer le profil de connexion. | Les espaces publics n'importent pas directement les comptes privés. |

## Lot D — Finaliser le Premium et les finances en environnement TEST (P2)

| Étape | Livraison de développement | Condition de clôture technique |
|---|---|---|
| **82** | **Droits Premium serveur** : finaliser durée de validité, provenance de paiement, expiration/révocation et consultation sécurisée depuis Mon espace. | Aucun simple changement de navigateur n'attribue Premium. |
| **83** | **Stripe Checkout TEST et webhook signé** : raccorder les fonctions déjà écrites au modèle d'abonnement mensuel 10 € / achat unique annuel 100 € non renouvelable. | Attribution uniquement sur événements validés côté serveur, mode TEST seulement. |
| **84** | **Remboursements, litiges et reprise** : réconciliation durable, événements hors ordre, idempotence et suspension ciblée des droits sans casser un autre abonnement valide. | Aucun remboursement/chargeback n'est simplement « ignoré » ou laissé en boucle 503. |
| **85** | **Espace Premium** : statut de l'offre, échéance, annulation du renouvellement mensuel, expiration de l'offre annuelle et messages de support, sans lien de paiement LIVE. | L'utilisateur comprend et gère le cycle de vie de son offre TEST. |
| **86** | **Dons et campagnes** : modèle dons ponctuels/mensuels, fonds général/projets, campagnes ouvertes/fermées et rapprochement TEST côté serveur. | Aucun reçu fiscal automatique, privilège ou transfert réel non autorisé. |

## Lot E — Événements, billets et Awards (P2)

| Étape | Livraison de développement | Condition de clôture technique |
|---|---|---|
| **87** | **Gestion avancée des événements** : capacités, plages de réservation, gratuits/payants, public/Premium, règles de priorité et statuts ; commandes administratives. | Les règles de réservation sont stockées et vérifiées côté serveur, indépendamment du contenu saisi. |
| **88** | **Billetterie gratuite** : terminer la migration transactionnelle préparée et créer l'interface membre de réservation, annulation et récupération de son QR personnel. | Quota et unicité garantis côté serveur ; fonctionnalité fermée tant que non homologuée. |
| **89** | **Contrôle d'entrée QR** : interface de scan administrateur adaptée au mobile, statut billet, refus de double scan, journalisation et reprise après coupure. | Une entrée ne peut être validée qu'une seule fois par un contrôleur autorisé AAL2. |
| **90** | **Billetterie payante TEST** : lier jauges, droits Premium et tarifs réduits/gratuits, paiement signé et émission contrôlée de billets. | Aucun billet payant n'est délivré avant preuve de paiement serveur ; pas de LIVE. |
| **91** | **Awards et votes** : raccorder backend de vote unique Premium, vote/retrait côté membre, dates, clôture et publication des résultats par admin. | Votes privés et résultats publiés uniquement selon le workflow, sans votes ni gagnants préremplis. |

## Lot F — Exploitation technique, confidentialité et lancement (P1/P3)

| Étape | Livraison de développement | Condition de clôture technique |
|---|---|---|
| **92** | **Gestion technique RGPD** : demandes d'accès/rectification/suppression, règles de conservation, contrôle des consentements et effacement coordonné des médias/données, notamment concernant les mineurs. | Les fonctionnalités d'exécution et de suivi existent ; règles juridiques à renseigner par le club. |
| **93** | **Sauvegardes et reprise** : outillage de création/export sécurisé, inventaire et comparaison de restauration ; procédure reproductible sans exposer des données personnelles. | Code et documentation de reprise prêts ; exécution de la restauration réelle hors feuille de route. |
| **94** | **Suivi d'exploitation** : état des services, erreurs anonymisées, événements en échec, alertes de traitements différés et diagnostic réservé à l'administration. | Le club peut détecter un incident sans lire de secrets ni journaliser des données privées. |
| **95** | **Finitions UX et performance** : cohérence mobile/tablette/bureau, focus clavier, lecteur d'écran, réduction des animations, chargements et assets. | Aucun parcours développé ne dépend d'un écran de démonstration ou d'un élément inutilisable. |
| **96** | **Connecteur FFF optionnel** : interface d'import autorisée, rapprochement manuel des équipes/compétitions, validation admin et retour au mode saisie manuelle si la source est absente. | Aucun appel à une source extérieure sans accès ni droit de réutilisation explicitement acquis. |
| **97** | **Préparation SEO et bascules de mise en service** : métadonnées, indexation et drapeaux de fonctions conditionnelles ; `noindex` et désactivation des modules sensibles par défaut. | Une publication technique ne déclenche ni indexation, ni traitement payant/privé sans autorisation. |

## Ordre, dépendances et définition de « développement terminé »

- **32 étapes : n° 66 à 97, en six lots.** Priorité : **A → B/C → D/E → F** ; les étapes sans dépendance forte de B et C peuvent avancer parallèlement.
- Les écrans actuellement présents restent conservés : une étape signifie **terminer et raccorder** le système existant, pas le reconstruire.
- Pour chaque étape : changement de code versionné, éventuellement migration SQL clairement identifiée, garde d'activation, documentation technique courte et fusion dans `main` après les contrôles automatiques habituels. Les recettes métier et saisies de contenu ne sont pas comptabilisées comme étapes.
- **100 % de cette liste = 100 % du développement planifié**, et **non** 100 % d'homologation, d'utilisation réelle des services financiers ou de données officielles saisies.
- Les fonctions impliquant des paiements, des votes, des billets privés ou des médias de mineurs **restent désactivées** en production tant que les conditions légales et de sécurité nécessaires ne sont pas remplies.

**Point de départ suggéré : étape 66 — inventaire exact des migrations et fonctions déjà raccordées**, puis 67 (sécurité des RPC), sans modifier des permissions de production avant d'avoir identifié leur usage réel.
