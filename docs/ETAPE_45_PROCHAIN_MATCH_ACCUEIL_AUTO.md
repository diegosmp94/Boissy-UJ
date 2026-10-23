# Étape 45 — Prochain match synchronisé sur l’accueil

État : 23 octobre 2026. Le composant public « Prochain match » du chapitre 3 de l’accueil ne présente plus de texte statique « à venir ».

## Source unique et ordre de priorité

Le module `home-next-match.mjs` combine les deux mêmes catalogues que le Match Center et le calendrier mensuel :
1. Les rencontres `matches` publiées dans Supabase par Boissy UJ, au statut `scheduled` (priorité en cas de doublon, équipe + jour + adversaire).
2. Les rencontres 2026–2027 sourcées dans `external-match-previews.mjs`, y compris les échéances ajoutées jusqu’à **mai 2027** pour Seniors A, Seniors B, Vétérans et Senior futsal.

Correctif du 23 octobre : la lecture publique récupère également les statuts annulé, reporté et terminé. Pour une même équipe, date parisienne et adversaire, toute décision publiée par le club masque la copie sourcée ; seule une rencontre encore programmée peut être sélectionnée. Les brouillons ne masquent pas le calendrier public. Un report vers une autre date ne peut pas être rapproché automatiquement sans identifiant source commun : l'ancienne date doit être conservée comme reportée ou retirée du catalogue sourcé.

Aucun match annulé, terminé, au score inconnu ou au coup d’envoi déjà passé ne reste comme « prochain ». Les matchs amicaux des Seniors C ne sont pas inventés : ils pourraient s’afficher seulement si publiés par le club.

## Cadence

- Affichage instantané du programme source local dès le montage, puis relecture des rencontres publiées en base (requêtes publiques `GET`, clé publique uniquement, `cache:no-store`).
- Recalcul **au plus tard toutes les heures**, avec nouvelles requêtes au catalogue publié.
- Recalcul anticipé **à l’heure de coup d’envoi + ~1 seconde** pour passer au suivant sans rechargement de la page.
- Si seul le jour est documenté, le match reste jusqu’au **changement de date à Paris**, sans inventer d’horaire. Passage heure d’été/hiver traité par `Europe/Paris`.
- En cas de retour dans l’onglet ou de focus de la fenêtre, le match est immédiatement réévalué et les données rechargées si la dernière lecture remonte à plus d’une minute.
- Navigation hors de l’accueil : annulation du réseau, nettoyage du minuteur et des écouteurs. Le calendrier affiché côté navigateur ne réalise pas de tâche serveur lorsque personne ne consulte le site.

## Interface

Le panneau comporte équipe, Boissy UJ VS adversaire (sens domicile/extérieur), jour, **horaire seulement s’il est connu**, championnat / coupe, mention de fiabilité et navigation **interne** vers Match Center et la fiche de l’équipe. Style bleu nuit / doré responsive 320 px.

Trois niveaux sont distingués sans falsifier les confirmations : « Rencontre publiée par le club », « Date annoncée par le club », ou « Calendrier référencé · date et horaire à confirmer par le club ». Le site ne donne jamais le statut « officiel FFF » à un relevé tiers.

## Tests

`tests/home-next-match.test.mjs` couvre : priorité publiée, dédoublonnage, prochain match réel à partir de la saison existante, bascule au coup d’envoi, délai maximal d’une heure, jour sans heure, changement de date à Paris et DST, exclusion des parties passées/annulées et des résultats, requêtes Supabase publiques, absence de liens tiers et nettoyage à la navigation. Tests Node, qualité et smoke navigateur GitHub avant fusion.

### Limite

Ce dispositif réévalue **le programme déjà disponible dans le site et Supabase**, sans connexion à une API FFF en temps réel. Pour tenir compte de nouveaux tirages, reports ou horaires transmis ailleurs, le club doit publier la correction ou le catalogue de sources doit être mis à jour.
