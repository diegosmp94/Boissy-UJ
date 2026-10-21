# Boissy-UJ — Matrice de couverture et recette pondérée

## Méthode validée

Le seuil de **85/100** déclenche la **campagne formelle de recette finale**. Il n'autorise ni une fusion automatique dans `main` ni une mise en production. Les tests unitaires, intégration, accessibilité et sécurité commencent bien avant les 85 %.

Chaque pôle est divisé en exigences vérifiables, assorties de critères d'acceptation. Un critère non vérifié ne reçoit aucun point ; les avancements intermédiaires doivent être documentés. La somme des points acquis est contrôlée sur **100**.

| Pôle | Pondération | Critères d'acceptation clés |
|---|---:|---|
| Identité, cinématique et accueil | 15 | 8 chapitres, écusson, transitions, introduction passable |
| Navigation et responsive | 8 | Menu supérieur, raccourcis mobiles, clavier, Safari iPhone |
| Pages publiques et SEO | 8 | Pages équipes, matchs, média, club, contact, métadonnées |
| Authentification et rôles | 12 | Connexion, inscription, récupération, cumul des rôles, RLS |
| Sports Manager et Match Center | 17 | 4 équipes, effectifs, saisons, convocations, statistiques, calendrier manuel |
| Media Center | 8 | Publications autorisées, médias, likes, archives, consentements |
| Communauté et Awards | 8 | Comptes gratuits/premium, votes uniques, catégories éligibles |
| Finances et Stripe TEST | 10 | Mensuel 10 €, annuel 100 € manuel, dons, campagnes, webhooks sécurisés |
| Événements et billetterie | 5 | Jauges, billets, QR, priorité, remises, remboursements |
| Control Center | 5 | Administration unifiée, brouillons, aperçu, versions, journal |
| Sécurité, conformité et qualité | 4 | Contrôles critiques, RGPD, sauvegardes, performance |
| **TOTAL** | **100** | |

## Conditions bloquantes indépendantes de la note

- Aucun accès non autorisé aux données d'un joueur, d'un mineur, d'un donateur ou à l'administration.
- RLS et contrôles serveur validés sur tous les rôles et combinaisons de rôles.
- Aucun octroi d'abonnement/billet sur une simple redirection : confirmation serveur via événements Stripe authentifiés.
- Aucun paiement LIVE avant validation du compte de l'association, conformité et autorisation explicite.
- Respect des droits de publication sur les photos/vidéos et des règles applicables aux sportifs.
- Aucune automatisation FFF sans source ni autorisation confirmées ; maintien du mode manuel.
- Aucune anomalie bloquante sur les parcours critiques, tests de sauvegarde/restauration satisfaisants.

## État du lot 1

Lot « Fondations publiques » : structure statique HTML/CSS/JS sans dépendances, huit chapitres de l'accueil, navigation hybride, pages sportives et communautaires en état initial, logo officiel. Ce lot **ne vaut pas** livraison des espaces authentifiés, du Sports Manager, de Stripe ou du Control Center. Les validations de la matrice s'effectueront au fil des lots et ne doivent pas être inférées de l'existence d'un simple écran de prévisualisation.

## Pistes et décisions reportées

Identité juridique détaillée de l'association, éligibilité aux reçus fiscaux, régime TVA applicable, compte Stripe habilité, délai de priorité événementielle, intégration FFF licite. Le compte annuel premium est de 100 € et **ne se renouvelle pas automatiquement**.
