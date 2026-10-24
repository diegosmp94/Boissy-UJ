# Éducateurs — cinquième rubrique de l'effectif public

**24 octobre 2026 · Boissy UJ · Les cinq équipes**

## Navigation sportive

Chaque page **Équipes → [équipe] → Joueurs** et chaque fiche de présentation de l'équipe affiche, dans cet ordre :
1. Gardiens
2. Défenseurs
3. Milieux
4. Attaquants
5. **Éducateurs**

Une ancienne fiche de joueur publiée sans position reconnue reste visible ensuite dans **À classer**, sans être arbitrairement affectée à l'une des quatre lignes.

Les éducateurs sont les profils publics `person_kind=coach` et le personnel `person_kind=staff` dont la fonction correspond réellement à de l'encadrement sportif (adjoint, préparateur physique, éducateur). Les autres personnes du staff restent dans la section **Encadrement**, uniquement sur la présentation générale, lorsqu'il y en a. Pas de doublon entre ces deux rubriques.

Chaque carte Éducateur montre un **portrait en silhouette neutre**, un **prénom/nom approuvé** et sa **fonction réellement renseignée** (entraîneur principal, adjoint, préparateur…). Il n'y a pas de numéro de maillot pour les éducateurs ni de lien trompeur vers une fiche joueur. Les vraies photos demandent encore un modèle de médias, des fichiers fournis par le club et les autorisations nécessaires ; aucun visage n'est inventé.

## Affectation à une ou plusieurs équipes

Le module administratif déjà présent **Administration → Affectations entraîneurs** permet d'attribuer chaque éducateur à plusieurs équipes : l'affectation est par paire `coach_user_id + team_id`, son changement nécessite le rôle **Administrateur + MFA AAL2** et est journalisé par Supabase. L'éducateur accède ainsi aux outils privés des équipes sur lesquelles il possède une affectation active.

**Attention : une affectation privée ne publie jamais une identité dans le trombinoscope.** Pour être affiché dans **Éducateurs** d'une équipe donnée, son profil public doit être enregistré **pour cette équipe** dans **Administration → Effectifs publics**, avec `person_kind=coach`, une fonction et la validation de la publication (`published=true`, `consent_confirmed=true`). S'il encadre plusieurs équipes, le club publie sa fiche dans chacune de celles qu'il a approuvées. L'utilisateur portant le rôle éducateur n'obtient aucun droit de publication automatique.

## Sécurité et état réel

- Lecture uniquement depuis `public.team_public_people` filtrée par UUID d'équipe, publication et consentement ; aucune lecture de la liste privée des coachs pour fabriquer les cartes publiques.
- Le front utilise `textContent`, pas `innerHTML` pour les noms et fonctions.
- Aucune écriture SQL ni modification de l'authentification ou des contrôles RLS dans ce correctif.
- Le projet ne contenait aucune fiche publique publiée lors du dernier contrôle. La section est visible immédiatement et affiche un message explicite jusqu'à l'ajout de profils autorisés.

## Tests

`tests/team-educators-section.test.mjs` : séparation éducateurs/autre encadrement, confidentialité brouillons/consentement, isolation entre équipes, carte accessible, fonction et silhouette réelle, style adaptatif. La suite de tests principale et le parcours navigateur font également partie des conditions de fusion dans `main`.
