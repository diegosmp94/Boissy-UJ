# Étape 6 — Catalogue public des événements Boissy-UJ

> **Mise à jour du 21 octobre 2026 :** les migrations Supabase correspondantes sont appliquées selon l'[état vérifié](ETAT_SUPABASE_20261021.md). L'authentification standard est disponible ; les mutations d'administration restent protégées et nécessitent une recette réelle.


**Statut actuel :** catalogue public en lecture seule et modèle Supabase installés selon l'[état vérifié de la base](ETAT_SUPABASE_20261021.md). L'éditeur d'événements gratuits administrateur est décrit à l'[étape 29](ETAPE_29_ADMIN_EVENEMENTS.md) ; son affichage dépend de la présence des RPC requises et d'une session AAL2 vérifiée. Le site Pages ne fournit toujours aucune billetterie ni paiement.

## Fonctionnalités livrées dans le code
- Page Événements : filtrage par période (à venir, passés, tous) et catégorie, recherche sans tenir compte des accents.
- Cartes lisibles sur ordinateur et mobile avec date/heure Europe-Paris, lieu annoncé, description et prix public.
- Mention d'un tarif Premium ou de la priorité Premium uniquement si ces informations ont été renseignées explicitement.
- Affichage clair de l'absence de réservation en ligne : aucun bouton de paiement fictif, aucune collecte de coordonnées.
- Aucune fausse rencontre ni aucun événement inventé ; mode de repli si la source de données n'est pas installée.
- Les données externes sont injectées via `textContent` (pas `innerHTML`) et la requête est annulée lors du changement de page.
- Le schéma de base limite l'API anonyme aux **événements publics publiés** ; un compte authentifié n'accède pas automatiquement aux événements Premium.

## Modèle de données installé
`supabase/migrations/202610210005_events_catalog_v1.sql` :
- événements publics ou exclusifs Premium ;
- gratuits ou payants, avec éventuel prix Premium inférieur ou égal au prix normal ;
- capacité et statut des réservations ;
- fenêtre de priorité Premium configurable, **sans durée prédéfinie** ;
- date et heure de début ET fin requises avant publication ;
- règles RLS : lecture publique uniquement des événements publiés et explicitement publics ; aucune écriture directe depuis le navigateur.

Le statut des fonctions d'administration doit être vérifié dans la documentation de l'étape 29 et sur l'instance avant utilisation. La création de réservation, les paiements et les billets restent hors service.

## Prochaine tranche : billetterie sécurisée (NON réalisée)
1. Vérification serveur de la session, de la majorité/autorisations responsables légaux le cas échéant, des droits Premium et du tarif affiché.
2. Réservation atomique transactionnelle contre les doublons et les dépassements de capacité ; compteur issu des billets actifs et non du navigateur.
3. Priorité Premium pendant la fenêtre renseignée par l'association ; durée à confirmer.
4. Paiements dans **Stripe TEST** seulement après validation juridique et technique, webhook signé, traitement idempotent et états de paiement cohérents.
5. Génération de billets QR aléatoires et révocables côté serveur, pas de secret prévisible dans l'URL.
6. Liste d'attente, remboursements/annulations, notifications et exports avec contrôles RGPD et audit.
7. Accès Premium réservé aux personnes éligibles, sans jamais fonder les droits sur la seule interface.
8. Scénarios de tests : réservations concurrentes, rupture de capacité, doublons, paiements refusés, remboursements, réservations gratuites, retours d'événements.

## Critères de sortie du lot
- Tests automatisés GitHub réussis.
- Branche fusionnée dans `main`, GitHub Pages déployé.
- Contrôles manuels Safari iOS / Android / bureau à effectuer lors de la recette globale.
- **Aucune vente de billets ouverte au public** tant que la conformité et le flux financier n'ont pas été approuvés.

Les tarifs Premium mensuel/annuel restent inchangés : 10 €/mois et 100 €/12 mois sans renouvellement annuel automatique.
