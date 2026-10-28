# Fonctions nominatives des administrateurs Boissy-UJ

Cette rubrique distincte de **Membres et rôles** permet aux administrateurs validés et authentifiés avec **MFA AAL2** de créer un catalogue de fonctions selon le choix du club, puis de les attribuer nominativement aux seuls comptes ayant déjà le rôle technique `admin`.

## Fonctionnement

Dans **Centre de gestion → Pilotage → Fonctions et titres des dirigeants** :
1. Créer un intitulé libre, par exemple « Président », « Directeur sportif », « Responsable administratif » ou « Dirigeant ». Aucun titre ni titulaire n'est prérempli.
2. Facultativement cocher **Un seul titulaire possible** pour les fonctions uniques (comme « Président »). Le backend sérialise l'attribution pour bloquer deux titulaires simultanés.
3. Choisir un administrateur présent dans le registre sécurisé, puis confirmer l'attribution.
4. Retirer un titre avec double confirmation, ou modifier/désactiver un intitulé après retrait de ses titulaires.

Dans **Mon espace**, un administrateur voit ses propres fonctions nominatives : le nom précis de la fonction, sans lister les autres membres.

## Sécurité et limites

- **Rôle technique vs titre nominatif :** ce sont deux catégories distinctes. Aucun changement de titre n'accorde `admin`, `coach`, `player`, un accès à des données privées ni une permission financière. Un Président peut être administrateur sans obtenir de droits supplémentaires par son seul intitulé.
- **Écritures et lectures privées :** les tables `app_private.club_office_titles`, `club_office_assignments`, `club_office_audit` ont RLS activé et aucun privilège de lecture/écriture direct depuis les navigateurs. Les RPC d'administration sont exécutables uniquement par `authenticated`, mais vérifient **réellement** le rôle `admin` et le niveau MFA AAL2 dans la base à chaque invocation.
- **Revue et traçabilité :** toutes les modifications et retraits sont journalisés, avec auteur, cible et intitulé. Le retrait du rôle technique admin supprime automatiquement les nominations correspondantes.
- **Données personnelles :** les identités affichées sont limitées aux administrateurs effectivement validés et uniquement dans le Centre de gestion protégé. Rien n'est publié automatiquement sur les pages publiques.
- **Gestion :** les administrateurs possédant le rôle technique `admin` et le MFA AAL2 peuvent gérer ce catalogue. Une délégation exclusive au Président exigerait un second niveau de permissions distinct, qui n'est pas ajouté ici.
- **Vie associative :** ces titres d'affichage ne remplacent pas la nomination officielle des dirigeants prévue par les statuts de l'association ou ses décisions internes.

## Validation

Migration : `supabase/migrations/202610280001_admin_custom_official_titles.sql`.
Frontend : `admin-office-titles.mjs` et `admin-office-titles-rules.mjs`.
Tests : `tests/official-admin-titles.test.mjs` + suite globale du site.

La publication de l'interface dans GitHub ne suffit pas : la migration doit également avoir été appliquée sur le projet Supabase Boissy-UJ. Aucune identité de Président ou Directeur sportif n'est créée sans intervention explicite du club.
