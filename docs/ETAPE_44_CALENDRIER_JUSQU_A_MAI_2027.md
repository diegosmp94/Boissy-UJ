# Étape 44 — Prolongation du calendrier 2026–2027 jusqu’à mai 2027

Relevé documentaire : **23 octobre 2026**. Club concerné exclusivement : **Boissy U.J.**, Val-de-Marne, affiliation FFF **548423**. Ne jamais confondre avec « Boissy FC » ou « FC de Boissy 91 ».

## Périmètre et sources

**43 nouvelles rencontres de championnat sourcées** ont été ajoutées au module `remaining-official-season-fixtures.mjs`. Chaque ligne contient équipe de Boissy, date, heure si retrouvée, adversaire, domicile/extérieur et URL de provenance **réservée à la traçabilité**. Les supporters restent sur **le site Boissy UJ**.

| Équipe | Nouvelles rencontres ajoutées | Dernière rencontre sourcée |
|---|---:|---|
| Seniors A · D3 poule B | 10 | 30 mai 2027, Moldavie FC 1 |
| Seniors B · D4 poule C | 11 | 30 mai 2027, St-Maur Lusitanos 2 |
| Vétérans · Anciens D3 poule C | 10 | 23 mai 2027, Éléphant Côte d’Ivoire 11 |
| Senior · futsal D2 poule B | 12 | 17 mai 2027, Maisons-Alfort FC 1 |

Les rencontres déjà enregistrées jusqu'à décembre 2026 restent présentes. Les **Seniors C** ne disputent pas de championnat officiel dans le périmètre et aucun match ne leur est inventé. Les **coupes** ne sont pas prolongées sans véritable tirage/rencontre documentée.

Sources principales collectées et vérifiées le 23/10/2026 :

- Seniors A : `https://www.sportcorico.com/clubs/boissy-uj/boissy-uj`.
- Vétérans : `https://www.sportcorico.com/clubs/boissy-uj/boissy-uj-6?season=2026-2027`.
- Senior futsal : `https://www.sportcorico.com/clubs/boissy-uj/boissy-uj-1`.
- Seniors B : calendriers par adversaire de la D4 poule C sur SportCorico (SFC Canavérois, Mimosa Mada-sport, Créteil Football Académie, Noiseau Sainte-S., AS Zenaga, St-Maur Lusitanos) ; liens conservés dans le module.

## Qualité des données

- Les 43 rencontres nouvelles portent `status:'scheduled'` et `date_confirmed_by_club:false`. Les dates antérieures que le club a confirmées ne perdent pas ce statut.
- **Aucun score futur** n'est inventé ; la donnée paradoxale « 2–12 » publiée pour le 20/02/2027 par le fournisseur n'est **pas** considérée comme un résultat ou un horaire. L'affiche est reprise **sans heure ni score**.
- Les week-ends « exempt » et les affiches avec un « F » de forfait dans la source ne sont **pas ajoutés comme rencontres ordinaires**. Seules les parties dont adversaire et date sont précis sont retenues.
- **Calendrier Seniors B partiel** : plusieurs journées n'ont pas été recoupées ; une mention visible sur la fiche empêche de prétendre que toutes les rencontres sont connues.
- Le programme reste un **instantané statique de sources publiques**, pas une synchronisation en temps réel avec la FFF. Le club peut modifier horaires et rencontres ; une nouvelle revue est nécessaire pour actualiser ce catalogue.
- La table Supabase `matches` reste réservée aux matchs publiés/validés par les responsables du club. **Aucun résultat externe n'est injecté comme résultat officiel**, et les félicitations restent liées uniquement aux victoires approuvées.

## Interface

Les rencontres sont désormais visibles dans **Match Center**, les **fiches d’équipe** (prochain match d'abord) et le **calendrier mensuel**, jusqu'à mai 2027. Les onglets **Championnat** et **Coupe** restent distincts et les liens vers des sites tiers ne sont pas réintroduits. Le code couleur V / N / D ne s'applique qu'aux résultats effectivement connus.

## Recette

Tests contrôlant les 43 nouvelles lignes, leurs équipes et saisons, le calendrier de janvier à mai, l'absence de scores futurs, les horaires « date seulement » non fabriqués, la séparation coupe/championnat, le non-mélange de clubs et l'absence de liens sportifs externes publics. Tests GitHub obligatoires avant la fusion.
