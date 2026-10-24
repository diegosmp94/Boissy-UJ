# Répartition des joueurs par poste et numéros — Boissy UJ

**24 octobre 2026 — 5 équipes, quatre catégories, gestion privée des affiliations.**

## Lecture publique (chaque page Équipes → Joueurs)

Les joueurs dont la **fiche publique** a été explicitement autorisée et publiée sont séparés sous les titres :
1. Gardiens
2. Défenseurs
3. Milieux
4. Attaquants

Les cartes conservent la disposition déjà validée : emplacement portrait sans visage inventé, numéro doré sur la photo, prénom/nom sous la carte, lien vers une fiche individuelle. Le regroupement utilise `team_public_people.role_label` déjà présent, en reconnaissant ses variantes (« Défenseur central », « Milieu offensif », « Ailier »...). Une ancienne fiche publiée au poste non reconnu est placée dans **À classer** pour éviter de masquer un joueur réel, et non classée arbitrairement.

**Attention :** il y a deux catalogues distincts : les comptes et affiliations *privés* et les fiches publiques *approuvées*. Aucun nom affilié n'est révélé automatiquement. Les futurs portraits devront être validés par le club, y compris les droits à l'image des mineurs.

## Gestion privée pour éducateurs et administrateurs

Sur chacune des cinq pages Joueurs, l'accordéon « Gérer les joueurs affiliés (administrateur / éducateur) » n'effectue **aucune lecture privée avant l'action du visiteur**.

Après vérification Supabase :
- L'**administrateur** avec MFA AAL2, ou un **éducateur** ayant le rôle coach approuvé et une affectation active à **cette équipe**, peut consulter la liste minimale des **joueurs ayant déjà le rôle Joueur et une affiliation active à cette équipe**.
- Il sélectionne un joueur existant, sa catégorie et un numéro entre **1 et 99**.
- Une contrainte SQL **interdit les numéros en double dans une même équipe**, même en cas de requêtes simultanées. Un contrôle client affiche une erreur lisible.
- Il peut actualiser et rééditer les affectations. L'édition vérifie la version précédente pour éviter les écrasements silencieux.
- Chaque changement est journalisé (identifiants des acteurs, joueur, équipe, ancienne et nouvelle catégorie/numéro). Aucun e-mail, numéro de licence, naissance ou contact n'est lu.
- Il **ne peut pas attribuer le rôle Joueur ni rattacher un compte** à une équipe : cette prérogative est réservée à l'administrateur via « Administration → Affectations joueurs », déjà existant.
- Le formulaire **n'autorise aucune publication** de noms ou de photos : l'administration doit toujours vérifier les accords et publier les fiches publiques via son module « Effectifs publics ».

## SQL à déployer

`supabase/migrations/202610240002_staff_team_player_positions.sql`

Migration additive : création de `app_private.team_player_positions`, `app_private.team_player_position_audit`, des deux RPC `staff_list_affiliated_players` et `staff_set_affiliated_player_position`.

Sécurité : RLS, aucun grant direct, `EXECUTE` interdit à `anon`/`PUBLIC`, authentification Supabase, vérification serveur admin AAL2 **ou** coach + équipe active, contrôle actif du rôle joueur et de l'affiliation, contrainte de numéro unique, journalisation. Les données ne sont **jamais copiées** dans `team_public_people` automatiquement.

## Dépendances non homologuées

Au contrôle préalable, **aucune affiliation joueur active, aucune affectation éducateur active et aucune fiche publique publiée n'étaient renseignées** dans le projet Supabase connecté. La structure sera donc vide jusqu'à ce qu'un administrateur affecte de vrais comptes Joueur et de vrais éducateurs avec approbation. Ne pas créer d'identités fictives ou importer des données personnelles sans autorisation.

La recette multi-comptes sur une base isolée reste requise : essayer admin AAL1 (refus), admin AAL2 (accepté), coach affecté à équipe A (accepté uniquement A), coach non affecté (refus), joueur simple (refus), membre supprimé/désaffilié (refus), deux joueurs avec numéro identique (refus), perte d'accès pendant la session (refus). Confirmer que l'attribution privée n'entraîne aucune apparition dans le catalogue public.

## Ce qui est prêt et ce qui manque

- **Frontend** : quatre groupes et formulaire privé pour les joueurs affiliés.
- **Backend** : migration SQL et RPC préparés dans GitHub ; la mise en production exige contrôle CI et installation SQL.
- **Publication** : toujours sur demande et contrôle du club. Aucun consentement supposé ni visage inventé.
