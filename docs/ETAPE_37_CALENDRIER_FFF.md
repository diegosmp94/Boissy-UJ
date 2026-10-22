# Étape 37 — Calendrier exportable et préparation d'un connecteur FFF autorisé

**Date : 22 octobre 2026 — statut : export iCalendar fonctionnel ; API FFF NON CONNECTÉE.**

## Livré sur la branche

- La page **Agenda** rassemble les matchs et événements déjà publiés par le club. L'export **.ics** reprend les filtres actifs (catégorie, période, recherche), inclut date, lieu et libellé, et exclut les brouillons, matchs annulés et événements privés/Premium.
- L'export fonctionne dans le navigateur, sans inscription, clé secrète, accès au registre des membres ni écriture Supabase. En absence de date, aucun fichier vide n'est présenté comme calendrier officiel.
- Les lignes iCalendar sont échappées et pliées à 75 octets maximum, y compris pour les caractères accentués. Les dates sont exportées en UTC.
- Le public dispose d'un lien vers [le portail officiel des compétitions](https://epreuves.fff.fr/) pour consulter directement les sources FFF.
- Le Control Center présente aux **administrateurs AAL2** un panneau « Connecteur FFF — préparation » : lecture et validation locale d'un JSON de contrat partenaire **futur**, sans appel réseau et surtout sans publication automatique, import ni synchronisation.
- L'adaptateur `fff-provider.mjs` vérifie une forme versionnée, les cinq codes d'équipes, les identifiants uniques des rencontres, scores/statuts cohérents et une référence HTTPS sur les seuls domaines officiels autorisés. Il refuse les données privées supplémentaires et les autres clubs.

## Donnée d'affiliation vérifiée

Le numéro d'affiliation **BOISSY U.J. = 548423** figure dans les publications du [District du Val-de-Marne (FFF)](https://districtvaldemarne.fff.fr/wp-content/uploads/sites/99/bsk-pdf-manager/6502280be39c2350576a2e6886e7d64c.pdf). **Ne pas confondre** avec *Football Club de Boissy 91* ou un autre club homonyme.

Les codes applicatifs conservés sont :

| Code | Discipline | Libellé affiché |
| --- | --- | --- |
| a | Football | Seniors A |
| b | Football | Seniors B |
| c | Football | Seniors C (amicaux) |
| veterans | Football | Vétérans |
| futsal | Futsal | Senior |

**Le code et la désignation des équipes ne constituent pas un identifiant officiel de compétition FFF.** Il faut obtenir les identifiants correspondants dans un futur contrat d'API autorisé. Ne pas inventer les numéros des compétitions, poules, journées ou équipes.

## Pourquoi l'API FFF n'est pas branchée en direct

Le [forum TeamOpenData (message du 21 octobre 2026)](https://teamopendata.org/t/api-de-la-fff-changee-et-impossibilite-dacceder-a-certaines-donnees/4501/92) relaie une réponse de la FFF : les anciennes routes utilisées par des développeurs ne sont pas une API publique destinée aux clubs et leur retrait est prévu ; une solution de diffusion pérenne serait à l'étude. Cela ne vaut **ni documentation contractuelle, ni accord d'utilisation**.

En conséquence, cette étape ne cherche **pas** à contourner les protections des sites FFF et ne fait aucune requête vers les endpoints DOFA ou les API internes du portail. Aucune clé d'accès ne figure dans les fichiers du site statique.

## Activation future de la synchronisation après accord de la FFF

1. Demander à la FFF ou au District du Val-de-Marne un dispositif **écrit** autorisant Boissy U.J. à exploiter calendriers, résultats, mises à jour et identifiants, avec documentation du format et limites d'appel. Vérifier les droits de republication et d'attribution.
2. Consigner les IDs officiels du club, de chaque équipe/engagement, des compétitions et poules ; confirmer les équivalences avec les cinq codes du club.
3. Installer le connecteur **côté serveur uniquement** (Supabase Edge Function ou autre service backend) : secret stocké hors dépôt, domaine/chemin autorisé fixé côté serveur, limitation de fréquence, timeout, retries bornés, journalisation sans identités privées, et contrôle des données reçues.
4. Adapter la forme réelle documentée au modèle `fff-provider.mjs`, tester les reports, forfaits, annulations, scores homologués, dates et fuseaux, conflits avec la saisie manuelle, et duplications.
5. Préparer les changements dans un **espace privé de prévisualisation** pour validation par un administrateur AAL2. Ne pas écraser les rencontres manuelles, publier automatiquement ni afficher « FFF officiel » avant vérification.
6. Exécuter une recette multi-équipes et un audit des autorisations sur un environnement isolé, puis activer seulement après accord explicite de l'association.

## Ce qui reste hors du périmètre validé

Aucun accès API partenaire FFF accordé, aucune synchronisation en arrière-plan, aucune publication automatiquement officialisée, aucun classement ou résultat inventé. Les paiements LIVE restent désactivés et le site reste `noindex`.

**La préparation technique d'un adaptateur ne doit pas être comptabilisée comme une intégration API homologuée.**
