# Étape 42 — Scores archivés et classements sourcés Boissy UJ

Relevé du **22 octobre 2026**. Ne pas confondre **Boissy U.J. (affiliation 548423)** avec Boissy FC ou FC de Boissy 91.

## Données ajoutées

- **42 scores attribués**, chacun avec équipe, saison, adversaire, jour, score domicile/extérieur, compétition et URL de source, dans la table Supabase publique en **lecture seule** `external_sourced_match_archive`.
- Répartition : **37 matchs relevés en 2025–2026** (Seniors A : 3 ; Seniors B : 15 ; Senior futsal : 19) et **5 résultats en 2026–2027** (Seniors A : 4, dont un de coupe ; Senior futsal : 1 en coupe).
- Les archives sont aussi présentes dans les fiches d'équipe, le Match Center et la vue mensuelle ; un sélecteur permet de consulter les saisons 2025–2026 et 2026–2027. Les couleurs vert / orange / rouge reflètent **le résultat du point de vue de Boissy UJ**.
- Les rencontres à score inconnu ne reçoivent aucun score inventé. Les rencontres de coupe sont signalées et n'entrent jamais dans les points de championnat.

## Classements réellement identifiés

Ces tableaux sont des **archives de fin de saison 2025–2026** :

| Équipe | Compétition | Rang archivé | Matchs | V/N/D | Points | BP/BC |
|---|---|---:|---:|---|---:|---|
| Seniors A | D4 poule A | 2e | 18 | 14/1/3 | 43 | 64/24 |
| Seniors B | D4 poule B | 5e | 14 | 3/3/8 | 12 | 31/64 |

Sources : [TheFootData – Seniors A, relevé sur fiche de USJTO Ukraine](https://thefootdata.com/clubs/usjto-ukraine?equipe=204300-SEM-1&saison=2025) et [TheFootData – Boissy UJ Seniors B](https://thefootdata.com/clubs/boissy-uj?equipe=25504-SEM-2&saison=2025). L'archive B est également recoupable sur [SportCorico D4 poule B](https://www.sportcorico.com/championnat/paris-seniors-d4-5/phase-unique/poule-b).

**Saison 2026–2027** : classement intégral de poule non vérifié. **Ne pas afficher de rang fictif**. Pour Seniors A, seul bilan partiel des trois matchs de D3 sourcés au 22/10/2026 : **3 matchs, 2 victoires, 0 nul, 1 défaite, 6 points obtenus sur ces matchs, 9 BP et 3 BC**. La défaite 0–6 face à Villejuif en Coupe VDM est exclue du bilan de championnat. Sources : [SportCorico Boissy UJ Seniors 1](https://www.sportcorico.com/clubs/boissy-uj/boissy-uj). Pour les autres équipes, aucune position 2026–2027 n'a été publiée à partir d'éléments insuffisants.

## Publication et sécurité

- La migration `supabase/migrations/202610220011_external_match_archive_readonly.sql` a été exécutée sur Supabase. Contrôle : **42 lignes, RLS activé**, SELECT anonyme autorisé, INSERT anonyme et UPDATE de membre désactivés.
- Chaque ligne porte `club_validated=false`, **sans permission d’écriture par les visiteurs**. Il ne s'agit pas de matchs validés par le club.
- **Aucun** de ces résultats externes n'est inséré dans `public.matches`, ne détermine `team_form_summary`, ni ne déclenche les félicitations automatiques. Aucune équipe adverse supplémentaire ou place au classement 2026–2027 n’est inventée.
- Les classements validés pour la saison courante restent saisis par un administrateur MFA dans `team_league_standings`. Lorsqu'ils seront publiés, l'affichage conservera **l'archive de 2025–2026** à titre distinct.
- Les contenus de sources externes sont des relevés ponctuels et non un flux FFF officiel, ni un suivi temps réel. Une vérification et validation par le club sont nécessaires avant de les revendiquer comme officiels.
