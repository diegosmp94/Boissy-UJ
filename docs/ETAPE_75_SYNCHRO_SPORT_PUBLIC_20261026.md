# Étape 75 — Synchronisation des vues sportives publiques

**26 octobre 2026 — Développement technique ; aucune rencontre, date, score, classement ni validation sportive fictifs.**

## Audit et problèmes de départ

Le site chargeait les matchs publiés depuis `public.matches` en quatre endroits indépendants, avec des sélections différentes et des limites de **80** (page équipe), **100** (Match Center), **300** (agenda) et **350** (accueil). Ainsi, un match publié pouvait exister dans une rubrique sans apparaître dans une autre lorsqu'une saison remplissait ces seuils.

L'accueil se réactualisait automatiquement toutes les heures, dès le passage d'une heure de coup d'envoi et au retour sur l'onglet. En revanche, les autres rubriques publiques ne contrôlaient pas automatiquement les nouvelles publications après ouverture. L'agenda excluait les matchs `postponed` ou `cancelled` : une référence historique tierce pouvait alors sembler encore programmée. Le Match Center mêlait les annulations aux « prochaines rencontres », et les fiches équipe ne les affichaient pas dans leur historique publié.

## Réalisation

### Catalogue sportif commun

`public-sports-sync.mjs` définit les colonnes, filtres et limite unique **500 rencontres publiées** ; les quatre pages les utilisent. Le frontend lit uniquement `public.matches` via le rôle public et son RLS : `published=eq.true`. Les entrées reçues sont vérifiées pour exclure les brouillons, les dates invalides, les statuts inconnus, les scores incomplets de matchs joués et les doublons d'identifiant. Les données personnelles ne sont jamais dans la projection.

**Important :** 500 est un plafond explicite de la requête, non la garantie d'avoir tous les matchs d'une base devenue plus importante. Le chargement progressif/paginé au-delà de cette limite reste une optimisation future. Supabase produit actuellement zéro rencontre publique validée ; aucune rencontre « trouvée par référence externe » n'est insérée en base.

### Ordre de priorité des informations

L'identité d'une rencontre pour les vues sourcées est la combinaison **équipe + jour Europe/Paris + adversaire normalisé**. Une décision réellement publiée par le club (programmée, terminée, reportée ou annulée) prime sur sa copie référencée. La vérification est désormais partagée par l'accueil, l'agenda, le Match Center et les pages équipe.

Cette clé est une déduplication prudente ; elle ne rapproche pas un match dont l'adversaire ou la date a été intégralement modifié. En cas de conflit d'identité, les résultats tiers restent explicitement « à confirmer » et ne sont jamais présentés comme validés par le club.

### États de match cohérents

- **Programmée** : affichée comme future seulement si le coup d'envoi n'est pas déjà passé. Si l'heure a passé mais que le club n'a pas saisi de résultat, l'interface indique qu'il reste « à confirmer », sans inventer un score.
- **Jouée** : score uniquement si les deux nombres existent, avec couleurs de résultat Vert/Jaune-Rouge selon le point de vue Boissy UJ.
- **Reportée** : conservée dans l'agenda et les calendriers avec mention « reporté », jamais annoncée comme prochain coup d'envoi sur l'accueil.
- **Annulée** : visible parmi les décisions publiées du club et isolée des rencontres programmées. Sa copie non validée ne remplace pas l'annulation.

Les onglets Championnat/Coupe par équipe continuent d'utiliser le type vérifié `competition_kind`, et **Seniors C** reste amical. L'équipe futsal garde le nom **« Senior »**.

### Actualisation et nettoyage des ressources

`watchPublicSportsRefresh` déclenche le rafraîchissement d'une rubrique montée au plus tard toutes les **60 minutes**, et lorsqu'un visiteur revient sur un onglet après au moins 60 secondes sans contrôle. Chaque vue possède sa propre gestion d'`AbortController`/délai réseau : les réponses tardives d'une ancienne route ne mettent pas à jour la page visible. Les écouteurs focus/visibilité et l'intervalle sont supprimés à la fermeture de la route. L'accueil conserve son mécanisme de passage au match suivant à l'heure réelle du coup d'envoi.

**Limite UX :** le rafraîchissement automatique remonte la rubrique ; un filtre local peut revenir à sa valeur initiale après rafraîchissement. Les liens internes et l'absence de navigation vers des sites sportifs tiers restent inchangés.

## Tests et homologation

`tests/step75-public-sports-sync.test.mjs` compare les quatre chargements sur un jeu de données identique, vérifie les rejets des entrées non publiées/malformées, la priorité des décisions (y compris annulations et reports), les statuts du calendrier et le cycle des écouteurs de rafraîchissement. Les anciennes attentes de tests sont adaptées aux nouvelles règles publiques sans assouplir RLS.

**Cette étape n'ajoute aucune migration Supabase** : les contrôles SQL RLS des étapes 66–74 restent l'autorité ; le déploiement est uniquement GitHub Pages. Les tests humains multi-navigateurs, les résultats réels et les homologations sportives restent distincts de l'avancement de développement.

**Étape 76 suivante :** fiabiliser le contenu éditorial et la gestion des versions d'actualités.
