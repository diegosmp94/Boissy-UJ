# Boissy-UJ — matrice de recette pondérée

**Barème sur 100 points, à valider en recette fonctionnelle.**

| Domaine | Points | Conditions d'acceptation |
| --- | ---: | --- |
| Identité, accueil cinématique et navigation | 15 | Huit chapitres, affichage mobile, commandes clavier et animations réduites |
| Comptes, rôles et sécurité | 16 | Supabase Auth, récupération, RLS, droits cumulables et MFA administrateur |
| Équipes, licenciés, saisons et éducateurs | 13 | Quatre équipes, convocations, fiches, effectifs et reconduction |
| Match Center et FFF | 13 | Compositions, scores, statistiques, données officielles vérifiées ou saisie manuelle |
| Actualités et Media Center | 8 | Médias autorisés, publication par éducateur, réactions sans commentaires |
| Supporters, Premium et Awards | 8 | Gratuit, premium 10 €/mois et 100 €/an manuel, votes uniques |
| Événements et réservations | 7 | Tarifs, gratuité/réduction premium, jauges, QR codes, annulations |
| Dons, campagnes et Stripe TEST | 8 | Dons ponctuels/mensuels, affectation, test de notifications et résiliation |
| Control Center | 8 | Droits égaux admins, éditeur, brouillons, journal d'audit, restauration |
| Qualité, RGPD, accessibilité et déploiement | 4 | Recette multi-appareils, sauvegardes, confidentialité, performances |

**Total : 100 points.**

## Calcul du seuil de 85 %

Chaque module n'obtient ses points que lorsque ses critères sont réalisés et testés. Les pages de démonstration et les maquettes ne valident pas des processus opérationnels. À **85 % de points réellement validés**, déclencher la campagne de recette complète. Les tests techniques commencent dès la première étape et la mise en production n'est autorisée que lorsque tous les critères critiques sont satisfaits.

## Conditions critiques bloquantes

- Aucune donnée privée accessible hors droits vérifiés côté serveur.
- Aucun abonnement actif sans paiement validé via notification serveur signée.
- Aucun paiement réel avant vérification juridique et validation explicite du club.
- Données de licenciés mineurs et droits à l'image protégés.
- Aucun automatisme FFF non autorisé ; mode manuel fonctionnel.
- Sauvegarde et restauration réellement testées avant lancement.
- Pas de régression critique en navigation mobile et accessibilité.

## État initial

**0/100 points homologués à l'échelle du produit complet.** Les écrans statiques constituent le premier socle visuel, pas la validation finale d'un module entier.
