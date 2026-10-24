# Boissy-UJ — matrice de recette pondérée

**Barème sur 100 points, à valider en recette fonctionnelle.**

| Domaine | Points | Conditions d'acceptation |
| --- | ---: | --- |
| Identité, accueil cinématique et navigation | 15 | Huit chapitres, affichage mobile, commandes clavier et animations réduites |
| Comptes, rôles et sécurité | 16 | Supabase Auth, récupération, RLS, droits cumulables et MFA administrateur |
| Équipes, licenciés, saisons et éducateurs | 13 | Cinq équipes (dont Senior en futsal), convocations, fiches, effectifs et reconduction |
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

## Suivi P1 — identité, navigation et conformité (22 octobre 2026)

Le correctif [P1 Identité / RGPD / déploiement](P1_IDENTITE_RGPD_DEPLOIEMENT.md) ajoute des pages de transparence, les points d'accès légaux, la navigation clavier/mobile et un contrôle de packaging en CI. **Aucun des 15 points du domaine visuel ni des 4 points du domaine RGPD/déploiement ne peut être qualifié d'intégralement homologué avant la recette multi-appareils, la validation des mentions, la preuve de restauration et la validation juridique.** Les points restent attribués uniquement lors de la recette réelle.

## Étape 64 — preuves automatisées et homologation distinctes

La commande `npm run release:acceptance` ne fait que consolider les preuves techniques HTTP et les chantiers ouverts (6 P1, 6 P2, 2 P3 au début de l'étape). Elle ne signe aucun module et ne transforme pas des tests CI en points homologués. Le contrôle réel de GitHub Pages par commit, les comptes avec permissions/MFA, la restauration isolée, les appareils iPhone/Android et les éléments juridiques doivent avoir leurs preuves indépendantes et un PV du club. [Recette finale](ETAPE_64_RECETTE_FINALE_DEPLOIEMENT.md).

## État initial

**0/100 points homologués à l'échelle du produit complet.** Les écrans statiques constituent le premier socle visuel, pas la validation finale d'un module entier.
