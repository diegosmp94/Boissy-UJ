# Sous-pages publiques par équipe — Joueurs, Matchs et Actualités

**24 octobre 2026 — 5 collectifs, 15 sous-pages canoniques et une navigation par équipe**

## Architecture livrée

Pour chacune des cinq équipes reconnues par `CLUB_TEAMS` (Seniors A, B, C, Vétérans et Senior de la discipline Futsal), le site conserve sa page de présentation et ajoute trois nouvelles URL :

- `#/equipes/<discipline>/<slug>/joueurs`
- `#/equipes/<discipline>/<slug>/matchs`
- `#/equipes/<discipline>/<slug>/actualites`

Par exemple :
`#/equipes/football/seniors-a/joueurs`,
`#/equipes/football/seniors-a/matchs`,
`#/equipes/football/seniors-a/actualites` et
`#/equipes/futsal/boissy-uj-futsal/joueurs`.

Le routeur n'accepte que les noms et chemins exacts du référentiel. L'utilisateur retrouve **Présentation | Joueurs | Matchs | Actualités** sur toutes les pages de l'équipe, avec `aria-current=page`, des liens depuis la liste générale et les pages Football/Futsal, un fil d'Ariane et un retour à la fiche de présentation.

## Alimentation et frontières des données

### Joueurs
La sous-page `joueurs` réutilise les cartes des joueurs dont la fiche est `published=true` **et** `consent_confirmed=true`, rattachés à l'UUID public de l'équipe correcte. Chaque carte renvoie à la fiche individuelle du joueur lorsque l'identifiant est conforme. Les portraits et les âges **ne sont pas inventés**. La requête ne charge pas les statistiques collectives ni les actualités inutiles dans ce mode.

### Matchs
La sous-page `matchs` réutilise le calendrier des rencontres de l'équipe, les vrais onglets Championnat/Coupe, les saisons historiques disponibles, la légende victoire/nul/défaite et le classement associé. Les anciennes archives non approuvées restent signalées « à confirmer par le club ».

### Actualités
La sous-page `actualites` monte le véritable fil de nouvelles public `mountNews(team.code)`, avec recherche, filtres, médias approuvés et garde contre les autres équipes en cas d'échec des métadonnées de mapping. Les brouillons, publications privées, non revues et futures restent non publiés.

## Sécurité et accessibilité

- Aucun ajout ou écriture dans Supabase ; aucun identifiant Supabase privé ou compte de test créé.
- Les sous-pages utilisent uniquement les composants publics existants et leurs filtres, contrôles d'autorisation, `AbortController` et délais réseau.
- Une donnée indisponible n'est jamais substituée par un résultat sportif, un joueur ou un article fictif.
- Menu adapté au mobile, 44 px de zone d'activation, indications `aria-current`, fil d'Ariane et thème bleu nuit/doré.
- Les données de mineurs, images et biographies exigent toujours validation RGPD et, le cas échéant, autorisations légales de publication.

## Validation technique

`tests/team-subpages.test.mjs` vérifie les 15 chemins, les rejets des chemins fabriqués, les onglets actifs, les composants montés par sous-page et l'accès au trombinoscope filtré. Le navigateur Chromium teste les trois vues sur Seniors A en largeur iPhone et les joueurs Senior de Futsal sur ordinateur.

Cette étape valide la **structure et le fonctionnement technique**, mais ne garantit pas que tous les effectifs, résultats et articles aient déjà été renseignés puis homologués par le club.
