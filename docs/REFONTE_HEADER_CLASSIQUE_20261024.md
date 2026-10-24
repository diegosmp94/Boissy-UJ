# Refonte du header — Proposition 1 (classique et professionnelle)
**24 octobre 2026 · Frontend public · Livraison conditionnée aux tests**

## Nouvelle architecture

Sur ordinateur, la navigation principale est réduite à :
**Accueil | Équipes ▼ | Compétitions ▼ | Vie du club ▼ | Mon espace**.

- **Équipes** : page globale, Football à 11, Seniors A, B, C, Vétérans ; Futsal, Senior.
- **Compétitions** : Matchs et résultats, Championnat, Coupe, Classements, Agenda.
- **Vie du club** : Actualités, Événements, Awards, Communauté, Notre club, Nous rejoindre, Soutenir, Infos pratiques.
- **Mon espace** : bouton indépendant, sans régression du parcours Supabase Auth.

Les rubriques existantes ne sont pas supprimées ni rendues externes.

## Parcours effectifs

- Championnat : `#/matchs?competition=league` ouvre l'onglet Championnat du Match Center.
- Coupe : `#/matchs?competition=cup` ouvre l'onglet Coupe.
- Classements : `#/matchs?section=classements` rejoint le vrai bloc de classements du Match Center avec une marge de lecture sous le header fixe.
- Agenda : `#/agenda`; les données restent les mêmes.
- En cas d'accès direct à un lien sport, les protections habituelles contre les données non publiées et les pannes Supabase restent actives.

## Accessibilité et adaptation mobile

- Boutons de navigation avec `aria-controls`, `aria-expanded` et panneau masqué avec `hidden`.
- Un seul sous-menu ordinateur ouvert à la fois ; souris, focus clavier, activation par clic et Flèche bas pris en charge.
- Échap ferme les menus et rend le focus au bouton concerné.
- Le menu mobile utilise trois regroupements sémantiques `<details>`, dont Équipes avec ses deux sous-catégories ; fermeture du menu et repli des groupes après navigation.
- Navigation basse conservée : Accueil, Matchs, Équipes, Actualités, Mon espace.
- Zones tactiles de 44 px minimum et animations désactivables par `prefers-reduced-motion`.
- CSS spécifique `header-navigation.css` : ne modifie ni les pages de contenu, ni les données, ni la configuration Auth.

## Vérification de livraison

Exécuter la suite Node et l'audit public, puis le parcours Chromium à 320 px et 1366 px ; corriger les éventuelles régressions de liens, menus, overflow ou navigation au clavier. Fusionner dans `main` seulement après CI verte et vérifier le déploiement Pages sur le SHA exact.

Les recettes réelles Safari / Android / VoiceOver restent distinctes des simulations automatisées et ne sont pas déclarées terminées.
