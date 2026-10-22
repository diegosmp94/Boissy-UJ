# Étape 39 — Matchs liés aux fiches et classements de championnat

Date : 22 octobre 2026.

## Ce qui est développé

1. Chaque rencontre du **Match Center**, qu'elle soit publiée par le club ou trouvée sur une source externe clairement identifiée, possède un accès vers **la fiche Boissy-UJ de son équipe**. Le calendrier mensuel propose lui aussi ce lien. Les fiches regroupent les rencontres qui les concernent uniquement ; lorsqu'aucune n'est publiée dans Supabase, la liste de sources externes apparaît distinctement.
2. Quand une rencontre publiée est terminée avec deux scores valides, un indicateur **Victoire, Match nul ou Défaite** est calculé du **point de vue de l'équipe Boissy U.J.** (domicile/extérieur). Les sources externes avec scores indiquent toujours qu'ils restent à confirmer par le club.
3. Les classements se consultent dans la **fiche de chaque équipe** et dans le **Match Center**, par championnat distinct. Classement annoncé comme **renseigné et publié par Boissy-UJ**, pas comme classement automatique de la FFF.
4. Dans le **Control Center → Matchs et résultats → Classements de championnat**, l'administrateur MFA AAL2 peut ajouter les clubs réellement engagés, saisir V/N/D et buts marqués/encaissés, choisir la **journée**, une saison, une éventuelle correction de points et **monter/descendre chaque club**. Points (= 3 × victoires + nuls + ajustement), matchs joués et différence de buts sont automatiquement recalculés. L'ordre reste administrable pour les critères sportifs spécifiques (départage, sanctions).
5. Un enregistrement peut rester en **brouillon** ou être **publié après double confirmation**. Une fonction PostgreSQL exige rôle administrateur + MFA AAL2, valide les données et journalise chaque modification dans un schéma privé. RLS autorise en public uniquement les classements publiés ; aucun compte standard ne peut modifier directement la table.

## État réel et limites

- Migration de production Supabase : `202610220010_league_standings_admin.sql`, appliquée. Contrôle SQL : RLS actif ; écriture anonyme et modification directe membre interdites ; RPC d'enregistrement inaccessible à `anon`.
- Au contrôle initial, **0 classement enregistré et 0 classement publié**. Aucun club adverse, résultat ou position n'a été inventé.
- La vue publique affiche donc « Classement non encore publié » jusqu'à sa première saisie par une personne habilitée.
- Les classements sont une **photographie de la dernière journée enregistrée** : chaque nouvelle sauvegarde remplace les positions publiques précédentes, un audit serveur privé conserve les états antérieurs. Il ne s'agit pas d'un historique graphique des classements par journée.
- Les statistiques sportives du club sont déjà calculées depuis les matchs terminés **publiés** (vue `team_form_summary`). Elles se mettront à jour lorsque de vrais résultats seront saisis. Les classements complets nécessitent les résultats de toutes les équipes du championnat, ou une mise à jour manuelle.
- Les équipes **Seniors C** (amicaux) peuvent ne pas disposer d'un championnat. Une absence de classement est normale.
- Aucune synchronisation API FFF ni modification des paiements/RGPD n'a été effectuée.

## Recette

Contrôles automatiques : sens domicile/extérieur pour V/N/D, calcul de points, position manuelle, égalité, correction de points, refus de statistiques et rangs incohérents, lecture anonyme limitée, liens par équipe, refus d'écriture directe et MFA côté serveur. Les essais complets avec plusieurs vrais comptes autorisés restent nécessaires avant homologation.
