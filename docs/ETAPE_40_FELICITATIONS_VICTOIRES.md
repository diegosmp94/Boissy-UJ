# Étape 40 — Félicitations automatiques après victoire

Date : 22 octobre 2026.

## Équipes concernées

- Seniors A (`a`)
- Seniors B (`b`)
- Vétérans (`veterans`)
- Senior futsal (`futsal`)

**Seniors C (`c`) sont exclus**, conformément à la consigne du club.

## Fonctionnement

Après la publication par le club d'une rencontre **terminée** avec un score de victoire (domicile ou extérieur), une carte dorée apparaît automatiquement **dans le Match Center et sur la fiche de l'équipe** avec le texte :

> Félicitations aux joueurs et à tout le staff pour cette victoire ! Votre travail, votre solidarité et votre engagement font la fierté de Boissy UJ. Continuez comme ça !

Le titre est adapté : « Bravo aux Seniors A ! », « Bravo aux Seniors B ! », « Bravo aux Vétérans ! » ou « Bravo aux Senior futsal ! ».

Les nuls, défaites, rencontres non jouées, brouillons et scores tiers non validés **ne déclenchent jamais** ce message. Il n'est pas nécessaire de saisir ou publier une actualité distincte : l'interface le calcule au chargement à partir de la ligne publiée dans Supabase.

## Félicitations collectives supplémentaires

Si **les quatre équipes concernées remportent chacune leurs rencontres dans la même semaine (du lundi au dimanche, fuseau Europe/Paris)**, une bannière supplémentaire remercie tous les joueurs et staffs de Boissy UJ sur **l'accueil et dans le Match Center**. Elle n'apparaît que pour les semaines récentes (14 derniers jours), et uniquement à partir de résultats publiés. Si une des quatre équipes a fait match nul ou perdu au cours de cette semaine, aucune célébration collective n'est affichée. Seniors C ne modifient pas cette condition.

## Sécurité et actualisation

- Données lues **en GET sur les tables publiques** `matches` (filtre publié, terminé) et `club_teams` pour la bannière d'accueil.
- Aucun rôle, prénom, effectif, coordonnées de joueurs, nom de mineur, identifiant personnel ou donnée privée affiché.
- Aucune modification de la base Supabase, aucun paiement et aucune écriture supplémentaire.
- Les cartes changent automatiquement après publication/correction d'un score **au prochain chargement de la page**. Il ne s'agit pas d'une notification push ni d'une actualisation en continu.
- Aucune victoire de SportCorico ne déclenche le message avant validation par le club.

## Vérification

Tests : exclusion Seniors C, victoire à domicile/extérieur, nul, défaite, statut `played` obligatoire, `published=true`, seuil temporel, absence de mélange entre semaines, calcul indépendant du fuseau UTC, communication publique non privilégiée et montage sur accueil, Match Center et pages équipes.

**État réel :** Supabase comptait zéro match publié lors du dernier contrôle. Les messages ne sont donc pas visibles avant la publication de vraies victoires.
