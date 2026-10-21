# Étape 6 — Catalogue public des événements Boissy-UJ

> **Mise à jour du 21 octobre 2026 : les migrations Supabase correspondantes sont maintenant APPLIQUÉES.** Les mentions ci-dessous indiquant « non appliquée » ou « en attente d’autorisation » sont l’historique des étapes précédentes, et non l’état actuel. Voir [État Supabase vérifié](ETAT_SUPABASE_20261021.md). Les écritures réelles et l’authentification publique restent désactivées jusqu’aux essais fonctionnels.


**Statut : interface réalisée, migration SQL écrite mais NON appliquée.** Le dépôt GitHub Pages reste une préversion statique.

## Fonctionnalités livrées dans le code
- Page Événements : filtrage par période (à venir, passés, tous) et catégorie, recherche sans tenir compte des accents.
- Cartes lisibles sur ordinateur et mobile avec date/heure Europe-Paris, lieu annoncé, description et prix public.
- Mention d'un tarif Premium ou de la priorité Premium uniquement si ces informations ont été renseignées explicitement.
- Affichage clair de l'absence de réservation en ligne : aucun bouton de paiement fictif, aucune collecte de coordonnées.
- Aucune fausse rencontre ni aucun événement inventé ; mode de repli si la source de données n'est pas installée.
- Les données externes sont injectées via `textContent` (pas `innerHTML`) et la requête est annulée lors du changement de page.
- Le schéma de base limite l'API anonyme aux **événements publics publiés** ; un compte authentifié n'accède pas automatiquement aux événements Premium.

## Préparation du modèle (migration en attente)
`supabase/migrations/202610210005_events_catalog_v1.sql` :
- événements publics ou exclusifs Premium ;
- gratuits ou payants, avec éventuel prix Premium inférieur ou égal au prix normal ;
- capacité et statut des réservations ;
- fenêtre de priorité Premium configurable, **sans durée prédéfinie** ;
- date et heure de début ET fin requises avant publication ;
- règles RLS : lecture publique uniquement des événements publiés et explicitement publics ; aucune écriture directe depuis le navigateur.

La migration n'est pas appliquée à Supabase. Toute application attend une nouvelle autorisation de l'utilisateur.

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
