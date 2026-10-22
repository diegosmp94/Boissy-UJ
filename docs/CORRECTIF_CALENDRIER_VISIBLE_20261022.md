# Correctif urgent — calendrier public non vide (22 octobre 2026)

## Diagnostic constaté directement

Supabase Boissy-UJ contient **5 équipes**, **0 match**, **0 match publié**, **1 événement dont 0 publié**. La version précédente affichait donc un calendrier vide par construction. Le déploiement GitHub Pages n'était pas la cause.

## Correctif visible

La page **Agenda** et le **Match Center** montrent désormais, lorsque le club n'a publié **aucun match**, un encart distinct « Calendrier externe — à confirmer par le club » avec date, équipe, adversaire, domicile/extérieur et un lien vers la source publique **SportCorico**.

- Contenu de départ : quelques prochaines rencontres publiquement consultables au 22/10/2026 pour Seniors A, Seniors B, Vétérans et Senior (futsal).
- Seniors C reste sans rencontre, faute de calendrier amical public confirmé.
- La récupération n'utilise aucune API FFF non autorisée, ne contacte aucune API privée et n'inscrit **aucun match** dans Supabase.
- Les données externes sont **indicatives**, datées et attribuées ; elles ne sont ni des horaires confirmés par le club ni des « données officielles FFF ».
- Les dates expirées disparaissent automatiquement et les filtres d'équipe, discipline et période continuent de fonctionner. Les rencontres publiées par le club dans Supabase **remplacent** le mode externe pour éviter les doublons.
- Les matchs externes ne sont pas ajoutés à l'export iCalendar : seules les entrées publiées par le club sont exportées.

## Sources publiques utilisées

- [Seniors A — Boissy U.J. D3](https://www.sportcorico.com/clubs/boissy-uj/boissy-uj) : 01/11 Nogent FC 3 ; 08/11 FC Hoverla 1 ; 15/11 Hay-les-Roses CA 2 ; 22/11 Limeil-Brévannes AJ 2.
- [Senior — futsal D2](https://www.sportcorico.com/clubs/boissy-uj/boissy-uj-1) : 24/10 FC Chennevières ; 31/10 Créteil Palais Futsal ; 09/11 Chouchous Vitry ; 21/11 Vitry ASC.
- [Vétérans](https://www.sportcorico.com/clubs/boissy-uj/boissy-uj-6?season=2026-2027) : 15/11 Villeneuve Ablon US ; 22/11 Noiseau Sainte-S.
- [Seniors B — calendrier contradictoire repéré chez l'adversaire](https://www.sportcorico.com/clubs/sporting-football-club-de-chennevieres/sfcc-1) : 15/11 contre SFC Canavérois 1.

Les horaires, équipes engagées, forfaits et lieux sont susceptibles de changer. Les noms ont été présentés comme issus de sites tiers, et non comme validés par Boissy U.J.

## Suite exigée pour la version de référence

Faire valider les rencontres dans le Control Center, puis les publier via les RPC déjà protégées par rôles/MFA. Obtenir séparément un accord FFF pour un véritable connecteur serveur synchronisé. La publication des rencontres officielles doit rester auditable ; ne jamais utiliser ces références externes pour prétendre qu'un administrateur du club a approuvé les matchs.

**La correction de l'affichage ne certifie pas l'accès à une API FFF ni l'homologation du produit.**
